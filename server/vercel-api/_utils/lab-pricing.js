const PRICE_FIELDS = [
  "price_usd",
  "discounted_price_usd",
  "price_inr",
  "discounted_price_inr",
];

function parsePrice(value, field, { optional }) {
  if (value === undefined) return undefined;
  if (optional && (value === null || value === "")) return null;
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`${field} must be a decimal amount.`);
  }
  const normalized = typeof value === "string" ? value.trim() : String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${field} must be a non-negative amount with at most two decimal places.`);
  }
  const amount = Number(normalized);
  if (!Number.isSafeInteger(Math.round(amount * 100))) {
    throw new Error(`${field} is outside the supported range.`);
  }
  return amount;
}

function validateDiscount(discount, regular, currency) {
  if (discount === null || discount === undefined) return;
  if (discount <= 0) throw new Error(`Discounted Price (${currency}) must be greater than zero.`);
  if (regular === null || regular === undefined) {
    throw new Error(`Regular Price (${currency}) is required when a discounted price is set.`);
  }
  if (discount >= regular) {
    throw new Error(`Discounted Price (${currency}) must be lower than Regular Price (${currency}).`);
  }
}

function requestedOrCurrent(input, current, field) {
  return Object.hasOwn(input, field) ? input[field] : current[field];
}

export function validateLabPricing(input, current = {}) {
  const pricingRequested = PRICE_FIELDS.some((field) => Object.hasOwn(input, field));
  if (!pricingRequested) return {};

  const priceUsd = parsePrice(requestedOrCurrent(input, current, "price_usd"), "price_usd", { optional: false });
  const discountUsd = parsePrice(requestedOrCurrent(input, current, "discounted_price_usd"), "discounted_price_usd", { optional: true });
  const priceInr = parsePrice(requestedOrCurrent(input, current, "price_inr"), "price_inr", { optional: true });
  const discountInr = parsePrice(requestedOrCurrent(input, current, "discounted_price_inr"), "discounted_price_inr", { optional: true });

  if (priceUsd === undefined) throw new Error("Regular Price (USD) is required.");
  if (priceUsd < 0 || (priceInr !== null && priceInr !== undefined && priceInr < 0)) {
    throw new Error("Regular prices cannot be negative.");
  }
  validateDiscount(discountUsd, priceUsd, "USD");
  validateDiscount(discountInr, priceInr, "INR");

  return {
    price_usd: priceUsd,
    discounted_price_usd: discountUsd ?? null,
    price_inr: priceInr ?? null,
    discounted_price_inr: discountInr ?? null,
    // Keep public pages on their legacy USD display contract during this stage.
    price: priceUsd,
    discounted_price: discountUsd ?? null,
  };
}
