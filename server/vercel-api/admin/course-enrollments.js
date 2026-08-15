import { checkBasicAuth, setCors } from "../_utils/auth.js";
import { getSupabaseAdmin } from "../_utils/supabase.js";
import { parseOptionalDate, requireExistingRow, requireExistingUser, validateWindow } from "../_utils/access.js";

export default async function handler(req, res) {
  setCors(res);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;

  const supabase = getSupabaseAdmin();
  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, student_id, course_id, enrolled_at, status, source, starts_at, expires_at, revoked_at, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ enrollments: data ?? [] });
    }

    if (req.method === "POST") {
      const body = req.body ?? {};
      const studentId = body.studentId;
      const courseId = body.courseId;
      const startsAt = parseOptionalDate(body.startsAt, "startsAt") ?? new Date().toISOString();
      const expiresAt = parseOptionalDate(body.expiresAt, "expiresAt") ?? null;
      validateWindow(startsAt, expiresAt);
      await Promise.all([
        requireExistingUser(supabase, studentId),
        requireExistingRow(supabase, "courses", courseId, "course"),
      ]);

      const { data, error } = await supabase.rpc("admin_grant_course_access", {
        p_student_id: studentId,
        p_course_id: courseId,
        p_starts_at: startsAt,
        p_expires_at: expiresAt,
      });
      if (error) throw error;
      return res.status(200).json({ enrollment: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Course access request failed.";
    const status = /required|not found|valid|later/.test(message.toLowerCase()) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}
