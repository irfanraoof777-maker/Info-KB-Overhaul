const RESEND_EMAILS_URL = "https://api.resend.com/emails";

function displayName(user) {
  const metadata = user.user_metadata ?? {};
  return (metadata.full_name ?? metadata.name ?? [metadata.first_name, metadata.last_name].filter(Boolean).join(" ")) || "Not provided";
}

function utcTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toISOString();
}

export async function sendFreeLabNotification({ rental, user, lab, fetchImpl = fetch }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FREE_LAB_NOTIFICATION_FROM;
  const to = process.env.FREE_LAB_NOTIFICATION_TO;
  if (!apiKey || !from || !to) return { sent: false, reason: "email configuration is missing" };

  const labName = lab?.title || "Unknown Lab";
  const text = [
    "New Free Lab Rental", "", `Student: ${displayName(user)}`,
    `Email: ${user.email || "Not provided"}`, `Lab: ${labName}`, "Type: Free",
    `Duration: ${lab?.duration || "Not provided"}`, `Rental ID: ${rental.id}`,
    `Status: ${rental.state}`, `Requested At: ${utcTimestamp(rental.created_at)}`, "",
    "A new free lab rental has been claimed and may require manual preparation and activation.",
  ].join("\n");
  const response = await fetchImpl(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `free-lab-rental-${rental.id}`,
      "User-Agent": "infokb-free-lab-notification/1.0",
    },
    body: JSON.stringify({ from, to: [to], subject: `New Free Lab Rental - ${labName}`, text }),
  });
  if (!response.ok) throw new Error(`Resend request failed with status ${response.status}`);
  return { sent: true };
}