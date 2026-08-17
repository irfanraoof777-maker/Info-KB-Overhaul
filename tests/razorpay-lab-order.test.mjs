import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRazorpayLabOrderHandler, isCurrentRental, payableInrPrice, toInrPaise } from "../server/vercel-api/razorpay-lab-orders.js";

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

test("authoritative INR price selection and paise conversion are exact", () => {
  assert.equal(toInrPaise("20000.00"), 2000000);
  assert.deepEqual(payableInrPrice({ price_inr: "20000.00", discounted_price_inr: null }), { amount: 2000000, regularPriceInr: "20000.00", discountedPriceInr: null });
  assert.deepEqual(payableInrPrice({ price_inr: "20000.00", discounted_price_inr: "15999.50" }), { amount: 1599950, regularPriceInr: "20000.00", discountedPriceInr: "15999.50" });
  assert.throws(() => payableInrPrice({ price_inr: null }), /not configured/);
  assert.equal(payableInrPrice({ price_inr: "0.00", discounted_price_inr: null }).amount, 0);
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
  assert.match(source, /price_inr, discounted_price_inr/);
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