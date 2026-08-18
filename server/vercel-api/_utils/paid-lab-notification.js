const RESEND_EMAILS_URL = "https://api.resend.com/emails";
function displayName(user) { const metadata = user?.user_metadata ?? {}; return (metadata.full_name ?? metadata.name ?? [metadata.first_name, metadata.last_name].filter(Boolean).join(" ")) || "Not provided"; }
function formatAmount(amountMinor, currency) { if (currency === "INR") return `INR ${(Number(amountMinor) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; return `${amountMinor ?? "Not available"} ${currency ?? ""}`.trim(); }
function utcTimestamp(value) { if (!value) return "Not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Not available" : date.toISOString(); }
export async function sendPaidLabNotification({ rental, order, paymentId, user, lab, fetchImpl = fetch }) {
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.FREE_LAB_NOTIFICATION_FROM; const to = process.env.PAID_LAB_NOTIFICATION_TO || "support@infokb.com";
  if (!apiKey || !from) return { sent: false, reason: "email configuration is missing" };
  const labName = lab?.title || "Unknown Lab";
  const text = ["New Paid Lab Rental", "", `Student: ${displayName(user)}`, `Email: ${user?.email || "Not provided"}`, `Lab: ${labName}`, "Type: Paid", `Amount: ${formatAmount(order.amount_minor, order.currency)}`, `Rental ID: ${rental.id}`, `Internal Payment Order ID: ${order.id}`, `Razorpay Order ID: ${order.razorpay_order_id}`, `Razorpay Payment ID: ${paymentId}`, `Status: ${rental.state === "preparing" ? "Preparing" : rental.state}`, `Paid At: ${utcTimestamp(order.paid_at)}`, "", "A paid Lab Rental has been received and requires preparation before access is granted."].join("\n");
  const response = await fetchImpl(RESEND_EMAILS_URL, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `paid-lab-rental-${rental.id}`, "User-Agent": "infokb-paid-lab-notification/1.0" }, body: JSON.stringify({ from, to: [to], subject: `New Paid Lab Rental - ${labName}`, text }) });
  if (!response.ok) throw new Error(`Resend request failed with status ${response.status}`); return { sent: true };
}
