import { createHash } from "node:crypto";
import { hashAdminPassword } from "../../server/vercel-api/_utils/auth.js";
import { getSupabaseAdmin } from "../../server/vercel-api/_utils/supabase.js";
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
export const config = { api: { bodyParser: true } };
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { token, password } = req.body ?? {};
  if (typeof token !== "string" || token.length < 32 || typeof password !== "string" || password.length < 12) return res.status(400).json({ error: "Invalid password reset request." });
  try {
    const { data: updated, error } = await getSupabaseAdmin().rpc("consume_admin_password_reset", { p_token_hash: tokenHash(token), p_password_hash: await hashAdminPassword(password) });
    if (error) throw error;
    if (!updated) return res.status(400).json({ error: "This password reset link is invalid or has expired." });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[admin-password-reset] completion failed", error);
    return res.status(500).json({ error: "Unable to update the password right now." });
  }
}