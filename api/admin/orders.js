import { checkBasicAuth, setCors } from "../_utils/auth.js";
import { getSupabaseAdmin } from "../_utils/supabase.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.status(200).json({ orders: data ?? [] });
  } catch (err) {
    return res.status(500).json({ error: err.message ?? "Unknown error" });
  }
}
