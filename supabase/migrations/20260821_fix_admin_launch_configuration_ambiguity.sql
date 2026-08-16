BEGIN;

-- The prior reclaim migration recreated this RPC with RETURNS TABLE(rental_id
-- ...), then used an unqualified conflict inference expression. In PL/pgSQL rental_id is also an
-- output variable, making the conflict inference expression ambiguous.
CREATE OR REPLACE FUNCTION public.admin_set_lab_launch_configuration(
  p_rental_id uuid,
  p_provider text,
  p_launch_url text
)
RETURNS TABLE (rental_id uuid, provider text, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_rental public.lab_rentals;
  configured private.lab_launch_configurations;
  normalized_url text := pg_catalog.btrim(p_launch_url);
BEGIN
  IF p_provider IS DISTINCT FROM 'guacamole_test'
     OR normalized_url !~* '^https?://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Launch configuration is invalid';
  END IF;

  SELECT rental_row.* INTO current_rental
  FROM public.lab_rentals AS rental_row
  WHERE rental_row.id = p_rental_id
  FOR UPDATE;
  IF current_rental.id IS NULL THEN RAISE EXCEPTION 'Lab rental not found'; END IF;
  IF current_rental.state IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'Terminal Lab rental cannot be configured';
  END IF;

  UPDATE private.lab_launch_configurations AS configuration_row
  SET provider = p_provider, launch_url = normalized_url
  WHERE configuration_row.rental_id = p_rental_id
  RETURNING configuration_row.* INTO configured;

  IF NOT FOUND THEN
    INSERT INTO private.lab_launch_configurations AS configuration_insert (
      rental_id, provider, launch_url
    ) VALUES (
      p_rental_id, p_provider, normalized_url
    )
    RETURNING configuration_insert.* INTO configured;
  END IF;

  INSERT INTO public.access_audit_events (
    actor_type, action, resource_type, resource_id, student_id, metadata
  ) VALUES (
    'admin', 'lab_launch_configuration_set', 'lab_rental', p_rental_id,
    current_rental.user_id, pg_catalog.jsonb_build_object('provider', p_provider)
  );

  RETURN QUERY SELECT configured.rental_id, configured.provider, configured.updated_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_lab_launch_configuration(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_lab_launch_configuration(uuid, text, text)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
