BEGIN;

ALTER TABLE public.lab_payment_orders
  ADD COLUMN IF NOT EXISTS rental_id uuid UNIQUE REFERENCES public.lab_rentals(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

CREATE OR REPLACE FUNCTION public.finalize_razorpay_lab_payment(
  p_payment_order_id uuid,
  p_razorpay_payment_id text,
  p_provider_event_id text DEFAULT NULL,
  p_provider_payload jsonb DEFAULT NULL
)
RETURNS public.lab_rentals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_order public.lab_payment_orders;
  current_rental public.lab_rentals;
  created_rental public.lab_rentals;
BEGIN
  IF p_payment_order_id IS NULL OR NULLIF(pg_catalog.btrim(p_razorpay_payment_id), '') IS NULL THEN
    RAISE EXCEPTION 'Payment finalization is invalid';
  END IF;

  -- The order row makes browser and webhook retries for one payment idempotent.
  SELECT payment_order.* INTO current_order
  FROM public.lab_payment_orders AS payment_order
  WHERE payment_order.id = p_payment_order_id
  FOR UPDATE;
  IF current_order.id IS NULL OR current_order.provider <> 'razorpay' OR current_order.market <> 'IN'
     OR current_order.currency <> 'INR' THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;

  IF current_order.status = 'paid' THEN
    IF current_order.razorpay_payment_id IS DISTINCT FROM p_razorpay_payment_id OR current_order.rental_id IS NULL THEN
      RAISE EXCEPTION 'Payment order is already finalized differently';
    END IF;
    SELECT rental.* INTO created_rental FROM public.lab_rentals AS rental WHERE rental.id = current_order.rental_id;
    IF created_rental.id IS NULL THEN RAISE EXCEPTION 'Finalized rental is missing'; END IF;
    RETURN created_rental;
  END IF;

  -- All entitlement creators use this same key.  It serializes separate payment
  -- orders and prevents a webhook/browser race from creating two rentals.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_order.student_id::text || ':' || current_order.lab_id::text, 0)
  );

  -- A ready rental is only made terminal when it is already expired; preparing,
  -- payment_pending, and legitimate ready rentals are never changed here.
  UPDATE public.lab_rentals AS rental
  SET state = 'expired', updated_at = now()
  WHERE rental.user_id = current_order.student_id AND rental.lab_id = current_order.lab_id
    AND rental.state = 'ready' AND rental.expires_at IS NOT NULL AND rental.expires_at <= now();

  SELECT rental.* INTO current_rental
  FROM public.lab_rentals AS rental
  WHERE rental.user_id = current_order.student_id AND rental.lab_id = current_order.lab_id
    AND rental.state IN ('payment_pending', 'preparing', 'ready')
  ORDER BY rental.created_at DESC, rental.id DESC
  LIMIT 1
  FOR UPDATE;
  IF current_rental.id IS NOT NULL THEN
    RAISE EXCEPTION 'Student already has a current Lab rental';
  END IF;

  INSERT INTO public.lab_rentals (user_id, lab_id, state, source)
  VALUES (current_order.student_id, current_order.lab_id, 'preparing', 'payment')
  RETURNING * INTO created_rental;

  UPDATE public.lab_payment_orders
  SET status = 'paid', razorpay_payment_id = p_razorpay_payment_id,
      provider_event_id = COALESCE(p_provider_event_id, provider_event_id),
      provider_payload = COALESCE(p_provider_payload, provider_payload),
      rental_id = created_rental.id, paid_at = now(), finalized_at = now(),
      updated_at = now(), last_provider_error = NULL
  WHERE id = current_order.id;

  INSERT INTO public.access_audit_events (actor_type, actor_id, action, resource_type, resource_id, student_id, metadata)
  VALUES ('system', current_order.student_id, 'razorpay_lab_payment_verified', 'lab_rental', created_rental.id,
    current_order.student_id, pg_catalog.jsonb_build_object('labId', current_order.lab_id, 'paymentOrderId', current_order.id, 'provider', 'razorpay'));
  RETURN created_rental;
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_razorpay_lab_payment(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_razorpay_lab_payment(uuid, text, text, jsonb) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';