import { checkBasicAuth, setCors } from "../../_utils/auth.js";
import { getSupabaseAdmin } from "../../_utils/supabase.js";
import { parseOptionalDate, validateWindow } from "../../_utils/access.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  setCors(res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await checkBasicAuth(req, res))) return;
  if (req.method !== "PATCH" && req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  const supabase = getSupabaseAdmin();
  if (!UUID_PATTERN.test(id)) return res.status(400).json({ error: "Lab rental ID is invalid." });
  try {
    if (req.method === "DELETE") {
      const { data, error } = await supabase.rpc("admin_hide_historical_lab_rental", { p_rental_id: id });
      if (error) throw error;
      return res.status(200).json({ rental: data });
    }
    const { data: current, error: currentError } = await supabase
      .from("lab_rentals")
      .select("id, user_id, lab_id, state, starts_at, expires_at, cancelled_at")

      .eq("id", id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return res.status(404).json({ error: "Lab rental not found." });

    const body = req.body ?? {};
    const action = body.action;
    let values;
    if (action === "start_preparing") {
      if (current.state !== "payment_pending") {
        throw new Error("Rental is not awaiting preparation.");
      }
      values = {};
    } else if (action === "mark_ready") {
      if (current.state !== "preparing") {
        throw new Error("Rental is not preparing.");
      }
      values = {};
      const startsAt = parseOptionalDate(body.startsAt, "startsAt") ?? current.starts_at ?? new Date().toISOString();
      const expiresAt = parseOptionalDate(body.expiresAt, "expiresAt") ?? current.expires_at;
      if (!expiresAt || new Date(expiresAt) <= new Date()) throw new Error("A Ready rental requires a future expiry time.");
      validateWindow(startsAt, expiresAt);
      values.starts_at = startsAt;
      values.expires_at = expiresAt;
    } else if (action === "cancel") {
      if (current.state === "cancelled") throw new Error("Rental is already cancelled.");
      values = {};
    } else if (action === "update_schedule" || action === "extend") {
      const startsAt = parseOptionalDate(body.startsAt, "startsAt");
      const expiresAt = parseOptionalDate(body.expiresAt, "expiresAt");
      values = {};
      if (startsAt !== undefined) values.starts_at = startsAt;
      if (expiresAt !== undefined) values.expires_at = expiresAt;
      if (action === "extend" && !expiresAt) throw new Error("An extension requires an expiry time.");
      if (!Object.keys(values).length) throw new Error("No schedule fields were supplied.");
      validateWindow(values.starts_at === undefined ? current.starts_at : values.starts_at, values.expires_at === undefined ? current.expires_at : values.expires_at);
    } else {
      throw new Error("Unsupported lab rental action.");
    }

    const { data, error } = await supabase.rpc("admin_update_lab_rental", {
      p_rental_id: id,
      p_action: action,
      p_starts_at: values.starts_at === undefined ? current.starts_at : values.starts_at,
      p_expires_at: values.expires_at === undefined ? current.expires_at : values.expires_at,
    });
    if (error) throw error;
    return res.status(200).json({ rental: data });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : error && typeof error === "object" && typeof error.message === "string"
        ? error.message
        : "Lab rental request failed.";
    const status = /not found/.test(message.toLowerCase())
      ? 404
      : /cannot|requires|already|unsupported|supplied|valid|later|not awaiting|not preparing|only cancelled|payment records|notification history|guacamole|provisioning/.test(message.toLowerCase())
        ? 400
        : 500;
    return res.status(status).json({ error: message });
  }
}
