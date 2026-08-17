const FX_ENDPOINT = "https://openexchangerates.org/api/latest.json";
export const FX_BUFFER_PERCENT = 2;
const CACHE_MS = 5 * 60 * 1000;
let cache;

function scaled(value, scale, label) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const match = text.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error(`${label} is invalid.`);
  return BigInt(match[1]) * (10n ** BigInt(scale)) + BigInt((match[2] ?? "").slice(0, scale).padEnd(scale, "0") || "0");
}

export function usdToInrPaise(usdAmount, rateValue) {
  const rateScale = 8, rate = scaled(rateValue, rateScale, "USD/INR exchange rate");
  if (rate <= 0n) throw new Error("USD/INR exchange rate is invalid.");
  const denominator = 10n ** BigInt(rateScale);
  return Number((scaled(usdAmount, 2, "USD price") * rate + denominator / 2n) / denominator);
}

export function usdToBufferedInrPaise(usdAmount, rateValue) {
  const rateScale = 8, rate = scaled(rateValue, rateScale, "USD/INR exchange rate");
  if (rate <= 0n) throw new Error("USD/INR exchange rate is invalid.");
  const denominator = 100n * (10n ** BigInt(rateScale));
  const paise = (scaled(usdAmount, 2, "USD price") * rate * 102n + denominator / 2n) / denominator;
  if (paise <= 0n || paise > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Converted INR price is invalid.");
  return Number(paise);
}

export function payableUsdPrice(lab) {
  const regular = lab?.price_usd, regularCents = scaled(regular, 2, "USD price"), discount = lab?.discounted_price_usd;
  if (discount !== null && discount !== undefined && scaled(discount, 2, "USD price") > 0n && scaled(discount, 2, "USD price") < regularCents) return { usdAmount: discount, usdPriceType: "discounted" };
  return { usdAmount: regular, usdPriceType: "regular" };
}

export async function getUsdInrRate({ request = fetch, now = () => Date.now() } = {}) {
  if (cache && now() - cache.cachedAt < CACHE_MS) return cache.value;
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) throw new Error("Current INR checkout price is temporarily unavailable. Please try again shortly.");
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await request(`${FX_ENDPOINT}?app_id=${encodeURIComponent(appId)}`, { signal: controller.signal, headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.base !== "USD" || !Number.isFinite(data?.rates?.INR) || data.rates.INR <= 0) throw new Error("invalid rate");
    const value = { rate: String(data.rates.INR), provider: "openexchangerates", rateTimestamp: Number.isFinite(data.timestamp) ? new Date(data.timestamp * 1000).toISOString() : null, fetchedAt: new Date(now()).toISOString() };
    cache = { cachedAt: now(), value }; return value;
  } catch { throw new Error("Current INR checkout price is temporarily unavailable. Please try again shortly."); }
  finally { clearTimeout(timer); }
}
export const FX_CACHE_MS = CACHE_MS;
