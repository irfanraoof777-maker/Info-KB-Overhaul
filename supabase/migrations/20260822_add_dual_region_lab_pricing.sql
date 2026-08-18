BEGIN;

-- Legacy price and discounted_price remain USD compatibility columns until
-- every reader has moved to the explicit regional fields below.
ALTER TABLE public.labs
  ADD COLUMN IF NOT EXISTS price_usd numeric(12,2),
  ADD COLUMN IF NOT EXISTS discounted_price_usd numeric(12,2),
  ADD COLUMN IF NOT EXISTS price_inr numeric(12,2),
  ADD COLUMN IF NOT EXISTS discounted_price_inr numeric(12,2);

-- Never reinterpret legacy values as INR or derive INR from an exchange rate.
-- A negative or missing legacy regular price cannot be copied into a safe
-- authoritative USD field, so stop before changing any rows and require a
-- deliberate correction of the legacy data.
DO $preflight$
DECLARE
  invalid_regular_price_count integer;
BEGIN
  SELECT count(*) INTO invalid_regular_price_count
  FROM public.labs
  WHERE price IS NULL OR price < 0;

  IF invalid_regular_price_count > 0 THEN
    RAISE EXCEPTION
      'Dual-region Lab pricing migration stopped: % Lab rows have a missing or negative legacy USD price',
      invalid_regular_price_count;
  END IF;
END;
$preflight$;

-- Preserve every valid legacy USD price exactly. Invalid legacy discounts are
-- deliberately not promoted: the old value remains available in the legacy
-- column for audit, while the new authoritative discount is NULL.
UPDATE public.labs
SET
  price_usd = price,
  discounted_price_usd = CASE
    WHEN discounted_price IS NOT NULL
      AND discounted_price > 0
      AND discounted_price < price
      THEN discounted_price
    ELSE NULL
  END,
  price_inr = NULL,
  discounted_price_inr = NULL
WHERE price_usd IS NULL
   OR discounted_price_usd IS NULL
   OR price_inr IS NOT NULL
   OR discounted_price_inr IS NOT NULL;

DO $audit$
DECLARE
  invalid_discount_count integer;
BEGIN
  SELECT count(*) INTO invalid_discount_count
  FROM public.labs
  WHERE discounted_price IS NOT NULL
    AND NOT (discounted_price > 0 AND discounted_price < price);

  IF invalid_discount_count > 0 THEN
    RAISE NOTICE
      'Dual-region Lab pricing: % legacy USD discounts were invalid and were retained only in discounted_price; discounted_price_usd was set to NULL',
      invalid_discount_count;
  END IF;
END;
$audit$;

ALTER TABLE public.labs
  ALTER COLUMN price_usd SET NOT NULL,
  ADD CONSTRAINT labs_price_usd_nonnegative_check
    CHECK (price_usd >= 0),
  ADD CONSTRAINT labs_discounted_price_usd_valid_check
    CHECK (
      discounted_price_usd IS NULL
      OR (discounted_price_usd > 0 AND discounted_price_usd < price_usd)
    ),
  ADD CONSTRAINT labs_price_inr_nonnegative_check
    CHECK (price_inr IS NULL OR price_inr >= 0),
  ADD CONSTRAINT labs_discounted_price_inr_valid_check
    CHECK (
      discounted_price_inr IS NULL
      OR (
        price_inr IS NOT NULL
        AND discounted_price_inr > 0
        AND discounted_price_inr < price_inr
      )
    );

-- Catalog display needs read access only. Existing mutation revocations remain
-- in force; this grants no INSERT, UPDATE, or DELETE rights.
GRANT SELECT (
  price_usd, discounted_price_usd, price_inr, discounted_price_inr
) ON TABLE public.labs TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
