BEGIN;

-- Historical fixed-INR records retain their original snapshots. New orders
-- instead record a complete USD-to-INR conversion snapshot.
ALTER TABLE public.lab_payment_orders
  ALTER COLUMN regular_price_inr DROP NOT NULL,
  ADD COLUMN source_usd_amount numeric(12,2),
  ADD COLUMN usd_price_type text,
  ADD COLUMN usd_inr_rate numeric(20,12),
  ADD COLUMN base_inr_amount numeric(14,2),
  ADD COLUMN fx_provider text,
  ADD COLUMN fx_rate_timestamp timestamptz,
  ADD COLUMN conversion_created_at timestamptz;

ALTER TABLE public.lab_payment_orders
  ADD CONSTRAINT lab_payment_orders_fx_snapshot_complete_check CHECK (
    (source_usd_amount IS NULL AND usd_price_type IS NULL AND usd_inr_rate IS NULL AND base_inr_amount IS NULL AND fx_provider IS NULL AND fx_rate_timestamp IS NULL AND conversion_created_at IS NULL)
    OR
    (source_usd_amount > 0 AND usd_price_type IN ('regular', 'discounted') AND usd_inr_rate > 0 AND base_inr_amount > 0 AND fx_provider = 'openexchangerates' AND fx_rate_timestamp IS NOT NULL AND conversion_created_at IS NOT NULL)
  ),
  ADD CONSTRAINT lab_payment_orders_fx_snapshot_matches_amount_check CHECK (
    source_usd_amount IS NULL OR amount_minor = (base_inr_amount * 100)::bigint
  );

COMMIT;
NOTIFY pgrst, 'reload schema';