const FX_ENDPOINT = "https://openexchangerates.org/api/latest.json";
export const FX_CACHE_MS = 5 * 60 * 1000;
export const FX_TIMEOUT_MS = 4 * 1000;
const UNAVAILABLE_MESSAGE = "Current INR checkout price is temporarily unavailable. Please try again shortly.";

// This cache is intentionally process-local: it only reduces requests during a
// warm serverless instance and is never used after its five-minute lifetime.
let cache;

function decimalParts(value, label, maxFractionDigits) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const match = text.match(new RegExp(`^(\\d+)(?:\\.(\\d{1,${maxFractionDigits}}))?$`));
  if (!match) throw new Error(`${label} is invalid.`);
  return { whole: match[1], fraction: match[2] ?? "" };
}
function decimalInteger(value, label, maxFractionDigits) {
  const { whole, fraction } = decimalParts(value, label, maxFractionDigits);
  return { integer: BigInt(whole + fraction), scale: BigInt(fraction.length) };
}
function usdCents(value) {
  const { whole, fraction } = decimalParts(value, "USD price", 2);
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
}
export function payableUsdPrice(lab) {
  const regular = lab?.price_usd;
  const regularCents = usdCents(regular);
  const discount = lab?.discounted_price_usd;
  if (discount !== null && discount !== undefined) {
    const discountCents = usdCents(discount);
    if (discountCents > 0n && discountCents < regularCents) return { usdAmount: String(discount), usdPriceType: "discounted" };
  }
  return { usdAmount: String(regular), usdPriceType: "regular" };
}
// INR paise = USD cents × (USD/INR rate). Divide the decimal rate only after
// multiplication, then round the exact quotient half-up to one paise.
export function usdToInrPaise(usdAmount, rateValue) {
  const cents = usdCents(usdAmount);
  const { integer: rate, scale } = decimalInteger(rateValue, "USD/INR exchange rate", 12);
  if (rate <= 0n) throw new Error("USD/INR exchange rate is invalid.");
  const denominator = 10n ** scale;
  const paise = (cents * rate + denominator / 2n) / denominator;
  if (paise <= 0n || paise > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Converted INR price is invalid.");
  return Number(paise);
}
export function inrAmountFromPaise(paise) {
  const value = BigInt(paise);
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
export function resetUsdInrRateCacheForTests() { cache = undefined; }
export async function getUsdInrRate({ request = fetch, now = () => Date.now(), timeoutMs = FX_TIMEOUT_MS } = {}) {
  const currentTime = now();
  if (cache && currentTime - cache.cachedAt < FX_CACHE_MS) return cache.value;
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  const unavailable = () => new Error(UNAVAILABLE_MESSAGE);
  if (!appId) throw unavailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request(`${FX_ENDPOINT}?app_id=${encodeURIComponent(appId)}`, { signal: controller.signal, headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.base !== "USD" || !Number.isFinite(data?.rates?.INR) || data.rates.INR <= 0 || !Number.isFinite(data?.timestamp)) throw unavailable();
    decimalInteger(String(data.rates.INR), "USD/INR exchange rate", 12);
    const value = { rate: String(data.rates.INR), provider: "openexchangerates", rateTimestamp: new Date(data.timestamp * 1000).toISOString(), fetchedAt: new Date(currentTime).toISOString() };
    cache = { cachedAt: currentTime, value };
    return value;
  } catch { throw unavailable(); } finally { clearTimeout(timer); }
}