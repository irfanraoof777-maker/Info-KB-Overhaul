import { checkBasicAuth, setCors } from "../../_utils/auth.js";
import { getSupabaseAdmin } from "../../_utils/supabase.js";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id in URL." });

  const supabase = getSupabaseAdmin();

  if (req.method === "PUT") {
    try {
      const body = { ...(req.body ?? {}) };
      delete body.id;
      delete body.created_at;
      if (body.experience_years !== undefined) {
        body.experience_years = parseInt(String(body.experience_years), 10) || 0;
      }
      const { data, error } = await supabase
        .from("trainers")
        .update(body)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ member: data });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown error" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { error } = await supabase.from("trainers").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown error" });
    }
  }

  return res.status(405).json({ error: `Method "${req.method}" not allowed.` });
}
