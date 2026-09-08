import { checkBasicAuth, setCors } from "../_utils/auth.js";
import { getSupabaseAdmin } from "../_utils/supabase.js";
import { normalizeLiveClass, normalizeSessions } from "./live-class-validation.js";

const missingLinkedInColumn = (error) => error?.code === "PGRST204" && /instructor_linkedin_url/i.test(`${error.message ?? ""} ${error.details ?? ""}`);

export async function insertLiveClass(supabase, course) {
  let payload = course;
  while (true) {
    const result = await supabase.from("live_courses").insert(payload).select().single();
    if (!result.error) return result;
    if (missingLinkedInColumn(result.error) && Object.hasOwn(payload, "instructor_linkedin_url")) {
      const { instructor_linkedin_url, ...legacyCourse } = payload;
      payload = legacyCourse;
      continue;
    }

    return result;
  }
}
export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await checkBasicAuth(req, res))) return;
  const supabase = getSupabaseAdmin();
  try {
    if (req.method === "GET") {
      const { data, error } = await supabase.from("live_courses").select("*, live_course_sessions(id,session_title,starts_at,ends_at,timezone)").order("created_at", { ascending: false });
      if (error) throw error;
      return res.status(200).json({ liveClasses: data ?? [] });
    }
    if (req.method === "POST") {
      const course = normalizeLiveClass(req.body);
      const sessions = normalizeSessions(req.body?.sessions) ?? [];
      const inserted = await insertLiveClass(supabase, course);
      if (inserted.error) throw inserted.error;
      const data = inserted.data;
      if (sessions.length) {
        const result = await supabase.from("live_course_sessions").insert(sessions.map((session) => ({ ...session, live_course_id: data.id })));
        if (result.error) {
          await supabase.from("live_courses").delete().eq("id", data.id);
          throw result.error;
        }
      }
      return res.status(201).json({ liveClass: data });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Live class request failed." });
  }
}