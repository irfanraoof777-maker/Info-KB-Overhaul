import { checkBasicAuth, setCors } from "../../_utils/auth.js";
import { getSupabaseAdmin } from "../../_utils/supabase.js";
import { parseOptionalDate, validateWindow } from "../../_utils/access.js";

export default async function handler(req, res) {
  setCors(res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  const supabase = getSupabaseAdmin();
  try {
    const { data: current, error: currentError } = await supabase
      .from("enrollments")
      .select("id, student_id, course_id, starts_at, expires_at")
      .eq("id", id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return res.status(404).json({ error: "Enrollment not found." });

    const body = req.body ?? {};
    const action = body.action;
    let values;
    if (action === "revoke") {
      const { data, error } = await supabase.rpc("admin_revoke_course_access", {
        p_enrollment_id: id,
      });
      if (error) throw error;
      return res.status(200).json({ enrollment: data });
    } else if (action === "update_schedule") {
      const startsAt = parseOptionalDate(body.startsAt, "startsAt");
      const expiresAt = parseOptionalDate(body.expiresAt, "expiresAt");
      values = {};
      if (startsAt !== undefined) values.starts_at = startsAt ?? new Date().toISOString();
      if (expiresAt !== undefined) values.expires_at = expiresAt;
      if (!Object.keys(values).length) throw new Error("No schedule fields were supplied.");
      validateWindow(values.starts_at ?? current.starts_at, values.expires_at === undefined ? current.expires_at : values.expires_at);
    } else {
      throw new Error("Unsupported course access action.");
    }

    const { data, error } = await supabase.rpc("admin_update_course_schedule", {
      p_enrollment_id: id,
      p_starts_at: values.starts_at ?? current.starts_at,
      p_expires_at: values.expires_at === undefined ? current.expires_at : values.expires_at,
    });
    if (error) throw error;
    return res.status(200).json({ enrollment: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Course access request failed.";
    const status = /unsupported|supplied|valid|later/.test(message.toLowerCase()) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}
