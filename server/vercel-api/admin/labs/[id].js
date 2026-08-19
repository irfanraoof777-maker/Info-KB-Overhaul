import { checkBasicAuth, setCors } from "../../_utils/auth.js";
import { getSupabaseAdmin } from "../../_utils/supabase.js";
import { validateLabPricing } from "../../_utils/lab-pricing.js";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await checkBasicAuth(req, res))) return;

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
      // Preserve legacy INR values already stored on this Lab, but never
      // allow an Admin client to create, change, or clear them.
      delete body.price_inr;
      delete body.discounted_price_inr;

      if (Object.keys(body).length === 0) {
        return res.status(400).json({ error: "Request body is empty — nothing to update." });
      }

      const hasPricing = ["price_usd", "discounted_price_usd"].some((field) => Object.hasOwn(body, field));
      let pricing = {};
      if (hasPricing) {
        const { data: current, error: currentError } = await supabase.from("labs").select("price_usd, discounted_price_usd").eq("id", id).maybeSingle();
        if (currentError) throw currentError;
        if (!current) return res.status(404).json({ error: `Lab "${id}" not found.` });
        pricing = validateLabPricing(body, current);
      }
      delete body.price;
      delete body.discounted_price;

      const { data, error } = await supabase
        .from("labs")
        .update({ ...body, ...pricing, updated_at: new Date().toISOString() })
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
      const [rentals, paymentOrders] = await Promise.all([
        supabase.from("lab_rentals").select("id", { count: "exact", head: true }).eq("lab_id", id),
        supabase.from("lab_payment_orders").select("id", { count: "exact", head: true }).eq("lab_id", id),
      ]);
      if (rentals.error || paymentOrders.error) throw rentals.error ?? paymentOrders.error;
      const references = { labRentals: rentals.count ?? 0, labPaymentOrders: paymentOrders.count ?? 0 };
      if (references.labRentals > 0 || references.labPaymentOrders > 0) {
        return res.status(409).json({
          error: "This lab has existing rental, access, or payment records and cannot be deleted. Disable the lab instead.",
          code: "LAB_HAS_HISTORY",
          references,
        });
      }
      const { error } = await supabase.from("labs").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message ?? "Database delete failed." });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message ?? "Unknown server error." });
    }
  }

  return res.status(405).json({ error: `Method "${req.method}" not allowed. Supported: PUT, DELETE.` });
}
