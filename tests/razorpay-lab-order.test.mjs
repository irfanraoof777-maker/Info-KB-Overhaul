import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRazorpayLabOrderHandler, isCurrentRental } from "../server/vercel-api/razorpay-lab-orders.js";
import { payableUsdPrice, usdToInrPaise } from "../server/vercel-api/_utils/usd-inr-rate.js";

const source = readFileSync("server/vercel-api/razorpay-lab-orders.js", "utf8");
const migration = readFileSync("supabase/migrations/20260823_add_razorpay_lab_payment_orders.sql", "utf8");
const config = JSON.parse(readFileSync("vercel.json", "utf8"));

function response() {
  return { statusCode: 200, body: undefined, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test("Razorpay order request rejects unauthenticated students", async () => {
  const handler = createRazorpayLabOrderHandler({ authenticate: async (_req, res) => { res.status(401).json({ error: "Unauthorized" }); return null; } });
  const res = response();
  await handler({ method: "POST", body: { labId: "f5507a29-b7fc-4d7a-b027-52921a9d679c" } }, res);
  assert.equal(res.statusCode, 401);
});

test("authoritative USD price selection and direct paise conversion are exact", () => {
  assert.deepEqual(payableUsdPrice({ price_usd: "200.00", discounted_price_usd: null }), { usdAmount: "200.00", usdPriceType: "regular" });
  assert.deepEqual(payableUsdPrice({ price_usd: "200.00", discounted_price_usd: "159.95" }), { usdAmount: "159.95", usdPriceType: "discounted" });
  assert.equal(usdToInrPaise("200.00", "95.7219"), 1914438);
  assert.throws(() => payableUsdPrice({ price_usd: null }), /USD price is invalid/);
});
test("only current rentals block purchase; cancelled and expired rentals do not", () => {
  const now = new Date("2026-08-18T00:00:00.000Z");
  assert.equal(isCurrentRental({ state: "payment_pending" }, now), true);
  assert.equal(isCurrentRental({ state: "preparing" }, now), true);
  assert.equal(isCurrentRental({ state: "ready", expires_at: "2026-08-19T00:00:00.000Z" }, now), true);
  assert.equal(isCurrentRental({ state: "ready", expires_at: "2026-08-17T00:00:00.000Z" }, now), false);
  assert.equal(isCurrentRental({ state: "cancelled" }, now), false);
  assert.equal(isCurrentRental({ state: "expired" }, now), false);
});

test("server accepts only labId and keeps pricing, identity, and secrets server-side", () => {
  assert.match(source, /Object\.keys\(body\)\.length !== 1/);
  assert.match(source, /auth\.user\.id/);
  assert.match(source, /price_usd, discounted_price_usd/);
  assert.doesNotMatch(source, /req\.body\?\.amount|body\.amount|body\.currency|body\.studentId|body\.userId/);
  assert.doesNotMatch(source, /lab_rentals"\)\.insert|\.rpc\(/);
  assert.match(source, /RAZORPAY_KEY_SECRET/);
  const responseBuilder = source.slice(source.indexOf("function safeOrderResponse"), source.indexOf("function razorpayAuthHeader"));
  assert.doesNotMatch(responseBuilder, /keySecret|RAZORPAY_KEY_SECRET/);
});

test("payment migration and route provide durable retry-safe order creation", () => {
  assert.match(migration, /status IN \('creating', 'created', 'provider_error', 'paid', 'failed', 'refunded'\)/);
  assert.match(migration, /receipt text NOT NULL UNIQUE/);
  assert.match(migration, /razorpay_order_id text UNIQUE/);
  assert.match(migration, /lab_payment_orders_one_open_order_idx/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.lab_payment_orders FROM PUBLIC, anon, authenticated/);
  assert.ok(config.rewrites.some((rewrite) => rewrite.source === "/api/lab-payments/razorpay/order" && rewrite.destination === "/api/lab-payments?paymentPath=razorpay/order"));
  assert.match(source, /\/orders\?receipt=/);
  assert.match(source, /receipt: order\.receipt/);
});
function createOrderHarness({ lab, orders, fxSnapshots }) {
  const updates = [];
  const providerCreates = [];
  let uuid = 1;
  let fxIndex = 0;
  const openOrder = () => orders.filter((order) => ["creating", "created", "provider_error"].includes(order.status)).at(-1) ?? null;
  const paymentOrders = {
    select() {
      return {
        eq() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; },
        maybeSingle() { return Promise.resolve({ data: openOrder(), error: null }); },
      };
    },
    update(values) {
      return {
        eq(_field, id) {
          const order = orders.find((entry) => entry.id === id);
          Object.assign(order, values);
          updates.push({ id, values: { ...values } });
          return {
            then(resolve, reject) { return Promise.resolve({ data: order, error: null }).then(resolve, reject); },
            select() { return { single() { return Promise.resolve({ data: order, error: null }); } }; },
          };
        },
      };
    },
    insert(rows) {
      const order = { ...rows[0] };
      orders.push(order);
      return { select() { return { single() { return Promise.resolve({ data: order, error: null }); } }; } };
    },
  };
  const supabase = {
    from(table) {
      if (table === "labs") return { select() { return { eq() { return this; }, maybeSingle() { return Promise.resolve({ data: lab, error: null }); } }; } };
      if (table === "lab_rentals") return { select() { return { eq() { return this; }, in() { return Promise.resolve({ data: [], error: null }); } }; } };
      if (table === "lab_payment_orders") return paymentOrders;
      throw new Error(`Unexpected table ${table}`);
    },
  };
  const handler = createRazorpayLabOrderHandler({
    authenticate: async () => ({ user: { id: "f5507a29-b7fc-4d7a-b027-52921a9d679c" }, supabase }),
    getFxRate: async () => fxSnapshots[fxIndex++],
    randomUuid: () => `f5507a29-b7fc-4d7a-b027-52921a9d${String(uuid++).padStart(12, "0")}`,
    request: async (_url, options) => {
      if (options.method === "GET") return { ok: true, json: async () => ({ items: [] }) };
      providerCreates.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ id: `order_new_${providerCreates.length}` }) };
    },
  });
  return { handler, orders, updates, providerCreates, fxCalls: () => fxIndex };
}

async function requestCheckout(harness) {
  const res = response();
  await harness.handler({ method: "POST", body: { labId: "f5507a29-b7fc-4d7a-b027-52921a9d679c" } }, res);
  assert.equal(res.statusCode, 200);
  return res.body.order;
}

test("Razorpay open orders are reused only for the current immutable USD snapshot", async () => {
  const previousKeyId = process.env.RAZORPAY_KEY_ID;
  const previousKeySecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
  try {
    const lab = { id: "lab", title: "Lab", enabled: true, price_usd: "125.00", discounted_price_usd: null };
    const stale = {
      id: "old", receipt: "old", amount_minor: 1125000, currency: "INR", razorpay_order_id: "order_old", status: "created",
      source_usd_amount: "125.00", usd_price_type: "regular", usd_inr_rate: "90", base_inr_amount: "11250.00",
      fx_provider: "openexchangerates", fx_rate_timestamp: "2026-08-20T00:00:00.000Z", conversion_created_at: "2026-08-20T00:01:00.000Z",
    };
    const immutableOldSnapshot = { amount_minor: stale.amount_minor, razorpay_order_id: stale.razorpay_order_id, source_usd_amount: stale.source_usd_amount, usd_inr_rate: stale.usd_inr_rate, base_inr_amount: stale.base_inr_amount, fx_provider: stale.fx_provider, fx_rate_timestamp: stale.fx_rate_timestamp, conversion_created_at: stale.conversion_created_at };
    const harness = createOrderHarness({ lab, orders: [stale], fxSnapshots: [
      { rate: "91", provider: "openexchangerates", rateTimestamp: "2026-08-24T00:00:00.000Z", fetchedAt: "2026-08-24T00:01:00.000Z" },
      { rate: "92", provider: "openexchangerates", rateTimestamp: "2026-08-24T00:02:00.000Z", fetchedAt: "2026-08-24T00:03:00.000Z" },
    ] });

    const samePrice = await requestCheckout(harness);
    assert.equal(samePrice.orderId, "old");
    assert.equal(harness.fxCalls(), 0);

    lab.price_usd = "0.10";
    const replacement = await requestCheckout(harness);
    assert.equal(stale.status, "failed");
    assert.equal(stale.last_provider_error, "price_changed");
    assert.deepEqual({ amount_minor: stale.amount_minor, razorpay_order_id: stale.razorpay_order_id, source_usd_amount: stale.source_usd_amount, usd_inr_rate: stale.usd_inr_rate, base_inr_amount: stale.base_inr_amount, fx_provider: stale.fx_provider, fx_rate_timestamp: stale.fx_rate_timestamp, conversion_created_at: stale.conversion_created_at }, immutableOldSnapshot);
    const replacementRow = harness.orders.find((order) => order.id === replacement.orderId);
    assert.equal(replacementRow.source_usd_amount, "0.10");
    assert.equal(replacementRow.usd_price_type, "regular");
    assert.equal(replacementRow.usd_inr_rate, "91");
    assert.equal(replacementRow.conversion_created_at, "2026-08-24T00:01:00.000Z");
    assert.equal(harness.providerCreates.at(-1).amount, 910);

    const repeated = await requestCheckout(harness);
    assert.equal(repeated.orderId, replacement.orderId);
    assert.equal(harness.orders.length, 2);
    assert.equal(harness.fxCalls(), 1);

    lab.price_usd = "0.20";
    lab.discounted_price_usd = "0.10";
    await requestCheckout(harness);
    assert.equal(replacementRow.status, "failed", "same USD amount but changed regular/discounted type invalidates the order");
    assert.equal(harness.orders.at(-1).source_usd_amount, "0.10");
    assert.equal(harness.orders.at(-1).usd_price_type, "discounted");
    assert.equal(harness.orders.at(-1).usd_inr_rate, "92");
    assert.equal(harness.fxCalls(), 2);
  } finally {
    if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = previousKeyId;
    if (previousKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = previousKeySecret;
  }
});