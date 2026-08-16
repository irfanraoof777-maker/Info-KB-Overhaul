BEGIN;

ALTER TABLE public.lab_rentals DROP CONSTRAINT IF EXISTS lab_rentals_state_check;
ALTER TABLE public.lab_rentals ADD CONSTRAINT lab_rentals_state_check
  CHECK (state IN ('payment_pending', 'preparing', 'ready', 'cancelled', 'expired'));

-- Ready access always requires expiry: Admin Ready enforces it and launch rejects NULL.
UPDATE public.lab_rentals
SET state = 'expired'
WHERE state = 'ready' AND (expires_at IS NULL OR expires_at <= now());

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.lab_rentals
    WHERE state IN ('payment_pending', 'preparing', 'ready')
    GROUP BY user_id, lab_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create current Lab rental uniqueness index: duplicate current rentals exist';
  END IF;
END;
$preflight$;

DROP INDEX IF EXISTS public.lab_rentals_user_lab_unique_idx;
CREATE UNIQUE INDEX lab_rentals_user_lab_current_unique_idx
  ON public.lab_rentals (user_id, lab_id)
  WHERE state IN ('payment_pending', 'preparing', 'ready');

CREATE OR REPLACE FUNCTION public.claim_free_lab_rental(p_student_id uuid, p_lab_id uuid)
RETURNS TABLE (id uuid, user_id uuid, lab_id uuid, state text, source text, starts_at timestamptz, expires_at timestamptz, ready_at timestamptz, cancelled_at timestamptz, created_at timestamptz, updated_at timestamptz, newly_created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
#variable_conflict error
DECLARE
  target_lab public.labs;
  existing_rental public.lab_rentals;
  claimed_rental public.lab_rentals;
  effective_price numeric;
BEGIN
  IF p_student_id IS NULL OR p_lab_id IS NULL THEN RAISE EXCEPTION 'Free Lab claim is invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student_id::text || ':' || p_lab_id::text, 0));
  SELECT lab_row.* INTO target_lab FROM public.labs AS lab_row WHERE lab_row.id = p_lab_id FOR UPDATE;
  IF target_lab.id IS NULL OR target_lab.enabled IS NOT TRUE THEN RAISE EXCEPTION 'Lab is unavailable'; END IF;
  effective_price := CASE WHEN target_lab.discounted_price IS NOT NULL AND target_lab.discounted_price < target_lab.price THEN target_lab.discounted_price ELSE target_lab.price END;
  IF effective_price <> 0 THEN RAISE EXCEPTION 'Lab is not available for free claim'; END IF;

  UPDATE public.lab_rentals AS rental_row SET state = 'expired'
  WHERE rental_row.user_id = p_student_id AND rental_row.lab_id = p_lab_id
    AND rental_row.state = 'ready' AND (rental_row.expires_at IS NULL OR rental_row.expires_at <= now());
  SELECT rental_row.* INTO existing_rental FROM public.lab_rentals AS rental_row
  WHERE rental_row.user_id = p_student_id AND rental_row.lab_id = p_lab_id
    AND rental_row.state IN ('payment_pending', 'preparing', 'ready')
  ORDER BY rental_row.created_at DESC, rental_row.id DESC LIMIT 1 FOR UPDATE;
  IF existing_rental.id IS NOT NULL THEN
    RETURN QUERY SELECT existing_rental.id, existing_rental.user_id, existing_rental.lab_id, existing_rental.state, existing_rental.source, existing_rental.starts_at, existing_rental.expires_at, existing_rental.ready_at, existing_rental.cancelled_at, existing_rental.created_at, existing_rental.updated_at, false;
    RETURN;
  END IF;

  INSERT INTO public.lab_rentals AS rental_insert (user_id, lab_id, state, source)
  VALUES (p_student_id, p_lab_id, 'preparing', 'free_trial')
  ON CONFLICT DO NOTHING RETURNING rental_insert.* INTO claimed_rental;
  IF claimed_rental.id IS NULL THEN
    SELECT rental_row.* INTO claimed_rental FROM public.lab_rentals AS rental_row
    WHERE rental_row.user_id = p_student_id AND rental_row.lab_id = p_lab_id
      AND rental_row.state IN ('payment_pending', 'preparing', 'ready')
    ORDER BY rental_row.created_at DESC, rental_row.id DESC LIMIT 1 FOR UPDATE;
    IF claimed_rental.id IS NULL THEN RAISE EXCEPTION 'Free Lab claim could not be completed'; END IF;
    RETURN QUERY SELECT claimed_rental.id, claimed_rental.user_id, claimed_rental.lab_id, claimed_rental.state, claimed_rental.source, claimed_rental.starts_at, claimed_rental.expires_at, claimed_rental.ready_at, claimed_rental.cancelled_at, claimed_rental.created_at, claimed_rental.updated_at, false;
    RETURN;
  END IF;
  INSERT INTO public.access_audit_events AS audit_event (actor_type, actor_id, action, resource_type, resource_id, student_id, metadata)
  VALUES ('system', p_student_id, 'free_lab_claimed', 'lab_rental', claimed_rental.id, p_student_id, pg_catalog.jsonb_build_object('labId', p_lab_id, 'state', claimed_rental.state, 'source', claimed_rental.source));
  RETURN QUERY SELECT claimed_rental.id, claimed_rental.user_id, claimed_rental.lab_id, claimed_rental.state, claimed_rental.source, claimed_rental.starts_at, claimed_rental.expires_at, claimed_rental.ready_at, claimed_rental.cancelled_at, claimed_rental.created_at, claimed_rental.updated_at, true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_assign_lab_rental(p_student_id uuid, p_lab_id uuid, p_starts_at timestamptz DEFAULT NULL, p_expires_at timestamptz DEFAULT NULL)
RETURNS public.lab_rentals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE current_rental public.lab_rentals; result public.lab_rentals;
BEGIN
  IF p_student_id IS NULL OR p_lab_id IS NULL OR (p_starts_at IS NOT NULL AND p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at) THEN RAISE EXCEPTION 'Lab rental request is invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_student_id) OR NOT EXISTS (SELECT 1 FROM public.labs WHERE id = p_lab_id) THEN RAISE EXCEPTION 'Lab rental request is invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student_id::text || ':' || p_lab_id::text, 0));
  UPDATE public.lab_rentals AS rental_row SET state = 'expired'
  WHERE rental_row.user_id = p_student_id AND rental_row.lab_id = p_lab_id
    AND rental_row.state = 'ready' AND (rental_row.expires_at IS NULL OR rental_row.expires_at <= now());
  SELECT rental_row.* INTO current_rental FROM public.lab_rentals AS rental_row
  WHERE rental_row.user_id = p_student_id AND rental_row.lab_id = p_lab_id
    AND rental_row.state IN ('payment_pending', 'preparing', 'ready')
  ORDER BY rental_row.created_at DESC, rental_row.id DESC LIMIT 1 FOR UPDATE;
  IF current_rental.id IS NOT NULL THEN RAISE EXCEPTION 'Student already has a current Lab rental'; END IF;
  INSERT INTO public.lab_rentals AS rental_insert (user_id, lab_id, state, source, starts_at, expires_at, created_by)
  VALUES (p_student_id, p_lab_id, 'payment_pending', 'manual', p_starts_at, p_expires_at, NULL)
  ON CONFLICT DO NOTHING RETURNING rental_insert.* INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Student already has a current Lab rental'; END IF;
  INSERT INTO public.access_audit_events (actor_type, action, resource_type, resource_id, student_id, metadata)
  VALUES ('admin', 'lab_rental_assigned', 'lab_rental', result.id, p_student_id, pg_catalog.jsonb_build_object('labId', p_lab_id, 'startsAt', p_starts_at, 'expiresAt', p_expires_at, 'state', 'payment_pending'));
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_lab_rental(p_rental_id uuid, p_action text, p_starts_at timestamptz DEFAULT NULL, p_expires_at timestamptz DEFAULT NULL)
RETURNS public.lab_rentals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE current_rental public.lab_rentals; result public.lab_rentals; action_name text;
BEGIN
  SELECT rental_row.* INTO current_rental FROM public.lab_rentals AS rental_row WHERE rental_row.id = p_rental_id FOR UPDATE;
  IF current_rental.id IS NULL THEN RAISE EXCEPTION 'Lab rental not found'; END IF;
  IF current_rental.state IN ('cancelled', 'expired') THEN RAISE EXCEPTION 'Terminal Lab rental cannot be changed'; END IF;
  IF p_action = 'start_preparing' AND current_rental.state = 'payment_pending' THEN
    UPDATE public.lab_rentals SET state = 'preparing' WHERE id = p_rental_id RETURNING * INTO result; action_name := 'start_preparing';
  ELSIF p_action = 'mark_ready' AND current_rental.state = 'preparing' THEN
    IF NOT EXISTS (SELECT 1 FROM private.lab_launch_configurations WHERE rental_id = p_rental_id) THEN RAISE EXCEPTION 'Ready rental requires launch configuration'; END IF;
    IF p_expires_at IS NULL THEN RAISE EXCEPTION 'Ready rental requires expiry'; END IF;
    IF p_expires_at <= now() OR p_expires_at <= COALESCE(p_starts_at, current_rental.starts_at, now()) THEN RAISE EXCEPTION 'Lab rental window is invalid'; END IF;
    UPDATE public.lab_rentals SET state = 'ready', starts_at = COALESCE(p_starts_at, current_rental.starts_at, now()), expires_at = p_expires_at, ready_at = now() WHERE id = p_rental_id RETURNING * INTO result; action_name := 'mark_ready';
  ELSIF p_action = 'cancel' THEN
    UPDATE public.lab_rentals SET state = 'cancelled', cancelled_at = now() WHERE id = p_rental_id RETURNING * INTO result; action_name := 'lab_rental_cancelled';
  ELSIF p_action IN ('update_schedule', 'extend') THEN
    IF current_rental.state = 'ready' AND (p_expires_at IS NULL OR p_expires_at <= now()) THEN RAISE EXCEPTION 'Ready rental requires a future expiry'; END IF;
    IF p_action = 'extend' AND (current_rental.expires_at IS NULL OR p_expires_at IS NULL OR p_expires_at <= current_rental.expires_at) THEN RAISE EXCEPTION 'Extension requires a later expiry'; END IF;
    IF p_starts_at IS NOT NULL AND p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at THEN RAISE EXCEPTION 'Lab rental window is invalid'; END IF;
    UPDATE public.lab_rentals SET starts_at = p_starts_at, expires_at = p_expires_at WHERE id = p_rental_id RETURNING * INTO result; action_name := CASE WHEN p_action = 'extend' THEN 'lab_rental_extended' ELSE 'lab_rental_schedule_updated' END;
  ELSE RAISE EXCEPTION 'Illegal lab rental transition'; END IF;
  INSERT INTO public.access_audit_events (actor_type, action, resource_type, resource_id, student_id, metadata)
  VALUES ('admin', action_name, 'lab_rental', result.id, result.user_id, pg_catalog.jsonb_build_object('labId', result.lab_id, 'previousState', current_rental.state, 'state', result.state, 'startsAt', result.starts_at, 'expiresAt', result.expires_at));
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_lab_launch_configuration(p_rental_id uuid, p_provider text, p_launch_url text)
RETURNS TABLE (rental_id uuid, provider text, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE current_rental public.lab_rentals; configured private.lab_launch_configurations; normalized_url text := pg_catalog.btrim(p_launch_url);
BEGIN
  IF p_provider IS DISTINCT FROM 'guacamole_test' OR normalized_url !~* '^https?://[^[:space:]]+$' THEN RAISE EXCEPTION 'Launch configuration is invalid'; END IF;
  SELECT rental_row.* INTO current_rental FROM public.lab_rentals AS rental_row WHERE rental_row.id = p_rental_id FOR UPDATE;
  IF current_rental.id IS NULL THEN RAISE EXCEPTION 'Lab rental not found'; END IF;
  IF current_rental.state IN ('cancelled', 'expired') THEN RAISE EXCEPTION 'Terminal Lab rental cannot be configured'; END IF;
  INSERT INTO private.lab_launch_configurations AS configurations (rental_id, provider, launch_url)
  VALUES (p_rental_id, p_provider, normalized_url)
  ON CONFLICT (rental_id) DO UPDATE SET provider = EXCLUDED.provider, launch_url = EXCLUDED.launch_url
  RETURNING configurations.* INTO configured;
  INSERT INTO public.access_audit_events (actor_type, action, resource_type, resource_id, student_id, metadata)
  VALUES ('admin', 'lab_launch_configuration_set', 'lab_rental', p_rental_id, current_rental.user_id, pg_catalog.jsonb_build_object('provider', p_provider));
  RETURN QUERY SELECT configured.rental_id, configured.provider, configured.updated_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_free_lab_rental(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_assign_lab_rental(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_lab_rental(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_lab_launch_configuration(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_lab_rental(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_assign_lab_rental(uuid, uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_lab_rental(uuid, text, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_lab_launch_configuration(uuid, text, text) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';