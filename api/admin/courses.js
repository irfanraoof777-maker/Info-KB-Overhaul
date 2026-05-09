import { checkBasicAuth, setCors } from "../_utils/auth.js";
import { getSupabaseAdmin } from "../_utils/supabase.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;

  if (req.method === "GET") {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ courses: data ?? [] });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown error" });
    }
  }

  if (req.method === "POST") {
    try {
      const supabase = getSupabaseAdmin();
      const body = req.body ?? {};
      const { data, error } = await supabase
        .from("courses")
        .insert([body])
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ course: data });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
