import razorpayLabOrders from "../server/vercel-api/razorpay-lab-orders.js";
import { createRazorpayVerifyHandler, createRazorpayWebhookHandler } from "../server/vercel-api/razorpay-payment-verification.js";

export const config = { api: { bodyParser: false } };
const verify = createRazorpayVerifyHandler();
const webhook = createRazorpayWebhookHandler();

async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  req.body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export default async function labPayments(req, res) {
  const path = req.query?.paymentPath;
  if (path === "razorpay/verify") return verify(req, res);
  if (path === "razorpay/webhook") return webhook(req, res);
  try { await parseJsonBody(req); } catch { return res.status(400).json({ error: "Invalid payment order payload." }); }
  return razorpayLabOrders(req, res);
}