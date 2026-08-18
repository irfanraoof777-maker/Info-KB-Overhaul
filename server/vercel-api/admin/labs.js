import { checkBasicAuth, setCors } from "../_utils/auth.js";
import { getSupabaseAdmin, SETUP_SQL } from "../_utils/supabase.js";
import { validateLabPricing } from "../_utils/lab-pricing.js";

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;

  if (req.method === "GET") {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("labs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (MISSING_TABLE_CODES.has(error.code)) {
          return res.status(503).json({ error: "The labs table does not exist yet. Run the setup SQL in Supabase Dashboard → SQL Editor, then click Refresh.", setupRequired: true, sql: SETUP_SQL });
        }
        throw error;
      }
      return res.status(200).json({ labs: data ?? [] });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown error" });
    }
  }

  if (req.method === "POST") {
    try {
      const supabase = getSupabaseAdmin();
      const body = { ...(req.body ?? {}) };
      const pricing = validateLabPricing(body);
      if (!Object.hasOwn(pricing, "price_usd")) {
        return res.status(400).json({ error: "Regular Price (USD) is required." });
      }
      delete body.price;
      delete body.discounted_price;
      const { data, error } = await supabase
        .from("labs")
        .insert([{ ...body, ...pricing }])
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ lab: data });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
