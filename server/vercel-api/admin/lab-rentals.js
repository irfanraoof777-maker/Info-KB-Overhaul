import { checkBasicAuth, setCors } from "../_utils/auth.js";
import { getSupabaseAdmin } from "../_utils/supabase.js";
import { effectiveLabStatus, parseOptionalDate, requireExistingRow, requireExistingUser, validateWindow } from "../_utils/access.js";

export default async function handler(req, res) {
  setCors(res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await checkBasicAuth(req, res))) return;

  const supabase = getSupabaseAdmin();
  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("lab_rentals")
        .select("id, user_id, lab_id, state, source, starts_at, expires_at, ready_at, cancelled_at, created_at, updated_at")
        .is("admin_history_hidden_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const now = new Date();
      return res.status(200).json({
        rentals: (data ?? []).map((row) => ({ ...row, effective_status: effectiveLabStatus(row, now) })),
      });
    }

    if (req.method === "POST") {
      const body = req.body ?? {};
      const studentId = body.studentId;
      const labId = body.labId;
      const startsAt = parseOptionalDate(body.startsAt, "startsAt") ?? null;
      const expiresAt = parseOptionalDate(body.expiresAt, "expiresAt") ?? null;
      validateWindow(startsAt, expiresAt);
      await Promise.all([
        requireExistingUser(supabase, studentId),
        requireExistingRow(supabase, "labs", labId, "lab"),
      ]);

      const { data, error } = await supabase.rpc("admin_assign_lab_rental", {
        p_student_id: studentId,
        p_lab_id: labId,
        p_starts_at: startsAt,
        p_expires_at: expiresAt,
      });
      if (error) throw error;
      return res.status(201).json({ rental: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lab rental request failed.";
    const status = /required|not found|valid|later/.test(message.toLowerCase()) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}
