BEGIN;

-- This table stores only a temporary login-page URL. Production launch must
-- use HTTPS and a server-side Guacamole broker that issues short-lived access.
CREATE TABLE IF NOT EXISTS private.lab_launch_configurations (
  rental_id uuid PRIMARY KEY
    REFERENCES public.lab_rentals(id) ON DELETE CASCADE,
  provider text NOT NULL
    CONSTRAINT lab_launch_configurations_provider_check
    CHECK (provider = 'guacamole_test'),
  launch_url text NOT NULL
    CONSTRAINT lab_launch_configurations_url_check
    CHECK (launch_url ~* '^https?://[^[:space:]]+$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE private.lab_launch_configurations IS
  'Temporary test login-page URLs only. Production requires HTTPS and a server-side Guacamole launch broker. Never store credentials or reusable connection secrets.';
COMMENT ON COLUMN private.lab_launch_configurations.launch_url IS
  'Temporary HTTP/HTTPS login-page URL. Local HTTP is permitted only for development testing.';

REVOKE ALL PRIVILEGES ON TABLE private.lab_launch_configurations
  FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE private.lab_launch_configurations TO service_role;

DROP TRIGGER IF EXISTS lab_launch_configurations_set_updated_at
  ON private.lab_launch_configurations;
CREATE TRIGGER lab_launch_configurations_set_updated_at
BEFORE UPDATE ON private.lab_launch_configurations
FOR EACH ROW EXECUTE FUNCTION private.set_access_updated_at();

-- Production preflight proved this table is empty with no duplicate groups.
-- One row is therefore enforced as the authoritative student/Lab identity
-- across manual, payment, migration, and free_trial sources.
ALTER TABLE public.lab_rentals DROP CONSTRAINT IF EXISTS lab_rentals_source_check;
ALTER TABLE public.lab_rentals
  ADD CONSTRAINT lab_rentals_source_check
  CHECK (source IN ('manual', 'payment', 'migration', 'free_trial'));

CREATE UNIQUE INDEX IF NOT EXISTS lab_rentals_user_lab_unique_idx
  ON public.lab_rentals (user_id, lab_id);

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
DECLARE
  target_lab public.labs;
  existing_rental public.lab_rentals;
  claimed_rental public.lab_rentals;
  effective_price numeric;
BEGIN
  IF p_student_id IS NULL OR p_lab_id IS NULL THEN
    RAISE EXCEPTION 'Free Lab claim is invalid';
  END IF;

  -- A transaction-scoped key prevents two claims from crossing the existing
  -- entitlement check when production contains non-free rental sources.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_student_id::text || ':' || p_lab_id::text, 0)
  );

  SELECT labs.* INTO target_lab
  FROM public.labs AS labs
  WHERE labs.id = p_lab_id
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

  SELECT rentals.* INTO existing_rental
  FROM public.lab_rentals AS rentals
  WHERE rentals.user_id = p_student_id
    AND rentals.lab_id = p_lab_id
  ORDER BY rentals.created_at, rentals.id
  LIMIT 1
  FOR UPDATE;

  IF existing_rental.id IS NOT NULL THEN
    RETURN QUERY SELECT
      existing_rental.id, existing_rental.user_id, existing_rental.lab_id,
      existing_rental.state, existing_rental.source, existing_rental.starts_at,
      existing_rental.expires_at, existing_rental.ready_at,
      existing_rental.cancelled_at, existing_rental.created_at,
      existing_rental.updated_at;
    RETURN;
  END IF;

  INSERT INTO public.lab_rentals (user_id, lab_id, state, source)
  VALUES (p_student_id, p_lab_id, 'preparing', 'free_trial')
  ON CONFLICT (user_id, lab_id) DO NOTHING
  RETURNING * INTO claimed_rental;

  -- A service-side Admin/payment insert does not share the claim advisory
  -- lock. If it won the full unique identity race, return it unchanged.
  IF claimed_rental.id IS NULL THEN
    SELECT rentals.* INTO claimed_rental
    FROM public.lab_rentals AS rentals
    WHERE rentals.user_id = p_student_id
      AND rentals.lab_id = p_lab_id
    FOR UPDATE;
    IF claimed_rental.id IS NULL THEN
      RAISE EXCEPTION 'Free Lab claim could not be completed';
    END IF;

    RETURN QUERY SELECT
      claimed_rental.id, claimed_rental.user_id, claimed_rental.lab_id,
      claimed_rental.state, claimed_rental.source, claimed_rental.starts_at,
      claimed_rental.expires_at, claimed_rental.ready_at,
      claimed_rental.cancelled_at, claimed_rental.created_at,
      claimed_rental.updated_at;
    RETURN;
  END IF;

  INSERT INTO public.access_audit_events (
    actor_type, actor_id, action, resource_type, resource_id, student_id, metadata
  ) VALUES (
    'system', p_student_id, 'free_lab_claimed', 'lab_rental',
    claimed_rental.id, p_student_id,
    pg_catalog.jsonb_build_object(
      'labId', p_lab_id,
      'state', claimed_rental.state,
      'source', claimed_rental.source
    )
  );

  RETURN QUERY SELECT
    claimed_rental.id, claimed_rental.user_id, claimed_rental.lab_id,
    claimed_rental.state, claimed_rental.source, claimed_rental.starts_at,
    claimed_rental.expires_at, claimed_rental.ready_at,
    claimed_rental.cancelled_at, claimed_rental.created_at,
    claimed_rental.updated_at;
END;
$function$;

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

  SELECT rentals.* INTO current_rental
  FROM public.lab_rentals AS rentals
  WHERE rentals.id = p_rental_id
  FOR UPDATE;
  IF current_rental.id IS NULL THEN RAISE EXCEPTION 'Lab rental not found'; END IF;
  IF current_rental.state = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled rental cannot be configured';
  END IF;

  INSERT INTO private.lab_launch_configurations AS configurations (
    rental_id, provider, launch_url
  ) VALUES (p_rental_id, p_provider, normalized_url)
  ON CONFLICT (rental_id) DO UPDATE SET
    provider = EXCLUDED.provider,
    launch_url = EXCLUDED.launch_url
  RETURNING configurations.* INTO configured;

  INSERT INTO public.access_audit_events (
    actor_type, action, resource_type, resource_id, student_id, metadata
  ) VALUES (
    'admin', 'lab_launch_configuration_set', 'lab_rental', p_rental_id,
    current_rental.user_id,
    pg_catalog.jsonb_build_object('provider', p_provider)
  );

  RETURN QUERY SELECT configured.rental_id, configured.provider, configured.updated_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_authorized_lab_launch(
  p_student_id uuid,
  p_rental_id uuid
)
RETURNS TABLE (provider text, launch_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_rental public.lab_rentals;
  configured private.lab_launch_configurations;
BEGIN
  SELECT rentals.* INTO current_rental
  FROM public.lab_rentals AS rentals
  WHERE rentals.id = p_rental_id
  FOR UPDATE;

  IF current_rental.id IS NULL
     OR current_rental.user_id <> p_student_id
     OR current_rental.state <> 'ready'
     OR current_rental.cancelled_at IS NOT NULL
     OR current_rental.expires_at IS NULL
     OR current_rental.expires_at <= now()
     OR (current_rental.starts_at IS NOT NULL AND current_rental.starts_at > now()) THEN
    RAISE EXCEPTION 'Lab launch is unavailable';
  END IF;

  SELECT configurations.* INTO configured
  FROM private.lab_launch_configurations AS configurations
  WHERE configurations.rental_id = p_rental_id;
  IF configured.rental_id IS NULL THEN RAISE EXCEPTION 'Lab launch is unavailable'; END IF;

  INSERT INTO public.access_audit_events (
    actor_type, actor_id, action, resource_type, resource_id, student_id, metadata
  ) VALUES (
    'system', p_student_id, 'lab_launch_requested', 'lab_rental', p_rental_id,
    p_student_id, pg_catalog.jsonb_build_object('provider', configured.provider)
  );

  RETURN QUERY SELECT configured.provider, configured.launch_url;
END;
$function$;

-- Preserve existing action names and require launch configuration before the
-- deliberate Preparing -> Ready transition.
CREATE OR REPLACE FUNCTION public.admin_update_lab_rental(
  p_rental_id uuid,
  p_action text,
  p_starts_at timestamptz DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS public.lab_rentals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_rental public.lab_rentals;
  result public.lab_rentals;
  action_name text;
BEGIN
  SELECT * INTO current_rental FROM public.lab_rentals
  WHERE id = p_rental_id FOR UPDATE;
  IF current_rental.id IS NULL THEN RAISE EXCEPTION 'Lab rental not found'; END IF;

  IF p_action = 'start_preparing' AND current_rental.state = 'payment_pending' THEN
    UPDATE public.lab_rentals SET state = 'preparing'
    WHERE id = p_rental_id RETURNING * INTO result;
    action_name := 'start_preparing';
  ELSIF p_action = 'mark_ready' AND current_rental.state = 'preparing' THEN
    IF NOT EXISTS (
      SELECT 1 FROM private.lab_launch_configurations WHERE rental_id = p_rental_id
    ) THEN RAISE EXCEPTION 'Ready rental requires launch configuration'; END IF;
    IF p_expires_at IS NULL THEN RAISE EXCEPTION 'Ready rental requires expiry'; END IF;
    IF p_expires_at <= now()
       OR p_expires_at <= COALESCE(p_starts_at, current_rental.starts_at, now()) THEN
      RAISE EXCEPTION 'Lab rental window is invalid';
    END IF;
    UPDATE public.lab_rentals SET
      state = 'ready', starts_at = COALESCE(p_starts_at, current_rental.starts_at, now()),
      expires_at = p_expires_at, ready_at = now()
    WHERE id = p_rental_id RETURNING * INTO result;
    action_name := 'mark_ready';
  ELSIF p_action = 'cancel' AND current_rental.state <> 'cancelled' THEN
    UPDATE public.lab_rentals SET state = 'cancelled', cancelled_at = now()
    WHERE id = p_rental_id RETURNING * INTO result;
    action_name := 'lab_rental_cancelled';
  ELSIF p_action IN ('update_schedule', 'extend') THEN
    IF current_rental.state = 'cancelled' THEN RAISE EXCEPTION 'Cancelled rental cannot be changed'; END IF;
    IF p_action = 'extend' AND (
      current_rental.expires_at IS NULL OR p_expires_at IS NULL
      OR p_expires_at <= current_rental.expires_at
    ) THEN RAISE EXCEPTION 'Extension requires a later expiry'; END IF;
    IF p_starts_at IS NOT NULL AND p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at THEN
      RAISE EXCEPTION 'Lab rental window is invalid';
    END IF;
    UPDATE public.lab_rentals SET starts_at = p_starts_at, expires_at = p_expires_at
    WHERE id = p_rental_id RETURNING * INTO result;
    action_name := CASE WHEN p_action = 'extend'
      THEN 'lab_rental_extended' ELSE 'lab_rental_schedule_updated' END;
  ELSE
    RAISE EXCEPTION 'Illegal lab rental transition';
  END IF;

  INSERT INTO public.access_audit_events (
    actor_type, action, resource_type, resource_id, student_id, metadata
  ) VALUES (
    'admin', action_name, 'lab_rental', result.id, result.user_id,
    pg_catalog.jsonb_build_object(
      'labId', result.lab_id, 'previousState', current_rental.state,
      'state', result.state, 'startsAt', result.starts_at,
      'expiresAt', result.expires_at
    )
  );
  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_free_lab_rental(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_lab_launch_configuration(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_authorized_lab_launch(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_lab_rental(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_lab_launch_configuration(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_authorized_lab_launch(uuid, uuid) TO service_role;

DO $verification$
DECLARE
  browser_role text;
  column_name text;
  lab_columns constant text[] := ARRAY[
    'id', 'title', 'description', 'image_url', 'category', 'duration',
    'price', 'discounted_price', 'enabled', 'created_at', 'updated_at'
  ];
  rental_columns constant text[] := ARRAY[
    'id', 'user_id', 'lab_id', 'state', 'source', 'starts_at', 'expires_at',
    'ready_at', 'cancelled_at', 'created_at', 'updated_at'
  ];
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF pg_catalog.has_schema_privilege(browser_role, 'private', 'USAGE')
       OR pg_catalog.has_table_privilege(browser_role, 'private.lab_launch_configurations', 'SELECT')
       OR pg_catalog.has_table_privilege(browser_role, 'private.lab_launch_configurations', 'INSERT')
       OR pg_catalog.has_table_privilege(browser_role, 'private.lab_launch_configurations', 'UPDATE')
       OR pg_catalog.has_table_privilege(browser_role, 'private.lab_launch_configurations', 'DELETE')
       OR pg_catalog.has_any_column_privilege(browser_role, 'private.lab_launch_configurations', 'SELECT')
       OR pg_catalog.has_any_column_privilege(browser_role, 'private.lab_launch_configurations', 'INSERT')
       OR pg_catalog.has_any_column_privilege(browser_role, 'private.lab_launch_configurations', 'UPDATE')
       OR pg_catalog.has_any_column_privilege(browser_role, 'private.lab_launch_configurations', 'REFERENCES') THEN
      RAISE EXCEPTION 'Verification failed: % can access private launch configuration', browser_role;
    END IF;

    IF pg_catalog.has_function_privilege(browser_role, 'public.claim_free_lab_rental(uuid,uuid)', 'EXECUTE')
       OR pg_catalog.has_function_privilege(browser_role, 'public.admin_set_lab_launch_configuration(uuid,text,text)', 'EXECUTE')
       OR pg_catalog.has_function_privilege(browser_role, 'public.get_authorized_lab_launch(uuid,uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'Verification failed: % can execute a server-only Lab function', browser_role;
    END IF;

    IF pg_catalog.has_table_privilege(browser_role, 'public.labs', 'SELECT') THEN
      RAISE EXCEPTION 'Verification failed: % has broad Lab catalog SELECT', browser_role;
    END IF;
    FOREACH column_name IN ARRAY lab_columns LOOP
    IF pg_catalog.has_table_privilege(browser_role, 'public.labs', 'INSERT')
       OR pg_catalog.has_table_privilege(browser_role, 'public.labs', 'UPDATE')
       OR pg_catalog.has_table_privilege(browser_role, 'public.labs', 'DELETE')
       OR pg_catalog.has_table_privilege(browser_role, 'public.labs', 'TRUNCATE')
       OR pg_catalog.has_table_privilege(browser_role, 'public.labs', 'TRIGGER')
       OR pg_catalog.has_table_privilege(browser_role, 'public.labs', 'REFERENCES')
       OR pg_catalog.has_any_column_privilege(browser_role, 'public.labs', 'INSERT')
       OR pg_catalog.has_any_column_privilege(browser_role, 'public.labs', 'UPDATE')
       OR pg_catalog.has_any_column_privilege(browser_role, 'public.labs', 'REFERENCES') THEN
      RAISE EXCEPTION 'Verification failed: % can mutate Lab catalog', browser_role;
    END IF;

      IF NOT pg_catalog.has_column_privilege(browser_role, 'public.labs', column_name, 'SELECT') THEN
        RAISE EXCEPTION 'Verification failed: % cannot select approved Labs column %', browser_role, column_name;
      END IF;
    END LOOP;
    FOR column_name IN
      SELECT attributes.attname
      FROM pg_catalog.pg_attribute AS attributes
      WHERE attributes.attrelid = 'public.labs'::regclass
        AND attributes.attnum > 0 AND NOT attributes.attisdropped
        AND NOT (attributes.attname = ANY (lab_columns))
    LOOP
      IF pg_catalog.has_column_privilege(browser_role, 'public.labs', column_name, 'SELECT') THEN
        RAISE EXCEPTION 'Verification failed: % can select non-approved Labs column %', browser_role, column_name;
      END IF;
    END LOOP;
  END LOOP;

  IF pg_catalog.has_table_privilege('authenticated', 'public.lab_rentals', 'SELECT') THEN
    RAISE EXCEPTION 'Verification failed: authenticated has broad rental SELECT';
  END IF;
  FOREACH column_name IN ARRAY rental_columns LOOP
    IF NOT pg_catalog.has_column_privilege('authenticated', 'public.lab_rentals', column_name, 'SELECT') THEN
      RAISE EXCEPTION 'Verification failed: authenticated cannot select approved rental column %', column_name;
    END IF;
  END LOOP;
  FOR column_name IN
    SELECT attributes.attname
    FROM pg_catalog.pg_attribute AS attributes
    WHERE attributes.attrelid = 'public.lab_rentals'::regclass
      AND attributes.attnum > 0 AND NOT attributes.attisdropped
      AND NOT (attributes.attname = ANY (rental_columns))
  LOOP
    IF pg_catalog.has_column_privilege('authenticated', 'public.lab_rentals', column_name, 'SELECT') THEN
      RAISE EXCEPTION 'Verification failed: authenticated can select private rental column %', column_name;
    END IF;
  END LOOP;

  IF pg_catalog.has_table_privilege('anon', 'public.lab_rentals', 'SELECT')
     OR pg_catalog.has_any_column_privilege('anon', 'public.lab_rentals', 'SELECT') THEN
    RAISE EXCEPTION 'Verification failed: anon can read rentals';
  END IF;
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF pg_catalog.has_table_privilege(browser_role, 'public.lab_rentals', 'INSERT')
       OR pg_catalog.has_table_privilege(browser_role, 'public.lab_rentals', 'UPDATE')
       OR pg_catalog.has_table_privilege(browser_role, 'public.lab_rentals', 'DELETE')
       OR pg_catalog.has_table_privilege(browser_role, 'public.lab_rentals', 'TRUNCATE')
       OR pg_catalog.has_table_privilege(browser_role, 'public.lab_rentals', 'TRIGGER')
       OR pg_catalog.has_table_privilege(browser_role, 'public.lab_rentals', 'REFERENCES')
       OR pg_catalog.has_any_column_privilege(browser_role, 'public.lab_rentals', 'INSERT')
       OR pg_catalog.has_any_column_privilege(browser_role, 'public.lab_rentals', 'UPDATE')
       OR pg_catalog.has_any_column_privilege(browser_role, 'public.lab_rentals', 'REFERENCES') THEN
      RAISE EXCEPTION 'Verification failed: % can mutate rentals', browser_role;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class AS relations
    WHERE relations.oid = 'public.lab_rentals'::regclass AND relations.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies AS policies
    WHERE policies.schemaname = 'public'
      AND policies.tablename = 'lab_rentals'
      AND policies.policyname = 'Students can read own lab rentals'
      AND policies.cmd = 'SELECT'
      AND policies.roles = ARRAY['authenticated']::name[]
      AND policies.qual = '(user_id = auth.uid())'
  ) THEN
    RAISE EXCEPTION 'Verification failed: own-rental RLS is missing';
  END IF;

  IF NOT pg_catalog.has_function_privilege('service_role', 'public.claim_free_lab_rental(uuid,uuid)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', 'public.admin_set_lab_launch_configuration(uuid,text,text)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', 'public.get_authorized_lab_launch(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: service_role cannot execute a Lab workflow function';
  END IF;
  IF pg_catalog.has_function_privilege('anon', 'public.admin_update_lab_rental(uuid,text,timestamptz,timestamptz)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.admin_update_lab_rental(uuid,text,timestamptz,timestamptz)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', 'public.admin_update_lab_rental(uuid,text,timestamptz,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: Admin rental RPC grants changed';
  END IF;
  IF pg_catalog.has_column_privilege('authenticated', 'public.courses', 'full_video_url', 'SELECT')
     OR pg_catalog.has_function_privilege('anon', 'public.get_enrolled_course_video(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: protected course video access changed';
  END IF;
END;
$verification$;

COMMIT;

NOTIFY pgrst, 'reload schema';
