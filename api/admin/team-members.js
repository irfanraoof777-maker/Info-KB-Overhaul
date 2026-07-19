import { checkBasicAuth, setCors } from "../_utils/auth.js";
import { getSupabaseAdmin } from "../_utils/supabase.js";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;

  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("trainers")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return res.status(200).json({ members: data ?? [] });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown error" });
    }
  }

  if (req.method === "POST") {
    try {
      const body = req.body ?? {};
      if (body.experience_years !== undefined) {
        body.experience_years = parseInt(String(body.experience_years), 10) || 0;
      }
      const { data, error } = await supabase.from("trainers").insert([body]).select().single();
      if (error) throw error;
      return res.status(200).json({ member: data });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
