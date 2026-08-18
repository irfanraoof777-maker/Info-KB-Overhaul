import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sendStudentPaidLabReceipt } from "../server/vercel-api/_utils/student-paid-lab-receipt.js";
import { createRazorpayVerifyHandler } from "../server/vercel-api/razorpay-payment-verification.js";
import { createHmac } from "node:crypto";

const rental = { id: "rental-1", state: "preparing" };
const order = { id: "internal-order", student_id: "student-1", lab_id: "lab-1", razorpay_order_id: "order_rzp", amount_minor: 2000000, currency: "INR", paid_at: "2026-08-18T16:49:25.790Z" };

test("student receipt uses only trusted persisted receipt values", async () => {
  const old = [process.env.RESEND_API_KEY, process.env.PAID_LAB_RECEIPT_FROM];
  process.env.RESEND_API_KEY = "test"; process.env.PAID_LAB_RECEIPT_FROM = "InfoKB <receipts@example.test>";
  let request;
  try {
    await sendStudentPaidLabReceipt({ rental, order, paymentId: "pay_rzp", user: { email: "registered@example.test", user_metadata: { full_name: "Registered Student" } }, lab: { title: "VMware Lab" }, fetchImpl: async (...args) => { request = args; return { ok: true, status: 200 }; } });
    const [url, init] = request; const body = JSON.parse(init.body);
    assert.equal(url, "https://api.resend.com/emails"); assert.deepEqual(body.to, ["registered@example.test"]);
    assert.equal(body.subject, "Payment Successful - Your InfoKB Lab Is Being Prepared");
    assert.equal(init.headers["Idempotency-Key"], "student-paid-lab-receipt-rental-1");
    for (const value of ["Payment Receipt", "Registered Student", "registered@example.test", "VMware Lab", "INR 20,000.00", "Currency: INR", "Payment Status: Paid", "Lab Status: Preparing", "18 Aug 2026, 10:19 PM IST", "rental-1", "internal-order", "order_rzp", "pay_rzp"]) assert.ok(body.text.includes(value));
    assert.ok(body.text.includes("currently being prepared")); assert.ok(!body.text.includes("Tax Invoice")); assert.ok(!body.text.includes("Guacamole"));
  } finally { [process.env.RESEND_API_KEY, process.env.PAID_LAB_RECEIPT_FROM] = old; }
});

test("receipt outbox is independent, leased, retryable, and only enqueued for a preparing paid rental", () => {
  const sql = readFileSync("supabase/migrations/20260828_add_student_paid_lab_receipt_outbox.sql", "utf8");
  for (const value of ["student_paid_lab_receipt_outbox", "payment_order_id uuid NOT NULL UNIQUE", "NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid'", "rental.state = 'preparing'", "ON CONFLICT DO NOTHING", "FOR UPDATE", "interval '5 minutes'", "reservation_token = token", "reservation_token = p_reservation_token AND sent_at IS NULL", "SET search_path = ''"]) assert.ok(sql.includes(value));
  assert.doesNotMatch(sql, /paid_lab_notification_outbox/);
});

test("browser receipt opportunity follows captured finalization and cannot use browser identity fields", async () => {
  const secret = "test-secret"; const oldId = process.env.RAZORPAY_KEY_ID, oldSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "key"; process.env.RAZORPAY_KEY_SECRET = secret;
  let adminCalls = 0; let receipt;
  const supabase = {
    from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: order, error: null }) }; },
    rpc: async () => ({ data: rental, error: null }), auth: { admin: { getUserById: async () => { adminCalls += 1; return { data: { user: { email: "registered@example.test", user_metadata: { full_name: "Trusted Name" } } }, error: null }; } } }
  };
  const response = { statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  const body = { razorpay_order_id: "order_rzp", razorpay_payment_id: "pay_rzp", razorpay_signature: createHmac("sha256", secret).update("order_rzp|pay_rzp").digest("hex") };
  try {
    await createRazorpayVerifyHandler({ authenticate: async () => ({ user: { id: "student-1", email: "attacker@example.test", user_metadata: { full_name: "Attacker" } }, supabase }), request: async () => ({ ok: true, json: async () => ({ id: "pay_rzp", order_id: "order_rzp", amount: 2000000, currency: "INR", status: "captured" }) }), notify: async () => {}, notifyStudent: async (args) => { receipt = args; } })({ method: "POST", body, headers: {} }, response);
    assert.equal(response.statusCode, 200); assert.equal(receipt.order.amount_minor, 2000000); assert.equal(receipt.order.currency, "INR"); assert.equal(receipt.rental.state, "preparing");
    assert.equal(adminCalls, 0, "the injectable delivery stub must not receive browser identity");
  } finally { if (oldId === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = oldId; if (oldSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = oldSecret; }
});
