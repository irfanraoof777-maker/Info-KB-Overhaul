import { checkBasicAuth, setCors } from "../../_utils/auth.js";
import { getSupabaseAdmin } from "../../_utils/supabase.js";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing lab id in URL." });

  if (req.method === "PUT") {
    try {
      const supabase = getSupabaseAdmin();
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      body = { ...(body ?? {}) };
      delete body.id;
      delete body.created_at;
      delete body.updated_at;

      if (Object.keys(body).length === 0) {
        return res.status(400).json({ error: "Request body is empty — nothing to update." });
      }

      const { data, error } = await supabase
        .from("labs")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message ?? "Database update failed.", code: error.code });
      if (!data) return res.status(404).json({ error: `Lab "${id}" not found.` });
      return res.status(200).json({ lab: data });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown server error." });
    }
  }

  if (req.method === "DELETE") {
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("labs").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message ?? "Database delete failed." });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown server error." });
    }
  }

  return res.status(405).json({ error: `Method "${req.method}" not allowed. Supported: PUT, DELETE.` });
}
