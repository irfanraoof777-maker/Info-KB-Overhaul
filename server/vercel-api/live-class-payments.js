import crypto from "node:crypto";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireStudent } from "./_utils/student-auth.js";
import { getSupabaseAdmin } from "./_utils/supabase.js";

const OPEN = ["creating", "created", "provider_error"];
const authHeader = (id, secret) => `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
const validSignature = (orderId, paymentId, signature, secret) => {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected); const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
};
async function rawRequestBody(req) { if (Buffer.isBuffer(req.rawBody)) return req.rawBody; if (typeof req.rawBody === "string") return Buffer.from(req.rawBody); if (Buffer.isBuffer(req.body)) return req.body; if (typeof req.body === "string") return Buffer.from(req.body); const chunks = []; for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks); }
async function provider(path, options = {}) {
  const id = process.env.RAZORPAY_KEY_ID; const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("India payments are not configured.");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, { ...options, headers: { Authorization: authHeader(id, secret), "Content-Type": "application/json", ...(options.headers ?? {}) } });
  if (!response.ok) throw new Error("Razorpay request failed.");
  return response.json();
}
async function findOrder(supabase, razorpayOrderId, userId) {
  let query = supabase.from("live_class_payment_orders").select("id,student_id,live_course_id,amount_minor,currency,status,razorpay_order_id,razorpay_payment_id").eq("razorpay_order_id", razorpayOrderId);
  if (userId) query = query.eq("student_id", userId);
  const { data, error } = await query.maybeSingle(); if (error) throw error; return data;
}
async function finalize(supabase, order, paymentId, eventId = null, payload = null) {
  const { data, error } = await supabase.rpc("finalize_razorpay_live_class_payment", { p_payment_order_id: order.id, p_razorpay_payment_id: paymentId, p_provider_event_id: eventId, p_provider_payload: payload });
  if (error) throw error; return data;
}
export async function createLiveClassOrder(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireStudent(req, res); if (!auth) return;
  try {
    const liveCourseId = req.body?.liveCourseId;
    if (typeof liveCourseId !== "string") return res.status(400).json({ error: "A live class is required." });
    const { data: course, error: courseError } = await auth.supabase.from("live_courses").select("id,title,price_inr,status,registration_open").eq("id", liveCourseId).maybeSingle();
    if (courseError) throw courseError;
    if (!course || course.status !== "published" || !course.registration_open || !(Number(course.price_inr) > 0)) return res.status(409).json({ error: "Registration is closed." });
    const existing = await auth.supabase.from("live_class_registrations").select("id").eq("user_id", auth.user.id).eq("live_course_id", liveCourseId).eq("payment_status", "paid").eq("enrollment_status", "active").maybeSingle();
    if (existing.data) return res.status(409).json({ error: "You are already registered." });
    let { data: order, error } = await auth.supabase.from("live_class_payment_orders").select("id,receipt,amount_minor,currency,razorpay_order_id,status").eq("student_id", auth.user.id).eq("live_course_id", liveCourseId).in("status", OPEN).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!order) {
      const amount = Math.round(Number(course.price_inr) * 100);
      const inserted = await auth.supabase.from("live_class_payment_orders").insert({ id: crypto.randomUUID(), student_id: auth.user.id, live_course_id: liveCourseId, provider: "razorpay", currency: "INR", amount_minor: amount, receipt: `lc_${crypto.randomUUID().replaceAll("-", "").slice(0, 32)}` }).select("id,receipt,amount_minor,currency,razorpay_order_id,status").single();
      if (inserted.error) throw inserted.error; order = inserted.data;
    }
    if (!order.razorpay_order_id) {
      const remote = await provider("/orders", { method: "POST", body: JSON.stringify({ amount: order.amount_minor, currency: "INR", receipt: order.receipt, notes: { liveCourseId } }) });
      const updated = await auth.supabase.from("live_class_payment_orders").update({ razorpay_order_id: remote.id, status: "created", updated_at: new Date().toISOString() }).eq("id", order.id).select("id,receipt,amount_minor,currency,razorpay_order_id,status").single();
      if (updated.error) throw updated.error; order = updated.data;
    }
    return res.status(200).json({ order: { id: order.id, razorpayOrderId: order.razorpay_order_id, amount: order.amount_minor, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID, name: course.title } });
  } catch (error) { console.error("[live-class-order] failed", error instanceof Error ? error.message : "unknown error"); return res.status(500).json({ error: "Unable to create payment order." }); }
}
export async function verifyLiveClassPayment(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireStudent(req, res); if (!auth) return;
  try {
    const body = req.body ?? {}; const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
    if (![orderId, paymentId, signature].every((v) => typeof v === "string")) return res.status(400).json({ error: "Invalid payment verification payload." });
    const secret = process.env.RAZORPAY_KEY_SECRET; if (!secret || !validSignature(orderId, paymentId, signature, secret)) return res.status(400).json({ error: "Payment signature is invalid." });
    const order = await findOrder(auth.supabase, orderId, auth.user.id); if (!order) return res.status(404).json({ error: "Payment order not found." });
    const payment = await provider(`/payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== order.razorpay_order_id || payment.amount !== order.amount_minor || payment.currency !== "INR" || payment.status !== "captured") return res.status(409).json({ error: "Payment has not been captured." });
    const registration = await finalize(auth.supabase, order, paymentId, null, { source: "browser_verify", payment_status: payment.status });
    return res.status(200).json({ verified: true, registration });
  } catch (error) { console.error("[live-class-verify] failed", error instanceof Error ? error.message : "unknown error"); return res.status(500).json({ error: "Unable to verify payment." }); }
}
export async function webhookLiveClassPayment(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const raw = await rawRequestBody(req);
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET; const signature = req.headers["x-razorpay-signature"];
    const expected = secret ? createHmac("sha256", secret).update(raw).digest("hex") : "";
    const received = Buffer.from(Array.isArray(signature) ? String(signature[0]) : String(signature ?? "")); const verified = Buffer.from(expected);
    if (!secret || typeof signature !== "string" || received.length !== verified.length || !timingSafeEqual(received, verified)) return res.status(400).json({ error: "Invalid webhook signature." });
    let event; try { event = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).json({ error: "Invalid webhook payload." }); }
    // Live Training purchases are non-refundable. Refund events are deliberately ignored.
    if (["refund.created", "refund.processed"].includes(event.event)) return res.status(200).json({ ignored: true });
    if (event.event === "payment.failed") { const failed = event.payload?.payment?.entity; if (typeof failed?.order_id === "string") { const order = await findOrder(getSupabaseAdmin(), failed.order_id); if (order && order.status !== "paid") await getSupabaseAdmin().from("live_class_payment_orders").update({ status: "failed", provider_payload: { event: event.event, payment_id: failed.id }, updated_at: new Date().toISOString() }).eq("id", order.id); } return res.status(200).json({ received: true }); }
    if (!["payment.captured", "order.paid"].includes(event.event)) return res.status(200).json({ ignored: true });
    const paymentEntity = event.payload?.payment?.entity; const orderId = paymentEntity?.order_id ?? event.payload?.order?.entity?.id;
    if (typeof orderId !== "string") return res.status(400).json({ error: "Webhook order is missing." });
    const supabase = getSupabaseAdmin(); const order = await findOrder(supabase, orderId); if (!order) return res.status(200).json({ ignored: true });
    let payment = paymentEntity?.id ? await provider(`/payments/${encodeURIComponent(paymentEntity.id)}`) : null;
    if (!payment) { const payments = await provider(`/orders/${encodeURIComponent(orderId)}/payments`); payment = (payments.items ?? []).find((item) => item.status === "captured"); }
    if (!payment || payment.order_id !== order.razorpay_order_id || payment.amount !== order.amount_minor || payment.currency !== "INR" || payment.status !== "captured") return res.status(409).json({ error: "Webhook payment is invalid." });
    const eventId = typeof req.headers["x-razorpay-event-id"] === "string" ? req.headers["x-razorpay-event-id"] : `${event.event}:${payment.id}`;
    await finalize(supabase, order, payment.id, eventId, { event: event.event, payment_id: payment.id, order_id: orderId });
    return res.status(200).json({ received: true });
  } catch (error) { console.error("[live-class-webhook] failed", error instanceof Error ? error.message : "unknown error"); return res.status(500).json({ error: "Webhook processing failed." }); }
}