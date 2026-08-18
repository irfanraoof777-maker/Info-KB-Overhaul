BEGIN;
CREATE TABLE public.paid_lab_notification_outbox (
 rental_id uuid PRIMARY KEY REFERENCES public.lab_rentals(id) ON DELETE RESTRICT,
 payment_order_id uuid NOT NULL UNIQUE REFERENCES public.lab_payment_orders(id) ON DELETE RESTRICT,
 reservation_token uuid, reserved_at timestamptz, sent_at timestamptz,
 attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0), last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.paid_lab_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.paid_lab_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paid_lab_notification_outbox TO service_role;
CREATE OR REPLACE FUNCTION public.enqueue_paid_lab_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' AND NEW.rental_id IS NOT NULL THEN INSERT INTO public.paid_lab_notification_outbox (rental_id, payment_order_id) VALUES (NEW.rental_id, NEW.id) ON CONFLICT DO NOTHING; END IF; RETURN NEW; END; $function$;
CREATE TRIGGER lab_payment_orders_enqueue_paid_notification AFTER UPDATE OF status ON public.lab_payment_orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_paid_lab_notification();
CREATE OR REPLACE FUNCTION public.reserve_paid_lab_notification(p_rental_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE notification public.paid_lab_notification_outbox; token uuid; BEGIN SELECT * INTO notification FROM public.paid_lab_notification_outbox WHERE rental_id = p_rental_id FOR UPDATE; IF notification.rental_id IS NULL OR notification.sent_at IS NOT NULL OR (notification.reserved_at IS NOT NULL AND notification.reserved_at > pg_catalog.now() - interval '5 minutes') THEN RETURN NULL; END IF; token := pg_catalog.gen_random_uuid(); UPDATE public.paid_lab_notification_outbox SET reservation_token=token, reserved_at=pg_catalog.now(), attempt_count=attempt_count+1, updated_at=pg_catalog.now() WHERE rental_id=p_rental_id; RETURN token; END; $function$;
CREATE OR REPLACE FUNCTION public.complete_paid_lab_notification(p_rental_id uuid, p_reservation_token uuid, p_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN UPDATE public.paid_lab_notification_outbox SET sent_at=CASE WHEN p_error IS NULL THEN pg_catalog.now() ELSE NULL END, last_error=p_error, updated_at=pg_catalog.now() WHERE rental_id=p_rental_id AND reservation_token=p_reservation_token AND sent_at IS NULL; END; $function$;
REVOKE ALL ON FUNCTION public.enqueue_paid_lab_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_paid_lab_notification(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_paid_lab_notification(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_paid_lab_notification(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_paid_lab_notification(uuid, uuid, text) TO service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
