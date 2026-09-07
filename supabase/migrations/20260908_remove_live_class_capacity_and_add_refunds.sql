BEGIN;

-- Live classes are unlimited. Preserve all existing class, payment, and registration data.
ALTER TABLE public.live_courses DROP COLUMN IF EXISTS max_seats;

CREATE INDEX IF NOT EXISTS live_class_payment_payment_id_idx
  ON public.live_class_payment_orders (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.finalize_razorpay_live_class_payment(p_payment_order_id uuid, p_razorpay_payment_id text, p_provider_event_id text DEFAULT NULL, p_provider_payload jsonb DEFAULT NULL)
RETURNS public.live_class_registrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE o public.live_class_payment_orders; c public.live_courses; r public.live_class_registrations;
BEGIN
  SELECT * INTO o FROM public.live_class_payment_orders WHERE id = p_payment_order_id FOR UPDATE;
  IF o.id IS NULL OR o.provider <> 'razorpay' OR NULLIF(pg_catalog.btrim(p_razorpay_payment_id), '') IS NULL THEN RAISE EXCEPTION 'Payment order not found'; END IF;
  IF o.status = 'paid' THEN
    SELECT * INTO r FROM public.live_class_registrations WHERE payment_order_id = o.id;
    IF r.id IS NULL OR o.razorpay_payment_id IS DISTINCT FROM p_razorpay_payment_id THEN RAISE EXCEPTION 'Payment order is already finalized differently'; END IF;
    RETURN r;
  END IF;
  SELECT * INTO c FROM public.live_courses WHERE id = o.live_course_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'published' OR NOT c.registration_open OR NOT EXISTS (SELECT 1 FROM public.live_course_sessions WHERE live_course_id = c.id AND starts_at > now()) THEN RAISE EXCEPTION 'Registration is closed'; END IF;
  INSERT INTO public.live_class_registrations(user_id, live_course_id, payment_order_id, payment_reference, payment_status, enrollment_status)
  VALUES(o.student_id, c.id, o.id, p_razorpay_payment_id, 'paid', 'active')
  ON CONFLICT(user_id, live_course_id) DO UPDATE SET payment_order_id = EXCLUDED.payment_order_id, payment_reference = EXCLUDED.payment_reference, payment_status = 'paid', enrollment_status = 'active', updated_at = now()
  RETURNING * INTO r;
  UPDATE public.live_class_payment_orders SET status = 'paid', razorpay_payment_id = p_razorpay_payment_id, provider_event_id = coalesce(p_provider_event_id, provider_event_id), provider_payload = coalesce(p_provider_payload, provider_payload), paid_at = now(), updated_at = now() WHERE id = o.id;
  RETURN r;
END; $fn$;

CREATE OR REPLACE FUNCTION public.finalize_razorpay_live_class_refund(p_razorpay_payment_id text, p_provider_event_id text DEFAULT NULL, p_provider_payload jsonb DEFAULT NULL)
RETURNS public.live_class_registrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE o public.live_class_payment_orders; r public.live_class_registrations;
BEGIN
  SELECT * INTO o FROM public.live_class_payment_orders WHERE razorpay_payment_id = p_razorpay_payment_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Payment order not found'; END IF;
  SELECT * INTO r FROM public.live_class_registrations WHERE payment_order_id = o.id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Registration not found'; END IF;
  IF o.status = 'refunded' AND r.payment_status = 'refunded' AND r.enrollment_status = 'cancelled' THEN RETURN r; END IF;
  UPDATE public.live_class_payment_orders SET status='refunded', provider_event_id=coalesce(p_provider_event_id, provider_event_id), provider_payload=coalesce(p_provider_payload, provider_payload), updated_at=now() WHERE id=o.id;
  UPDATE public.live_class_registrations SET payment_status='refunded', enrollment_status='cancelled', updated_at=now() WHERE id=r.id RETURNING * INTO r;
  RETURN r;
END; $fn$;

REVOKE ALL ON FUNCTION public.finalize_razorpay_live_class_refund(text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_razorpay_live_class_refund(text,text,jsonb) TO service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
