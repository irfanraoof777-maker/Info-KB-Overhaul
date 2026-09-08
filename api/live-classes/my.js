import { requireStudent } from "../../server/vercel-api/_utils/student-auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireStudent(req, res);
  if (!auth) return;
  try {
    const { data: registrations, error } = await auth.supabase
      .from("live_class_registrations")
      .select("id,live_course_id,enrollment_status,payment_status,enrolled_at,updated_at")
      .eq("user_id", auth.user.id)
      .eq("payment_status", "paid")
      .eq("enrollment_status", "active")
      .order("enrolled_at", { ascending: false });
    if (error) throw error;
    const ids = [...new Set((registrations ?? []).map((registration) => registration.live_course_id))];
    const { data: classes, error: classesError } = ids.length
      ? await auth.supabase.from("live_courses").select("id,slug,title,thumbnail_url,instructor,duration,timezone,status,live_course_sessions(id,session_title,starts_at,ends_at,timezone)").in("id", ids)
      : { data: [], error: null };
    if (classesError) throw classesError;
    const registrationsByCourse = new Map((registrations ?? []).map((registration) => [registration.live_course_id, registration]));
    return res.status(200).json({
      liveClasses: (classes ?? []).map((liveClass) => ({
        ...liveClass,
        registration: registrationsByCourse.get(liveClass.id),
        live_course_sessions: (liveClass.live_course_sessions ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      })),
    });
  } catch (error) {
    console.error("[my-live-classes] failed", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Unable to load live classes." });
  }
}