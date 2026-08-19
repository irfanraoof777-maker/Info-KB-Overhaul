import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "../../server/vercel-api/_utils/supabase.js";
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const token = req.body?.token;
  if (typeof token !== "string" || token.length < 32) return res.status(400).json({ valid: false });
  try {
    const { data, error } = await getSupabaseAdmin().from("admin_password_reset_tokens").select("id").eq("token_hash", tokenHash(token)).is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error) throw error;
    return res.status(200).json({ valid: Boolean(data) });
  } catch (error) {
    console.error("[admin-password-reset] validation failed", error);
    return res.status(500).json({ valid: false });
  }
}