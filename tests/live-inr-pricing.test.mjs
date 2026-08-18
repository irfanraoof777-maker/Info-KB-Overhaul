import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRazorpayLabOrderHandler } from "../server/vercel-api/razorpay-lab-orders.js";
import { FX_CACHE_MS, FX_TIMEOUT_MS, getUsdInrRate, payableUsdPrice, resetUsdInrRateCacheForTests, usdToInrPaise } from "../server/vercel-api/_utils/usd-inr-rate.js";

const source = readFileSync("server/vercel-api/razorpay-lab-orders.js", "utf8");
const utility = readFileSync("server/vercel-api/_utils/usd-inr-rate.js", "utf8");
const migration = readFileSync("supabase/migrations/20260827_add_razorpay_live_fx_snapshots.sql", "utf8");
const verification = readFileSync("server/vercel-api/razorpay-payment-verification.js", "utf8");
const email = readFileSync("server/vercel-api/_utils/paid-lab-notification.js", "utf8");
const labDetail = readFileSync("artifacts/infokb/src/pages/LabDetail.tsx", "utf8");
const LAB_ID = "f5507a29-b7fc-4d7a-b027-52921a9d679c";
const STUDENT_ID = "04e3d8ae-bbb9-4c9b-847f-34e74ca2c688";

function response() { return { statusCode: 200, body: undefined, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function query(result) { const chain = { select() { return chain; }, eq() { return chain; }, in() { return chain; }, order() { return chain; }, limit() { return chain; }, maybeSingle: async () => result }; return chain; }
function checkoutSupabase({ lab, existingOrder = null, onInsert = () => {} }) {
  return { from(table) {
    if (table === "labs") return query({ data: lab, error: null });
    if (table === "lab_rentals") { const rentals = { select() { return rentals; }, eq() { return rentals; }, in: async () => ({ data: [], error: null }) }; return rentals; }
    if (table !== "lab_payment_orders") throw new Error(`Unexpected table ${table}`);
    const orders = query({ data: existingOrder, error: null });
    orders.insert = ([record]) => ({ select() { return { single: async () => { onInsert(record); return { data: { ...record, razorpay_order_id: null }, error: null }; } }; } });
    orders.update = () => ({ eq() { return { select() { return { single: async () => ({ data: { id: LAB_ID, receipt: `lpo_${LAB_ID.replaceAll("-", "")}`, amount_minor: 1914438, currency: "INR", razorpay_order_id: "order_provider", status: "created" }, error: null }) }; } }; } });
    return orders;
  } };
}
function authenticated(supabase) { return async () => ({ user: { id: STUDENT_ID }, supabase }); }
async function withRazorpayConfig(run) { const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET; process.env.RAZORPAY_KEY_ID = "key_test"; process.env.RAZORPAY_KEY_SECRET = "secret_test"; try { await run(); } finally { if (id === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = id; if (secret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = secret; } }

test("USD pricing selects only a genuine lower positive discount", () => {
  assert.deepEqual(payableUsdPrice({ price_usd: "200.00", discounted_price_usd: null }), { usdAmount: "200.00", usdPriceType: "regular" });
  assert.deepEqual(payableUsdPrice({ price_usd: "200.00", discounted_price_usd: "150.00" }), { usdAmount: "150.00", usdPriceType: "discounted" });
  for (const discount of ["200.00", "201.00", "0.00"]) assert.equal(payableUsdPrice({ price_usd: "200.00", discounted_price_usd: discount }).usdPriceType, "regular");
  assert.throws(() => payableUsdPrice({ price_usd: "2.001" }), /USD price is invalid/);
});

test("direct BigInt conversion is exact and half-up to paise without a buffer", () => {
  assert.equal(usdToInrPaise("200.00", "95.7219"), 1914438);
  assert.equal(usdToInrPaise("0.01", "1.49"), 1);
  assert.equal(usdToInrPaise("0.01", "1.50"), 2);
  assert.equal(usdToInrPaise("0.01", "1.51"), 2);
  for (const rate of ["0", "-1", "NaN", "1.1234567890123"]) assert.throws(() => usdToInrPaise("1.00", rate), /exchange rate is invalid/);
  assert.throws(() => usdToInrPaise("1.001", "95.7219"), /USD price is invalid/);
  assert.doesNotMatch(`${source}\n${utility}\n${migration}`, /FX_BUFFER_PERCENT|fx_buffer_percent|1\.0025|usdToBuffered|buffered/i);
});

test("Open Exchange Rates fails closed, times out, and caches only for five minutes", async () => {
  const previous = process.env.OPEN_EXCHANGE_RATES_APP_ID; process.env.OPEN_EXCHANGE_RATES_APP_ID = "test"; resetUsdInrRateCacheForTests();
  try {
    let calls = 0; let clock = 1000;
    const request = async () => ({ ok: true, json: async () => ({ base: "USD", rates: { INR: 95.7219 }, timestamp: 100 }) });
    await getUsdInrRate({ request: async (...args) => { calls++; return request(...args); }, now: () => clock });
    await getUsdInrRate({ request: async (...args) => { calls++; return request(...args); }, now: () => clock + FX_CACHE_MS - 1 });
    assert.equal(calls, 1);
    await getUsdInrRate({ request: async (...args) => { calls++; return request(...args); }, now: () => clock + FX_CACHE_MS });
    assert.equal(calls, 2);
    for (const payload of [{ base: "EUR", rates: { INR: 1 }, timestamp: 1 }, { base: "USD", rates: {}, timestamp: 1 }, { base: "USD", rates: { INR: 0 }, timestamp: 1 }]) { resetUsdInrRateCacheForTests(); await assert.rejects(getUsdInrRate({ request: async () => ({ ok: true, json: async () => payload }), now: () => 1 }), /temporarily unavailable/); }
    resetUsdInrRateCacheForTests(); await assert.rejects(getUsdInrRate({ request: async () => ({ ok: false, json: async () => ({}) }), now: () => 1 }), /temporarily unavailable/);
    resetUsdInrRateCacheForTests(); await assert.rejects(getUsdInrRate({ request: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))), now: () => 1, timeoutMs: 1 }), /temporarily unavailable/);
    assert.equal(FX_TIMEOUT_MS, 4000);
  } finally { if (previous === undefined) delete process.env.OPEN_EXCHANGE_RATES_APP_ID; else process.env.OPEN_EXCHANGE_RATES_APP_ID = previous; resetUsdInrRateCacheForTests(); }
  await assert.rejects(getUsdInrRate({ request: async () => { throw new Error("must not fetch"); } }), /temporarily unavailable/);
});

test("a reused open order bypasses FX and preserves its locked amount", async () => {
  await withRazorpayConfig(async () => {
    const existingOrder = { id: "internal-order", receipt: "lpo_test", amount_minor: 1914438, currency: "INR", razorpay_order_id: "order_existing", status: "created", usd_inr_rate: "95.7219" };
    const handler = createRazorpayLabOrderHandler({ authenticate: authenticated(checkoutSupabase({ lab: { id: LAB_ID, title: "Lab", price_usd: "200.00", discounted_price_usd: null }, existingOrder })), getFxRate: async () => { throw new Error("FX must not be called"); } });
    const res = response(); await handler({ method: "POST", body: { labId: LAB_ID } }, res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.order.amount, 1914438); assert.equal(res.body.order.razorpayOrderId, "order_existing");
  });
});

test("a new paid order stores a complete direct FX snapshot and sends integer paise", async () => {
  await withRazorpayConfig(async () => {
    let inserted; const requests = [];
    const handler = createRazorpayLabOrderHandler({
      authenticate: authenticated(checkoutSupabase({ lab: { id: LAB_ID, title: "Lab", price_usd: "200.00", discounted_price_usd: null }, onInsert: (record) => { inserted = record; } })),
      getFxRate: async () => ({ rate: "95.7219", provider: "openexchangerates", rateTimestamp: "2026-08-19T00:00:00.000Z", fetchedAt: "2026-08-19T00:00:01.000Z" }), randomUuid: () => LAB_ID,
      request: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => url.includes("?receipt=") ? { items: [] } : { id: "order_provider" } }; },
    });
    const res = response(); await handler({ method: "POST", body: { labId: LAB_ID } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual({ amount_minor: inserted.amount_minor, regular_price_inr: inserted.regular_price_inr, discounted_price_inr: inserted.discounted_price_inr, source_usd_amount: inserted.source_usd_amount, usd_price_type: inserted.usd_price_type, usd_inr_rate: inserted.usd_inr_rate, base_inr_amount: inserted.base_inr_amount, fx_provider: inserted.fx_provider }, { amount_minor: 1914438, regular_price_inr: null, discounted_price_inr: null, source_usd_amount: "200.00", usd_price_type: "regular", usd_inr_rate: "95.7219", base_inr_amount: "19144.38", fx_provider: "openexchangerates" });
    assert.deepEqual(JSON.parse(requests[1].options.body), { amount: 1914438, currency: "INR", receipt: `lpo_${LAB_ID.replaceAll("-", "")}`, notes: { internal_order_id: LAB_ID, lab_id: LAB_ID } });
  });
});

test("a free USD lab bypasses both FX and Razorpay", async () => {
  await withRazorpayConfig(async () => {
    const handler = createRazorpayLabOrderHandler({ authenticate: authenticated(checkoutSupabase({ lab: { id: LAB_ID, title: "Free Lab", price_usd: "0.00", discounted_price_usd: null } })), getFxRate: async () => { throw new Error("FX must not be called"); } });
    const res = response(); await handler({ method: "POST", body: { labId: LAB_ID } }, res);
    assert.equal(res.statusCode, 400); assert.match(res.body.error, /Free Labs/);
  });
});

test("checkout remains server-authoritative and the public page remains USD", () => {
  assert.match(source, /Object\.keys\(body\)\.length !== 1/);
  assert.doesNotMatch(source, /body\.amount|body\.currency|body\.fx|body\.usd/i);
  assert.match(source, /if \(!order\)/); assert.match(source, /amount: order\.amount_minor, currency: "INR"/);
  assert.match(labDetail, /JSON\.stringify\(\{ labId: lab\.id \}\)/); assert.match(labDetail, /formatUSDPrice/);
  assert.match(migration, /ALTER COLUMN regular_price_inr DROP NOT NULL/); assert.match(migration, /lab_payment_orders_fx_snapshot_complete_check/); assert.match(migration, /BEGIN;/); assert.match(migration, /COMMIT;/);
  assert.doesNotMatch(verification, /usd-inr-rate|OPEN_EXCHANGE_RATES_APP_ID/); assert.doesNotMatch(email, /usd-inr-rate|OPEN_EXCHANGE_RATES_APP_ID/); assert.match(email, /order\.amount_minor, order\.currency/);
});