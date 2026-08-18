import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRazorpayVerifyHandler, createRazorpayWebhookHandler, verifyCheckoutSignature, verifyWebhookSignature, isCapturedInrPayment } from "../server/vercel-api/razorpay-payment-verification.js";

const secret = "test-secret";
const order = { id: "order-row", student_id: "student-a", lab_id: "lab-a", amount_minor: 159950, currency: "INR", provider: "razorpay", razorpay_order_id: "order_test", rental_id: null };
function res() { return { statusCode: 200, body: null, setHeader() {}, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; } }; }
function sig(value) { return createHmac("sha256", secret).update(value).digest("hex"); }
function auth(student = "student-a") { return async () => ({ user: { id: student }, supabase: { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: student === "student-a" ? order : null, error: null }) }; }, rpc: async () => ({ data: { id: "rental-1", state: "preparing" }, error: null }) } }); }
function payment(overrides = {}) { return { id: "pay_test", order_id: "order_test", amount: 159950, currency: "INR", status: "captured", ...overrides }; }

test("Checkout signatures reject invalid values and accept exact order/payment values", () => {
  assert.equal(verifyCheckoutSignature("order_test", "pay_test", sig("order_test|pay_test"), secret), true);
  assert.equal(verifyCheckoutSignature("order_test", "pay_test", "0".repeat(64), secret), false);
});
test("payment reconciliation rejects wrong order, amount, currency, and uncaptured payments", () => {
  assert.equal(isCapturedInrPayment(payment({ order_id: "wrong" }), order), false);
  assert.equal(isCapturedInrPayment(payment({ amount: 1 }), order), false);
  assert.equal(isCapturedInrPayment(payment({ currency: "USD" }), order), false);
  assert.equal(isCapturedInrPayment(payment({ status: "authorized" }), order), false);
});
test("browser verification rejects a wrong student and finalizes a captured payment", async () => {
  const oldId=process.env.RAZORPAY_KEY_ID, oldSecret=process.env.RAZORPAY_KEY_SECRET; process.env.RAZORPAY_KEY_ID="key_test"; process.env.RAZORPAY_KEY_SECRET=secret;
  try {
    const body={ razorpay_order_id:"order_test", razorpay_payment_id:"pay_test", razorpay_signature:sig("order_test|pay_test") };
    const good=res(); await createRazorpayVerifyHandler({ authenticate: auth(), request: async()=>({ok:true,json:async()=>payment()}) })({method:"POST",body,headers:{}},good);
    assert.equal(good.statusCode,200); assert.equal(good.body.state,"preparing");
    const wrong=res(); await createRazorpayVerifyHandler({ authenticate: auth("student-b"), request: async()=>({ok:true,json:async()=>payment()}) })({method:"POST",body,headers:{}},wrong);
    assert.equal(wrong.statusCode,404);
  } finally { if(oldId===undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID=oldId; if(oldSecret===undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET=oldSecret; }
});
test("webhook uses an exact raw-body HMAC before parsing", () => {
  const raw=Buffer.from('{"event":"payment.captured"}'); assert.equal(verifyWebhookSignature(raw,sig(raw),secret),true); assert.equal(verifyWebhookSignature(raw,"0".repeat(64),secret),false);
});
test("finalization migration is service-role-only, idempotent, race-safe, and creates preparing rentals", () => {
  const sql=readFileSync("supabase/migrations/20260824_add_razorpay_payment_finalization.sql","utf8");
  assert.match(sql,/FOR UPDATE/); assert.match(sql,/pg_advisory_xact_lock/); assert.match(sql,/SET search_path = ''/); assert.match(sql,/GRANT EXECUTE[\s\S]*TO service_role/); assert.match(sql,/REVOKE ALL[\s\S]*anon, authenticated/); assert.match(sql,/status = 'paid'/); assert.match(sql,/VALUES \(current_order\.student_id, current_order\.lab_id, 'preparing', 'payment'\)/); assert.match(sql,/rental_id = created_rental\.id/); assert.match(sql,/rental\.expires_at IS NOT NULL AND rental\.expires_at <= now\(\)/); assert.doesNotMatch(sql,/ready' AND \(rental\.expires_at IS NULL/);
});
test("routes expose browser verify and raw-body webhook endpoints", () => {
  const config=JSON.parse(readFileSync("vercel.json","utf8")); assert.ok(config.rewrites.some((r)=>r.source==="/api/lab-payments/razorpay/verify")); assert.ok(config.rewrites.some((r)=>r.source==="/api/lab-payments/razorpay/webhook"));
  const entry=readFileSync("api/lab-payments.js","utf8"); assert.match(entry,/bodyParser: false/); assert.match(entry,/razorpay\/webhook/);
});
test("browser notification is attempted only after successful captured finalization", async () => {
  const oldId = process.env.RAZORPAY_KEY_ID, oldSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "key_test"; process.env.RAZORPAY_KEY_SECRET = secret;
  let notifications = 0;
  try {
    const body = { razorpay_order_id: "order_test", razorpay_payment_id: "pay_test", razorpay_signature: sig("order_test|pay_test") };
    const response = res();
    await createRazorpayVerifyHandler({ authenticate: auth(), request: async () => ({ ok: true, json: async () => payment() }), notify: async ({ rental }) => { notifications += 1; assert.equal(rental.state, "preparing"); } })({ method: "POST", body, headers: {} }, response);
    assert.equal(response.statusCode, 200); assert.equal(notifications, 1);
  } finally { if (oldId === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = oldId; if (oldSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = oldSecret; }
});

test("invalid and non-captured browser payments never attempt notification", async () => {
  const oldId = process.env.RAZORPAY_KEY_ID, oldSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "key_test"; process.env.RAZORPAY_KEY_SECRET = secret;
  let notifications = 0;
  try {
    const invalid = res();
    await createRazorpayVerifyHandler({ authenticate: auth(), request: async () => ({ ok: true, json: async () => payment() }), notify: async () => { notifications += 1; } })({ method: "POST", body: { razorpay_order_id: "order_test", razorpay_payment_id: "pay_test", razorpay_signature: "0".repeat(64) }, headers: {} }, invalid);
    const uncaptured = res(); const body = { razorpay_order_id: "order_test", razorpay_payment_id: "pay_test", razorpay_signature: sig("order_test|pay_test") };
    await createRazorpayVerifyHandler({ authenticate: auth(), request: async () => ({ ok: true, json: async () => payment({ status: "authorized" }) }), notify: async () => { notifications += 1; } })({ method: "POST", body, headers: {} }, uncaptured);
    assert.equal(invalid.statusCode, 400); assert.equal(uncaptured.statusCode, 409); assert.equal(notifications, 0);
  } finally { if (oldId === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = oldId; if (oldSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = oldSecret; }
});

test("paid notification migration guards duplicate events and stale workers", () => {
  const sql = readFileSync("supabase/migrations/20260826_add_paid_lab_notification_outbox.sql", "utf8");
  assert.match(sql, /payment_order_id uuid NOT NULL UNIQUE/);
  assert.match(sql, /ON CONFLICT DO NOTHING/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /reservation_token=token/);
  assert.match(sql, /reservation_token=p_reservation_token AND sent_at IS NULL/);
  assert.match(sql, /interval '5 minutes'/);
});
