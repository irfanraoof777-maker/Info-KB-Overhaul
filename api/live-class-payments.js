import { createLiveClassOrder, verifyLiveClassPayment, webhookLiveClassPayment } from "../server/vercel-api/live-class-payments.js";
export const config = { api: { bodyParser: false } };
async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  req.body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export default async function handler(req, res) {
  const path = req.query?.paymentPath;
  if (path === "razorpay/verify") return verifyLiveClassPayment(req, res);
  if (path === "razorpay/webhook") return webhookLiveClassPayment(req, res);
  try { await parseJsonBody(req); } catch { return res.status(400).json({ error: "Invalid payment order payload." }); }
  return createLiveClassOrder(req, res);
}