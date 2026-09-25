BEGIN;

-- New Live Training prices are authored in USD. Keep legacy INR prices intact
-- so existing trainings and their historic orders remain valid.
ALTER TABLE public.live_courses
  ADD COLUMN IF NOT EXISTS price_usd numeric(12,2),
  ADD CONSTRAINT live_courses_price_usd_nonnegative_check
    CHECK (price_usd IS NULL OR price_usd >= 0);

-- Store the immutable conversion snapshot used for each INR Razorpay order.
ALTER TABLE public.live_class_payment_orders
  ADD COLUMN IF NOT EXISTS source_usd_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS usd_inr_rate numeric(18,10),
  ADD COLUMN IF NOT EXISTS base_inr_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS fx_provider text,
  ADD COLUMN IF NOT EXISTS fx_rate_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_created_at timestamptz;

GRANT SELECT (price_usd) ON TABLE public.live_courses TO anon, authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';