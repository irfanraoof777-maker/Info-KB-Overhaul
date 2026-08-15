BEGIN;

-- Harden existing catalog/access tables against the broad default grants found
-- in production. Public catalog SELECT is restored explicitly below.
REVOKE ALL PRIVILEGES ON TABLE public.courses FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.labs FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.enrollments FROM PUBLIC, anon, authenticated;

DO $revoke_column_privileges$
DECLARE
  target_table regclass;
  column_list text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'public.courses'::regclass,
    'public.labs'::regclass,
    'public.orders'::regclass,
    'public.enrollments'::regclass
  ]
  LOOP
    SELECT string_agg(format('%I', attributes.attname), ', ' ORDER BY attributes.attnum)
    INTO column_list
    FROM pg_catalog.pg_attribute AS attributes
    WHERE attributes.attrelid = target_table
      AND attributes.attnum > 0
      AND NOT attributes.attisdropped;

    IF column_list IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES (%s) ON TABLE %s FROM PUBLIC, anon, authenticated',
        column_list,
        target_table
      );
    END IF;
  END LOOP;
END;
$revoke_column_privileges$;

GRANT SELECT (
  id, name, category, price, description, difficulty, duration, trailer_url,
  thumbnail_url, created_at, difficulty_level, is_published, slug, updated_at,
  long_description, highlights, curriculum, who_is_it_for, instructor_name,
  instructor_bio
) ON TABLE public.courses TO anon, authenticated;

GRANT SELECT (
  id, title, description, image_url, category, duration, price,
  discounted_price, enabled, created_at, updated_at
) ON TABLE public.labs TO anon, authenticated;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Own the public catalog policies explicitly. Published-course coverage has
-- not been proven, so course visibility intentionally preserves production's
-- current TRUE expression for this checkpoint. Labs are public only when
-- enabled, even if a client forgets its own enabled filter.
DROP POLICY IF EXISTS "Allow authenticated read access on courses" ON public.courses;
DROP POLICY IF EXISTS "Allow public read access on courses" ON public.courses;
DROP POLICY IF EXISTS "Public can read course catalog" ON public.courses;
DROP POLICY IF EXISTS "Authenticated can read course catalog" ON public.courses;
CREATE POLICY "Public can read course catalog"
  ON public.courses FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can read course catalog"
  ON public.courses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated read access on labs" ON public.labs;
DROP POLICY IF EXISTS "Allow public read access on labs" ON public.labs;
DROP POLICY IF EXISTS "Public can read enabled labs" ON public.labs;
DROP POLICY IF EXISTS "Authenticated can read enabled labs" ON public.labs;
CREATE POLICY "Public can read enabled labs"
  ON public.labs FOR SELECT TO anon USING (enabled IS TRUE);
CREATE POLICY "Authenticated can read enabled labs"
  ON public.labs FOR SELECT TO authenticated USING (enabled IS TRUE);

-- Preserve existing course rows while establishing an explicit lifecycle.
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS granted_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.enrollments
SET
  status = COALESCE(status, 'active'),
  source = COALESCE(source, 'migration'),
  starts_at = COALESCE(starts_at, enrolled_at AT TIME ZONE 'UTC', now()),
  created_at = COALESCE(created_at, enrolled_at AT TIME ZONE 'UTC', now()),
  updated_at = COALESCE(updated_at, now())
WHERE status IS NULL
   OR source IS NULL
   OR starts_at IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL;

ALTER TABLE public.enrollments
  ALTER COLUMN student_id SET NOT NULL,
  ALTER COLUMN course_id SET NOT NULL,
  ALTER COLUMN enrolled_at SET DEFAULT now(),
  ALTER COLUMN enrolled_at SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN source SET DEFAULT 'manual',
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN starts_at SET DEFAULT now(),
  ALTER COLUMN starts_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $enrollment_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.enrollments'::regclass
      AND conname = 'enrollments_status_check'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_status_check
      CHECK (status IN ('active', 'revoked'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.enrollments'::regclass
      AND conname = 'enrollments_source_check'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_source_check
      CHECK (source IN ('manual', 'payment', 'migration'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.enrollments'::regclass
      AND conname = 'enrollments_time_check'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_time_check
      CHECK (expires_at IS NULL OR expires_at > starts_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.enrollments'::regclass
      AND conname = 'enrollments_student_id_fkey'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.enrollments'::regclass
      AND conname = 'enrollments_course_id_fkey'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.enrollments'::regclass
      AND conname = 'enrollments_order_id_fkey'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.enrollments'::regclass
      AND conname = 'enrollments_granted_by_fkey'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_granted_by_fkey
      FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.enrollments'::regclass
      AND conname = 'enrollments_student_course_key'
  ) THEN
    ALTER TABLE public.enrollments
      ADD CONSTRAINT enrollments_student_course_key UNIQUE (student_id, course_id);
  END IF;
END;
$enrollment_constraints$;

CREATE INDEX IF NOT EXISTS enrollments_student_access_idx
  ON public.enrollments (student_id, status, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS enrollments_course_id_idx
  ON public.enrollments (course_id);

DROP POLICY IF EXISTS "Students can read own enrollments" ON public.enrollments;
CREATE POLICY "Students can read own enrollments"
  ON public.enrollments
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

GRANT SELECT (
  id, student_id, course_id, enrolled_at, status, source, starts_at,
  expires_at, revoked_at, created_at, updated_at
) ON TABLE public.enrollments TO authenticated;

-- Orders are server-only until a verified payment implementation exists.
DROP POLICY IF EXISTS "Students can read own orders" ON public.orders;

-- Student-specific lab rentals. Expired is deliberately derived from time.
CREATE TABLE IF NOT EXISTS public.lab_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'payment_pending'
    CHECK (state IN ('payment_pending', 'preparing', 'ready', 'cancelled')),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'payment', 'migration')),
  starts_at timestamptz,
  expires_at timestamptz,
  ready_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lab_rentals_time_check
    CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at),
  CONSTRAINT lab_rentals_ready_check
    CHECK (state <> 'ready' OR ready_at IS NOT NULL),
  CONSTRAINT lab_rentals_cancelled_check
    CHECK (state <> 'cancelled' OR cancelled_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS lab_rentals_order_id_unique_idx
  ON public.lab_rentals (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lab_rentals_user_created_idx
  ON public.lab_rentals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lab_rentals_user_state_idx
  ON public.lab_rentals (user_id, state);
CREATE INDEX IF NOT EXISTS lab_rentals_lab_id_idx
  ON public.lab_rentals (lab_id);
CREATE INDEX IF NOT EXISTS lab_rentals_expires_at_idx
  ON public.lab_rentals (expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.lab_rentals ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.lab_rentals FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.lab_rentals TO service_role;

DROP POLICY IF EXISTS "Students can read own lab rentals" ON public.lab_rentals;
CREATE POLICY "Students can read own lab rentals"
  ON public.lab_rentals
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT (
  id, user_id, lab_id, state, source, starts_at, expires_at, ready_at,
  cancelled_at, created_at, updated_at
) ON TABLE public.lab_rentals TO authenticated;

-- Private future provisioning bindings. The schema is intentionally not
-- exposed to browser roles and contains references only, never credentials.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.lab_provisioning (
  rental_id uuid PRIMARY KEY REFERENCES public.lab_rentals(id) ON DELETE CASCADE,
  provider text NOT NULL,
  connection_id text,
  credential_secret_ref text,
  provisioning_state text NOT NULL DEFAULT 'pending'
    CHECK (provisioning_state IN ('pending', 'provisioning', 'ready', 'failed', 'revoked')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL PRIVILEGES ON TABLE private.lab_provisioning
  FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE private.lab_provisioning TO service_role;

-- Server-only audit log. No student/browser privileges are granted.
CREATE TABLE IF NOT EXISTS public.access_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL CHECK (actor_type IN ('admin', 'webhook', 'system')),
  actor_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('course_enrollment', 'lab_rental')),
  resource_id uuid NOT NULL,
  student_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_audit_resource_idx
  ON public.access_audit_events (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_audit_student_idx
  ON public.access_audit_events (student_id, created_at DESC);

ALTER TABLE public.access_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.access_audit_events
  FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.access_audit_events TO service_role;

-- Keep updated_at authoritative for server mutations.
CREATE OR REPLACE FUNCTION private.set_access_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.set_access_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enrollments_set_updated_at ON public.enrollments;
CREATE TRIGGER enrollments_set_updated_at
BEFORE UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION private.set_access_updated_at();

DROP TRIGGER IF EXISTS lab_rentals_set_updated_at ON public.lab_rentals;
CREATE TRIGGER lab_rentals_set_updated_at
BEFORE UPDATE ON public.lab_rentals
FOR EACH ROW EXECUTE FUNCTION private.set_access_updated_at();

DROP TRIGGER IF EXISTS lab_provisioning_set_updated_at ON private.lab_provisioning;
CREATE TRIGGER lab_provisioning_set_updated_at
BEFORE UPDATE ON private.lab_provisioning
FOR EACH ROW EXECUTE FUNCTION private.set_access_updated_at();

-- Transactional Admin access mutations. Vercel authenticates the temporary
-- Basic Admin credential before invoking these functions with service_role.
-- Each function changes access and records its audit event atomically.
CREATE OR REPLACE FUNCTION public.admin_grant_course_access(
  p_student_id uuid,
  p_course_id uuid,
  p_starts_at timestamptz,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS public.enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result public.enrollments;
  action_name text;
BEGIN
  IF p_student_id IS NULL OR p_course_id IS NULL OR p_starts_at IS NULL THEN
    RAISE EXCEPTION 'Course access request is invalid';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at THEN
    RAISE EXCEPTION 'Course access window is invalid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_student_id)
     OR NOT EXISTS (SELECT 1 FROM public.courses WHERE id = p_course_id) THEN
    RAISE EXCEPTION 'Course access request is invalid';
  END IF;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE student_id = p_student_id AND course_id = p_course_id
  ) THEN 'course_access_regranted' ELSE 'course_access_granted' END
  INTO action_name;

  INSERT INTO public.enrollments (
    student_id, course_id, enrolled_at, status, source, starts_at,
    expires_at, revoked_at, granted_by
  ) VALUES (
    p_student_id, p_course_id, now(), 'active', 'manual', p_starts_at,
    p_expires_at, NULL, NULL
  )
  ON CONFLICT (student_id, course_id) DO UPDATE SET
    status = 'active',
    source = 'manual',
    starts_at = EXCLUDED.starts_at,
    expires_at = EXCLUDED.expires_at,
    revoked_at = NULL,
    granted_by = NULL
  RETURNING * INTO result;

  INSERT INTO public.access_audit_events (
    actor_type, action, resource_type, resource_id, student_id, metadata
  ) VALUES (
    'admin', action_name, 'course_enrollment', result.id, p_student_id,
    jsonb_build_object(
      'courseId', p_course_id,
      'startsAt', p_starts_at,
      'expiresAt', p_expires_at
    )
  );
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_course_access(p_enrollment_id uuid)
RETURNS public.enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result public.enrollments;
BEGIN
  UPDATE public.enrollments
  SET status = 'revoked', revoked_at = now()
  WHERE id = p_enrollment_id
  RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Enrollment not found'; END IF;

  INSERT INTO public.access_audit_events (
    actor_type, action, resource_type, resource_id, student_id, metadata
  ) VALUES (
    'admin', 'course_access_revoked', 'course_enrollment', result.id,
    result.student_id, jsonb_build_object('courseId', result.course_id)
  );
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_course_schedule(
  p_enrollment_id uuid,
  p_starts_at timestamptz,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS public.enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result public.enrollments;
BEGIN
  IF p_starts_at IS NULL
     OR (p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at) THEN
    RAISE EXCEPTION 'Course access window is invalid';
  END IF;
  UPDATE public.enrollments
  SET starts_at = p_starts_at, expires_at = p_expires_at
  WHERE id = p_enrollment_id
  RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Enrollment not found'; END IF;

  INSERT INTO public.access_audit_events (
    actor_type, action, resource_type, resource_id, student_id, metadata
  ) VALUES (
    'admin', 'course_access_schedule_updated', 'course_enrollment', result.id,
    result.student_id,
    jsonb_build_object(
      'courseId', result.course_id,
      'startsAt', result.starts_at,
      'expiresAt', result.expires_at
    )
  );
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_assign_lab_rental(
  p_student_id uuid,
  p_lab_id uuid,
  p_starts_at timestamptz DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS public.lab_rentals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result public.lab_rentals;
BEGIN
  IF p_student_id IS NULL OR p_lab_id IS NULL
     OR (p_starts_at IS NOT NULL AND p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at) THEN
    RAISE EXCEPTION 'Lab rental request is invalid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_student_id)
     OR NOT EXISTS (SELECT 1 FROM public.labs WHERE id = p_lab_id) THEN
    RAISE EXCEPTION 'Lab rental request is invalid';
  END IF;

  INSERT INTO public.lab_rentals (
    user_id, lab_id, state, source, starts_at, expires_at, created_by
  ) VALUES (
    p_student_id, p_lab_id, 'payment_pending', 'manual',
    p_starts_at, p_expires_at, NULL
  ) RETURNING * INTO result;

  INSERT INTO public.access_audit_events (
    actor_type, action, resource_type, resource_id, student_id, metadata
  ) VALUES (
    'admin', 'lab_rental_assigned', 'lab_rental', result.id, p_student_id,
    jsonb_build_object(
      'labId', p_lab_id,
      'startsAt', p_starts_at,
      'expiresAt', p_expires_at,
      'state', 'payment_pending'
    )
  );
  RETURN result;
END;
$function$;

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
  SELECT * INTO current_rental
  FROM public.lab_rentals
  WHERE id = p_rental_id
  FOR UPDATE;
  IF current_rental.id IS NULL THEN RAISE EXCEPTION 'Lab rental not found'; END IF;

  IF p_action = 'start_preparing' AND current_rental.state = 'payment_pending' THEN
    UPDATE public.lab_rentals SET state = 'preparing'
    WHERE id = p_rental_id RETURNING * INTO result;
    action_name := 'start_preparing';
  ELSIF p_action = 'mark_ready' AND current_rental.state = 'preparing' THEN
    IF p_expires_at IS NULL THEN RAISE EXCEPTION 'Ready rental requires expiry'; END IF;
    IF p_expires_at <= now()
       OR p_expires_at <= COALESCE(p_starts_at, current_rental.starts_at, now()) THEN
      RAISE EXCEPTION 'Lab rental window is invalid';
    END IF;
    UPDATE public.lab_rentals SET
      state = 'ready',
      starts_at = COALESCE(p_starts_at, current_rental.starts_at, now()),
      expires_at = p_expires_at,
      ready_at = now()
    WHERE id = p_rental_id RETURNING * INTO result;
    action_name := 'mark_ready';
  ELSIF p_action = 'cancel' AND current_rental.state <> 'cancelled' THEN
    UPDATE public.lab_rentals SET state = 'cancelled', cancelled_at = now()
    WHERE id = p_rental_id RETURNING * INTO result;
    action_name := 'lab_rental_cancelled';
  ELSIF p_action IN ('update_schedule', 'extend') THEN
    IF current_rental.state = 'cancelled' THEN
      RAISE EXCEPTION 'Cancelled rental cannot be changed';
    END IF;
    IF p_action = 'extend' AND (
      current_rental.expires_at IS NULL
      OR p_expires_at IS NULL
      OR p_expires_at <= current_rental.expires_at
    ) THEN
      RAISE EXCEPTION 'Extension requires a later expiry';
    END IF;
    IF p_starts_at IS NOT NULL AND p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at THEN
      RAISE EXCEPTION 'Lab rental window is invalid';
    END IF;
    UPDATE public.lab_rentals SET
      starts_at = p_starts_at,
      expires_at = p_expires_at
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
    jsonb_build_object(
      'labId', result.lab_id,
      'previousState', current_rental.state,
      'state', result.state,
      'startsAt', result.starts_at,
      'expiresAt', result.expires_at
    )
  );
  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_grant_course_access(uuid, uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_course_access(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_course_schedule(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_assign_lab_rental(uuid, uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_lab_rental(uuid, text, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_course_access(uuid, uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_course_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_course_schedule(uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_assign_lab_rental(uuid, uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_lab_rental(uuid, text, timestamptz, timestamptz) TO service_role;

-- Preserve the existing secure-video contract while adding full lifecycle
-- authorization. Identity continues to come only from auth.uid().
-- Limitation: this signature returns the configured URL to an authorized
-- browser. Permanent-URL replay cannot be eliminated until video delivery is
-- replaced by short-lived signed media authorization in a later checkpoint.
CREATE OR REPLACE FUNCTION public.get_enrolled_course_video(p_course_id uuid)
RETURNS TABLE (
  course_id uuid,
  video_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Course video unavailable';
  END IF;

  RETURN QUERY
  SELECT courses.id, courses.full_video_url
  FROM public.courses AS courses
  WHERE courses.id = p_course_id
    AND NULLIF(courses.full_video_url, '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.enrollments AS enrollments
      WHERE enrollments.student_id = caller_id
        AND enrollments.course_id = courses.id
        AND enrollments.status = 'active'
        AND enrollments.starts_at <= now()
        AND (enrollments.expires_at IS NULL OR enrollments.expires_at > now())
        AND enrollments.revoked_at IS NULL
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course video unavailable';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_enrolled_course_video(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_enrolled_course_video(uuid) TO authenticated;

-- Verification assertions: fail the transaction if the intended boundaries
-- are not present after a run.
DO $verification$
DECLARE
  browser_role text;
  catalog_table regclass;
BEGIN
  IF has_table_privilege('anon', 'public.enrollments', 'SELECT') THEN
    RAISE EXCEPTION 'Verification failed: anon can select enrollments';
  END IF;
  IF has_table_privilege('authenticated', 'public.enrollments', 'INSERT')
     OR has_table_privilege('authenticated', 'public.enrollments', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.enrollments', 'DELETE') THEN
    RAISE EXCEPTION 'Verification failed: authenticated can mutate enrollments';
  END IF;
  IF has_table_privilege('anon', 'public.orders', 'SELECT')
     OR has_table_privilege('authenticated', 'public.orders', 'SELECT')
     OR has_table_privilege('anon', 'public.orders', 'INSERT')
     OR has_table_privilege('authenticated', 'public.orders', 'INSERT') THEN
    RAISE EXCEPTION 'Verification failed: browser roles retain orders access';
  END IF;
  IF has_table_privilege('anon', 'public.lab_rentals', 'SELECT') THEN
    RAISE EXCEPTION 'Verification failed: anon can select lab rentals';
  END IF;
  IF has_table_privilege('authenticated', 'public.lab_rentals', 'INSERT')
     OR has_table_privilege('authenticated', 'public.lab_rentals', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.lab_rentals', 'DELETE') THEN
    RAISE EXCEPTION 'Verification failed: authenticated can mutate lab rentals';
  END IF;
  IF has_schema_privilege('anon', 'private', 'USAGE')
     OR has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'Verification failed: browser role can use private schema';
  END IF;
  IF has_column_privilege('anon', 'public.courses', 'full_video_url', 'SELECT')
     OR has_column_privilege('authenticated', 'public.courses', 'full_video_url', 'SELECT') THEN
    RAISE EXCEPTION 'Verification failed: protected course URL is selectable';
  END IF;
  IF has_function_privilege('anon', 'public.get_enrolled_course_video(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: anon can execute protected video function';
  END IF;

  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    FOREACH catalog_table IN ARRAY ARRAY[
      'public.courses'::regclass,
      'public.labs'::regclass,
      'public.orders'::regclass,
      'public.enrollments'::regclass,
      'public.lab_rentals'::regclass
    ]
    LOOP
      IF has_table_privilege(browser_role, catalog_table, 'INSERT')
         OR has_table_privilege(browser_role, catalog_table, 'UPDATE')
         OR has_table_privilege(browser_role, catalog_table, 'DELETE')
         OR has_table_privilege(browser_role, catalog_table, 'TRUNCATE')
         OR has_table_privilege(browser_role, catalog_table, 'TRIGGER')
         OR has_table_privilege(browser_role, catalog_table, 'REFERENCES')
         OR has_any_column_privilege(browser_role, catalog_table, 'INSERT')
         OR has_any_column_privilege(browser_role, catalog_table, 'UPDATE')
         OR has_any_column_privilege(browser_role, catalog_table, 'REFERENCES') THEN
        RAISE EXCEPTION 'Verification failed: % can mutate %', browser_role, catalog_table;
      END IF;
    END LOOP;
  END LOOP;

  IF has_any_column_privilege('anon', 'public.enrollments', 'SELECT')
     OR has_any_column_privilege('anon', 'public.lab_rentals', 'SELECT')
     OR has_any_column_privilege('anon', 'public.orders', 'SELECT')
     OR has_any_column_privilege('authenticated', 'public.orders', 'SELECT') THEN
    RAISE EXCEPTION 'Verification failed: browser role can read private access/order data';
  END IF;

  IF has_function_privilege('anon', 'public.admin_grant_course_access(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_grant_course_access(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_revoke_course_access(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_revoke_course_access(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_update_course_schedule(uuid,timestamptz,timestamptz)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_update_course_schedule(uuid,timestamptz,timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_assign_lab_rental(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_assign_lab_rental(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_update_lab_rental(uuid,text,timestamptz,timestamptz)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_update_lab_rental(uuid,text,timestamptz,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: browser role can execute an Admin access function';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.admin_grant_course_access(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.admin_revoke_course_access(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.admin_update_course_schedule(uuid,timestamptz,timestamptz)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.admin_assign_lab_rental(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.admin_update_lab_rental(uuid,text,timestamptz,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: service_role cannot execute an Admin access function';
  END IF;
END;
$verification$;

COMMIT;

NOTIFY pgrst, 'reload schema';
