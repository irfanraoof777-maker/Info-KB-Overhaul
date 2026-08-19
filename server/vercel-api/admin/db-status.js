import { checkBasicAuth, setCors } from "../_utils/auth.js";
import { getSupabaseAdmin, SETUP_SQL } from "../_utils/supabase.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await checkBasicAuth(req, res))) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("courses").select("id").limit(1);
    if (error) {
      return res.status(200).json({ ready: false, sql: SETUP_SQL, error: error.message });
    }
    return res.status(200).json({ ready: true });
  } catch (err) {
    return res.status(500).json({ error: err.message ?? "Unknown error" });
  }
}
