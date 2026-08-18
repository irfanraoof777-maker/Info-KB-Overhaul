import { createHmac, timingSafeEqual } from "node:crypto";
import { requireStudent } from "./_utils/student-auth.js";
import { sendPaidLabNotification } from "./_utils/paid-lab-notification.js";

function equalSignature(expected, received) {
  if (typeof received !== "string" || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(received, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyCheckoutSignature(orderId, paymentId, signature, secret) {
  if (!orderId || !paymentId || !secret) return false;
  return equalSignature(createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"), signature);
}

export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !secret) return false;
  return equalSignature(createHmac("sha256", secret).update(rawBody).digest("hex"), signature);
}

export function isCapturedInrPayment(payment, order) {
  return payment?.order_id === order.razorpay_order_id
    && payment.amount === order.amount_minor
    && payment.currency === "INR"
    && payment.status === "captured";
}

function authHeader(keyId, secret) {
  return `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`;
}

async function razorpay(request, keyId, secret, path) {
  const response = await request(`https://api.razorpay.com/v1${path}`, { headers: { Authorization: authHeader(keyId, secret) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Razorpay payment lookup failed.");
  return data;
}

async function findOrder(supabase, razorpayOrderId, studentId = null) {
  let query = supabase.from("lab_payment_orders")
    .select("id, student_id, lab_id, amount_minor, currency, status, razorpay_order_id, razorpay_payment_id, rental_id, paid_at")
    .eq("provider", "razorpay")
    .eq("razorpay_order_id", razorpayOrderId);
  if (studentId) query = query.eq("student_id", studentId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function refreshedFinalizedOrder(supabase, order) {
  try {
    const refreshed = await findOrder(supabase, order.razorpay_order_id, order.student_id);
    if (!refreshed?.paid_at) console.warn("[paid-lab-notification] finalized order is missing paid_at");
    return refreshed ?? order;
  } catch (error) {
    console.warn("[paid-lab-notification] could not refresh finalized order", error instanceof Error ? error.message : "unknown error");
    return order;
  }
}
async function finalize(supabase, order, paymentId, eventId, payload) {
  const { data, error } = await supabase.rpc("finalize_razorpay_lab_payment", {
    p_payment_order_id: order.id,
    p_razorpay_payment_id: paymentId,
    p_provider_event_id: eventId,
    p_provider_payload: payload,
  });
  if (error) throw error;
  return data;
}

async function rawRequestBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === "string") return Buffer.from(req.rawBody);
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function jsonRequestBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  return JSON.parse((await rawRequestBody(req)).toString("utf8"));
}

async function notifyPaidLab({ supabase, order, rental, paymentId, user, send = sendPaidLabNotification }) {
  const { data: reservationToken, error: reserveError } = await supabase.rpc("reserve_paid_lab_notification", { p_rental_id: rental.id });
  if (reserveError || !reservationToken) return;
  try {
    const { data: lab, error: labError } = await supabase.from("labs").select("title").eq("id", order.lab_id).maybeSingle();
    if (labError || !lab) throw new Error("Lab notification details are unavailable.");
    let student = user;
    if (!student) {
      const result = await supabase.auth.admin.getUserById(order.student_id);
      if (result.error || !result.data?.user) throw new Error("Student notification details are unavailable.");
      student = result.data.user;
    }
    const result = await send({ rental, order, paymentId, user: student, lab });
    if (!result?.sent) throw new Error(result?.reason ?? "Paid notification was not sent.");
    await supabase.rpc("complete_paid_lab_notification", { p_rental_id: rental.id, p_reservation_token: reservationToken, p_error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "notification failed";
    await supabase.rpc("complete_paid_lab_notification", { p_rental_id: rental.id, p_reservation_token: reservationToken, p_error: message });
    console.error("[paid-lab-notification] failed", message);
  }
}
function paymentConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("India payments are not configured.");
  return { keyId, keySecret };
}

export function createRazorpayVerifyHandler({ authenticate = requireStudent, request = fetch, notify = notifyPaidLab } = {}) {
  return async function verifyHandler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const auth = await authenticate(req, res);
    if (!auth) return;
    let body;
    try { body = await jsonRequestBody(req); } catch { return res.status(400).json({ error: "Invalid payment verification payload." }); }
    if (!body || typeof body !== "object" || Object.keys(body).length !== 3
      || typeof body.razorpay_payment_id !== "string" || typeof body.razorpay_order_id !== "string" || typeof body.razorpay_signature !== "string") {
      return res.status(400).json({ error: "Invalid payment verification payload." });
    }
    try {
      const { keyId, keySecret } = paymentConfig();
      const order = await findOrder(auth.supabase, body.razorpay_order_id, auth.user.id);
      if (!order) return res.status(404).json({ error: "Payment order not found." });
      if (!verifyCheckoutSignature(order.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature, keySecret)) {
        return res.status(400).json({ error: "Payment signature is invalid." });
      }
      const payment = await razorpay(request, keyId, keySecret, `/payments/${encodeURIComponent(body.razorpay_payment_id)}`);
      if (!isCapturedInrPayment(payment, order)) return res.status(409).json({ error: "Payment has not been captured for this order." });
      const rental = await finalize(auth.supabase, order, payment.id, null, { source: "browser_verify", payment_status: payment.status });
      const finalizedOrder = await refreshedFinalizedOrder(auth.supabase, order);
      await notify({ supabase: auth.supabase, order: finalizedOrder, rental, paymentId: payment.id, user: auth.user });
      return res.status(200).json({ verified: true, rentalId: rental.id, state: rental.state });
    } catch (error) {
      console.error("[razorpay-verify] failed", error instanceof Error ? error.message : "unknown error");
      return res.status(500).json({ error: "Unable to verify payment." });
    }
  };
}

export function createRazorpayWebhookHandler({ request = fetch, notify = notifyPaidLab } = {}) {
  return async function webhookHandler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const rawBody = await rawRequestBody(req);
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!verifyWebhookSignature(rawBody, Array.isArray(signature) ? signature[0] : signature, webhookSecret)) {
      return res.status(400).json({ error: "Invalid webhook signature." });
    }
    let event;
    try { event = JSON.parse(rawBody.toString("utf8")); } catch { return res.status(400).json({ error: "Invalid webhook payload." }); }
    if (event?.event !== "payment.captured" && event?.event !== "order.paid") return res.status(200).json({ ignored: true });
    try {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      const razorpayOrderId = paymentEntity?.order_id ?? orderEntity?.id;
      if (typeof razorpayOrderId !== "string") return res.status(400).json({ error: "Webhook order is missing." });
      const { keyId, keySecret } = paymentConfig();
      const { getSupabaseAdmin } = await import("./_utils/supabase.js");
      const supabase = getSupabaseAdmin();
      const order = await findOrder(supabase, razorpayOrderId);
      if (!order) return res.status(200).json({ ignored: true });
      let payment;
      if (typeof paymentEntity?.id === "string") {
        payment = await razorpay(request, keyId, keySecret, `/payments/${encodeURIComponent(paymentEntity.id)}`);
      } else {
        const payments = await razorpay(request, keyId, keySecret, `/orders/${encodeURIComponent(razorpayOrderId)}/payments`);
        payment = (payments.items ?? []).find((item) => item.status === "captured");
      }
      if (!isCapturedInrPayment(payment, order)) return res.status(409).json({ error: "Webhook payment is not a captured INR payment for this order." });
      const deliveryId = req.headers["x-razorpay-event-id"];
      const eventId = typeof deliveryId === "string" ? deliveryId : `${event.event}:${payment.id}`;
      const rental = await finalize(supabase, order, payment.id, eventId, { event: event.event, payment_id: payment.id, order_id: razorpayOrderId });
      const finalizedOrder = await refreshedFinalizedOrder(supabase, order);
      await notify({ supabase, order: finalizedOrder, rental, paymentId: payment.id });
      return res.status(200).json({ received: true, rentalId: rental.id });
    } catch (error) {
      console.error("[razorpay-webhook] failed", error instanceof Error ? error.message : "unknown error");
      return res.status(500).json({ error: "Webhook processing failed." });
    }
  };
}

export default { createRazorpayVerifyHandler, createRazorpayWebhookHandler };
