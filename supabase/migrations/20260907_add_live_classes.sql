BEGIN;

CREATE TABLE IF NOT EXISTS public.live_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) > 0),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  thumbnail_url text,
  instructor text NOT NULL DEFAULT 'InfoKB',
  instructor_bio text NOT NULL DEFAULT '',
  price_inr numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_inr >= 0),
  max_seats integer NOT NULL CHECK (max_seats > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled','completed')),
  registration_open boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb,
  what_you_learn jsonb NOT NULL DEFAULT '[]'::jsonb,
  curriculum jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_course_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_course_id uuid NOT NULL REFERENCES public.live_courses(id) ON DELETE CASCADE,
  session_title text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  meeting_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_class_payment_orders (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  live_course_id uuid NOT NULL REFERENCES public.live_courses(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider = 'razorpay'),
  currency text NOT NULL CHECK (currency = 'INR'),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','created','provider_error','paid','failed','refunded')),
  receipt text NOT NULL UNIQUE CHECK (char_length(receipt) <= 40),
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text UNIQUE,
  provider_event_id text UNIQUE,
  provider_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_class_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  live_course_id uuid NOT NULL REFERENCES public.live_courses(id) ON DELETE RESTRICT,
  payment_order_id uuid UNIQUE REFERENCES public.live_class_payment_orders(id) ON DELETE RESTRICT,
  payment_reference text UNIQUE,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  enrollment_status text NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active','cancelled','completed')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, live_course_id)
);

CREATE INDEX IF NOT EXISTS live_course_sessions_upcoming_idx ON public.live_course_sessions (starts_at, live_course_id);
CREATE INDEX IF NOT EXISTS live_courses_catalog_idx ON public.live_courses (status, registration_open, featured);
CREATE INDEX IF NOT EXISTS live_class_registration_course_idx ON public.live_class_registrations (live_course_id, enrollment_status, payment_status);
CREATE UNIQUE INDEX IF NOT EXISTS live_class_payment_open_idx ON public.live_class_payment_orders (student_id, live_course_id) WHERE status IN ('creating','created','provider_error');

CREATE OR REPLACE FUNCTION private.set_live_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $fn$;
DROP TRIGGER IF EXISTS live_courses_updated_at ON public.live_courses;
CREATE TRIGGER live_courses_updated_at BEFORE UPDATE ON public.live_courses FOR EACH ROW EXECUTE FUNCTION private.set_live_updated_at();
DROP TRIGGER IF EXISTS live_sessions_updated_at ON public.live_course_sessions;
CREATE TRIGGER live_sessions_updated_at BEFORE UPDATE ON public.live_course_sessions FOR EACH ROW EXECUTE FUNCTION private.set_live_updated_at();
DROP TRIGGER IF EXISTS live_registrations_updated_at ON public.live_class_registrations;
CREATE TRIGGER live_registrations_updated_at BEFORE UPDATE ON public.live_class_registrations FOR EACH ROW EXECUTE FUNCTION private.set_live_updated_at();

ALTER TABLE public.live_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_course_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.live_courses, public.live_course_sessions, public.live_class_registrations, public.live_class_payment_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.live_courses TO anon, authenticated;
GRANT SELECT (id, live_course_id, session_title, starts_at, ends_at, timezone, created_at, updated_at) ON public.live_course_sessions TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.live_courses, public.live_course_sessions, public.live_class_registrations, public.live_class_payment_orders TO service_role;
CREATE POLICY "Published live courses are public" ON public.live_courses FOR SELECT USING (status = 'published');
CREATE POLICY "Published live sessions are public" ON public.live_course_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM public.live_courses c WHERE c.id = live_course_id AND c.status = 'published'));

CREATE OR REPLACE FUNCTION public.get_live_session_join_info(p_session_id uuid)
RETURNS TABLE(session_id uuid, meeting_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Live session unavailable'; END IF;
  RETURN QUERY SELECT s.id, s.meeting_url FROM public.live_course_sessions s
  WHERE s.id = p_session_id AND NULLIF(s.meeting_url, '') IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.live_class_registrations r WHERE r.user_id = auth.uid() AND r.live_course_id = s.live_course_id AND r.payment_status = 'paid' AND r.enrollment_status = 'active');
  IF NOT FOUND THEN RAISE EXCEPTION 'Live session unavailable'; END IF;
END; $fn$;
REVOKE ALL ON FUNCTION public.get_live_session_join_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_session_join_info(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_razorpay_live_class_payment(p_payment_order_id uuid, p_razorpay_payment_id text, p_provider_event_id text DEFAULT NULL, p_provider_payload jsonb DEFAULT NULL)
RETURNS public.live_class_registrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE o public.live_class_payment_orders; c public.live_courses; r public.live_class_registrations; seats integer;
BEGIN
  SELECT * INTO o FROM public.live_class_payment_orders WHERE id=p_payment_order_id FOR UPDATE;
  IF o.id IS NULL OR o.provider <> 'razorpay' THEN RAISE EXCEPTION 'Payment order not found'; END IF;
  IF o.status='paid' THEN
    SELECT * INTO r FROM public.live_class_registrations WHERE payment_order_id=o.id;
    IF r.id IS NULL OR o.razorpay_payment_id IS DISTINCT FROM p_razorpay_payment_id THEN RAISE EXCEPTION 'Payment order is already finalized differently'; END IF;
    RETURN r;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(o.live_course_id::text, 0));
  SELECT * INTO c FROM public.live_courses WHERE id=o.live_course_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'published' OR NOT c.registration_open OR NOT EXISTS (SELECT 1 FROM public.live_course_sessions WHERE live_course_id=c.id AND starts_at > now()) THEN RAISE EXCEPTION 'Registration is closed'; END IF;
  SELECT count(*) INTO seats FROM public.live_class_registrations WHERE live_course_id=c.id AND payment_status='paid' AND enrollment_status='active';
  IF seats >= c.max_seats AND NOT EXISTS (SELECT 1 FROM public.live_class_registrations WHERE user_id=o.student_id AND live_course_id=c.id) THEN RAISE EXCEPTION 'Class is full'; END IF;
  INSERT INTO public.live_class_registrations(user_id,live_course_id,payment_order_id,payment_reference,payment_status,enrollment_status)
  VALUES(o.student_id,c.id,o.id,p_razorpay_payment_id,'paid','active')
  ON CONFLICT(user_id,live_course_id) DO UPDATE SET payment_order_id=EXCLUDED.payment_order_id,payment_reference=EXCLUDED.payment_reference,payment_status='paid',enrollment_status='active',updated_at=now()
  RETURNING * INTO r;
  UPDATE public.live_class_payment_orders SET status='paid',razorpay_payment_id=p_razorpay_payment_id,provider_event_id=coalesce(p_provider_event_id,provider_event_id),provider_payload=coalesce(p_provider_payload,provider_payload),paid_at=now(),updated_at=now() WHERE id=o.id;
  RETURN r;
END; $fn$;
REVOKE ALL ON FUNCTION public.finalize_razorpay_live_class_payment(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_razorpay_live_class_payment(uuid,text,text,jsonb) TO service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
