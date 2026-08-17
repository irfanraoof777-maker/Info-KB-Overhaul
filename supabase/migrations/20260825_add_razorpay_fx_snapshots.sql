BEGIN;

ALTER TABLE public.lab_payment_orders
  ALTER COLUMN regular_price_inr DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source_usd_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS usd_price_type text,
  ADD COLUMN IF NOT EXISTS usd_inr_rate numeric(18,8),
  ADD COLUMN IF NOT EXISTS fx_buffer_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS base_inr_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS fx_provider text,
  ADD COLUMN IF NOT EXISTS fx_rate_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_created_at timestamptz;

ALTER TABLE public.lab_payment_orders
  ADD CONSTRAINT lab_payment_orders_usd_price_type_check CHECK (usd_price_type IS NULL OR usd_price_type IN ('regular', 'discounted')),
  ADD CONSTRAINT lab_payment_orders_fx_buffer_check CHECK (fx_buffer_percent IS NULL OR fx_buffer_percent = 2),
  ADD CONSTRAINT lab_payment_orders_fx_snapshot_check CHECK (
    source_usd_amount IS NULL OR (source_usd_amount >= 0 AND usd_inr_rate > 0 AND fx_buffer_percent = 2
      AND base_inr_amount >= 0 AND fx_provider IS NOT NULL AND conversion_created_at IS NOT NULL)
  );

COMMIT;
NOTIFY pgrst, 'reload schema';