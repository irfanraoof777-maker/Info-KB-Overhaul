BEGIN;

CREATE TABLE public.lab_payment_orders (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider = 'razorpay'),
  market text NOT NULL CHECK (market = 'IN'),
  currency text NOT NULL CHECK (currency = 'INR'),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  regular_price_inr numeric(12,2) NOT NULL CHECK (regular_price_inr >= 0),
  discounted_price_inr numeric(12,2),
  status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating', 'created', 'provider_error', 'paid', 'failed', 'refunded')),
  receipt text NOT NULL UNIQUE CHECK (char_length(receipt) <= 40),
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text UNIQUE,
  provider_event_id text UNIQUE,
  provider_payload jsonb,
  last_provider_error text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discounted_price_inr IS NULL OR (discounted_price_inr > 0 AND discounted_price_inr < regular_price_inr)),
  CHECK ((status = 'paid') = (paid_at IS NOT NULL))
);

CREATE UNIQUE INDEX lab_payment_orders_one_open_order_idx
  ON public.lab_payment_orders (student_id, lab_id)
  WHERE status IN ('creating', 'created', 'provider_error');
CREATE INDEX lab_payment_orders_student_lab_created_idx
  ON public.lab_payment_orders (student_id, lab_id, created_at DESC);

ALTER TABLE public.lab_payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.lab_payment_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_payment_orders TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';