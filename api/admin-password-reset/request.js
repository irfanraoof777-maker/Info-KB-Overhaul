import { createHash, randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "../../server/vercel-api/_utils/supabase.js";

const RECIPIENTS = ["imran@infokb.com", "irfan@infokb.com"];
const RESET_URL = () => process.env.ADMIN_PASSWORD_RESET_URL || "https://infokb.com/admin/reset-password";
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_PASSWORD_RESET_FROM || process.env.FREE_LAB_NOTIFICATION_FROM;
  if (!apiKey || !from) return res.status(500).json({ error: "Password reset email is not configured." });

  const token = randomBytes(32).toString("base64url");
  try {
    const { data: accepted, error } = await getSupabaseAdmin().rpc("create_admin_password_reset", {
      p_token_hash: tokenHash(token),
      p_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    if (error) throw error;
    // Keep the response identical during the cooldown so callers cannot use it to spam recipients.
    if (!accepted) return res.status(200).json({ ok: true });

    const resetLink = `${RESET_URL()}?token=${encodeURIComponent(token)}`;
    const text = `A password reset was requested for the InfoKB Admin panel.\n\nReset Admin Password: ${resetLink}\n\nIf you did not request this password reset, you can ignore this email.`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: RECIPIENTS, subject: "InfoKB Admin Password Reset", text, html: `<p>A password reset was requested for the InfoKB Admin panel.</p><p><a href="${resetLink}">Reset Admin Password</a></p><p>If you did not request this password reset, you can ignore this email.</p>` }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[admin-password-reset] request failed", error);
    return res.status(500).json({ error: "Unable to send a reset link right now." });
  }
}