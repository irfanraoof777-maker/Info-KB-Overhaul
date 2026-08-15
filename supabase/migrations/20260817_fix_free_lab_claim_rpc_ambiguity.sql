BEGIN;

-- Correct SQLSTATE 42702 from the executed function. RETURNS TABLE creates
-- PL/pgSQL output variables named user_id and lab_id, so the previous
-- ON CONFLICT (user_id, lab_id) arbiter was ambiguous. The deployed full
-- unique index on public.lab_rentals (user_id, lab_id) remains authoritative.
CREATE OR REPLACE FUNCTION public.claim_free_lab_rental(
  p_student_id uuid,
  p_lab_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  lab_id uuid,
  state text,
  source text,
  starts_at timestamptz,
  expires_at timestamptz,
  ready_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
#variable_conflict error
DECLARE
  target_lab public.labs;
  existing_rental public.lab_rentals;
  claimed_rental public.lab_rentals;
  effective_price numeric;
BEGIN
  IF p_student_id IS NULL OR p_lab_id IS NULL THEN
    RAISE EXCEPTION 'Free Lab claim is invalid';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_student_id::text || ':' || p_lab_id::text, 0)
  );

  SELECT lab_row.* INTO target_lab
  FROM public.labs AS lab_row
  WHERE lab_row.id = p_lab_id
  FOR UPDATE;

  IF target_lab.id IS NULL OR target_lab.enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Lab is unavailable';
  END IF;

  effective_price := CASE
    WHEN target_lab.discounted_price IS NOT NULL
      AND target_lab.discounted_price < target_lab.price
      THEN target_lab.discounted_price
    ELSE target_lab.price
  END;
  IF effective_price <> 0 THEN
    RAISE EXCEPTION 'Lab is not available for free claim';
  END IF;

  SELECT rental_row.* INTO existing_rental
  FROM public.lab_rentals AS rental_row
  WHERE rental_row.user_id = p_student_id
    AND rental_row.lab_id = p_lab_id
  ORDER BY rental_row.created_at, rental_row.id
  LIMIT 1
  FOR UPDATE;

  IF existing_rental.id IS NOT NULL THEN
    RETURN QUERY SELECT
      existing_rental.id,
      existing_rental.user_id,
      existing_rental.lab_id,
      existing_rental.state,
      existing_rental.source,
      existing_rental.starts_at,
      existing_rental.expires_at,
      existing_rental.ready_at,
      existing_rental.cancelled_at,
      existing_rental.created_at,
      existing_rental.updated_at;
    RETURN;
  END IF;

  INSERT INTO public.lab_rentals AS rental_insert (
    user_id, lab_id, state, source
  ) VALUES (
    p_student_id, p_lab_id, 'preparing', 'free_trial'
  )
  ON CONFLICT DO NOTHING
  RETURNING rental_insert.* INTO claimed_rental;

  -- An Admin/payment insert does not share the claim advisory lock. If it won
  -- the full unique identity race, return that entitlement without changing it.
  IF claimed_rental.id IS NULL THEN
    SELECT rental_row.* INTO claimed_rental
    FROM public.lab_rentals AS rental_row
    WHERE rental_row.user_id = p_student_id
      AND rental_row.lab_id = p_lab_id
    FOR UPDATE;

    IF claimed_rental.id IS NULL THEN
      RAISE EXCEPTION 'Free Lab claim could not be completed';
    END IF;

    RETURN QUERY SELECT
      claimed_rental.id,
      claimed_rental.user_id,
      claimed_rental.lab_id,
      claimed_rental.state,
      claimed_rental.source,
      claimed_rental.starts_at,
      claimed_rental.expires_at,
      claimed_rental.ready_at,
      claimed_rental.cancelled_at,
      claimed_rental.created_at,
      claimed_rental.updated_at;
    RETURN;
  END IF;

  INSERT INTO public.access_audit_events AS audit_event (
    actor_type, actor_id, action, resource_type, resource_id, student_id, metadata
  ) VALUES (
    'system',
    p_student_id,
    'free_lab_claimed',
    'lab_rental',
    claimed_rental.id,
    p_student_id,
    pg_catalog.jsonb_build_object(
      'labId', p_lab_id,
      'state', claimed_rental.state,
      'source', claimed_rental.source
    )
  );

  RETURN QUERY SELECT
    claimed_rental.id,
    claimed_rental.user_id,
    claimed_rental.lab_id,
    claimed_rental.state,
    claimed_rental.source,
    claimed_rental.starts_at,
    claimed_rental.expires_at,
    claimed_rental.ready_at,
    claimed_rental.cancelled_at,
    claimed_rental.created_at,
    claimed_rental.updated_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_free_lab_rental(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_lab_rental(uuid, uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
