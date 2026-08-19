import { checkBasicAuth, setCors } from "../../_utils/auth.js";
import { getSupabaseAdmin } from "../../_utils/supabase.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  setCors(res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await checkBasicAuth(req, res))) return;
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });
  const rentalId = typeof req.query.id === "string" ? req.query.id : "";
  const launchUrl = typeof req.body?.launchUrl === "string" ? req.body.launchUrl.trim() : "";
  if (!UUID_PATTERN.test(rentalId) || !/^https?:\/\/\S+$/i.test(launchUrl)) {
    return res.status(400).json({ error: "A valid HTTP or HTTPS launch URL is required." });
  }
  try {
    const { data, error } = await getSupabaseAdmin().rpc("admin_set_lab_launch_configuration", {
      p_rental_id: rentalId, p_provider: "guacamole_test", p_launch_url: launchUrl,
    });
    if (error) throw error;
    const configuration = Array.isArray(data) ? data[0] : data;
    return res.status(200).json({ configuration: {
      rentalId: configuration.rental_id, provider: configuration.provider,
      updatedAt: configuration.updated_at,
    } });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : error && typeof error === "object" && typeof error.message === "string"
        ? error.message
        : "Launch configuration failed.";
    const status = /not found|cancelled|invalid/.test(message.toLowerCase()) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}
