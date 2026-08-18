const RESEND_EMAILS_URL = "https://api.resend.com/emails";

function displayName(user) {
  const metadata = user?.user_metadata ?? {};
  return (metadata.full_name ?? metadata.name ?? [metadata.first_name, metadata.last_name].filter(Boolean).join(" ")) || "Not provided";
}

function formatAmount(amountMinor, currency) {
  if (currency === "INR") return `INR ${(Number(amountMinor) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${amountMinor ?? "Not available"} ${currency ?? ""}`.trim();
}

function formatPaidAt(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "Not available";
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.day} ${values.month} ${values.year}, ${values.hour}:${values.minute} ${values.dayPeriod.toUpperCase()} IST`;
}

async function resendFailureMessage(response) {
  let body;
  try { body = await response.json(); } catch { return `Resend request failed with status ${response.status}`; }
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) : "";
  return message ? `Resend request failed with status ${response.status}: ${message}` : `Resend request failed with status ${response.status}`;
}

export async function sendStudentPaidLabReceipt({ rental, order, paymentId, user, lab, fetchImpl = fetch }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PAID_LAB_RECEIPT_FROM;
  const recipient = user?.email;
  if (!apiKey || !from) return { sent: false, reason: "email configuration is missing" };
  if (!recipient) return { sent: false, reason: "student email is unavailable" };
  const labName = lab?.title || "Unknown Lab";
  const text = [
    "Payment Successful", "", `Hello ${displayName(user)},`, "",
    `Your payment for ${labName} was successful. Your lab is currently being prepared.`,
    "Credentials and access instructions will be provided once it is ready. Access may be delivered through your registered email and/or your InfoKB dashboard.", "",
    "Payment Receipt", "", `Student Full Name: ${displayName(user)}`, `Registered Email: ${recipient}`,
    `Lab Name: ${labName}`, `Amount Paid: ${formatAmount(order.amount_minor, order.currency)}`, `Currency: ${order.currency ?? "Not available"}`,
    "Payment Status: Paid", "Lab Status: Preparing", `Payment Date: ${formatPaidAt(order.paid_at)}`,
    `Rental ID: ${rental.id}`, `Internal Payment Order ID: ${order.id}`, `Razorpay Order ID: ${order.razorpay_order_id}`, `Razorpay Payment ID: ${paymentId}`
  ].join("\n");
  const response = await fetchImpl(RESEND_EMAILS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `student-paid-lab-receipt-${rental.id}`, "User-Agent": "infokb-student-paid-lab-receipt/1.0" },
    body: JSON.stringify({ from, to: [recipient], subject: "Payment Successful - Your InfoKB Lab Is Being Prepared", text })
  });
  if (!response.ok) throw new Error(await resendFailureMessage(response));
  return { sent: true };
}
