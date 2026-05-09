import { checkBasicAuth, setCors } from "../../_utils/auth.js";
import { getSupabaseAdmin } from "../../_utils/supabase.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;

  const { id } = req.query;

  if (req.method === "PUT") {
    try {
      const supabase = getSupabaseAdmin();
      const body = { ...(req.body ?? {}) };
      delete body.id;
      delete body.created_at;
      const { data, error } = await supabase
        .from("courses")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ course: data });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown error" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
