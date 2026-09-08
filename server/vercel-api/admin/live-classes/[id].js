import { checkBasicAuth, setCors } from "../../_utils/auth.js";
import { getSupabaseAdmin } from "../../_utils/supabase.js";
import { normalizeLiveClass, normalizeSessions } from "../live-class-validation.js";

const isMissingLinkedInColumn = (error) => error?.code === "PGRST204" && /instructor_linkedin_url/i.test(`${error.message ?? ""} ${error.details ?? ""}`);
const isValidationError = (error) => error instanceof Error;

const logFailure = (operation, id, error) => {
  console.error("[admin-live-classes] request failed", {
    operation,
    liveClassId: id,
    code: error?.code,
    message: error instanceof Error ? error.message : error?.message,
    details: error?.details,
  });
};

export async function updateLiveClass(supabase, id, course) {
  let update = course;
  let result = await supabase.from("live_courses").update(update).eq("id", id).select().single();
  if (result.error && isMissingLinkedInColumn(result.error) && Object.hasOwn(update, "instructor_linkedin_url")) {
    const { instructor_linkedin_url, ...legacyCourse } = update;
    console.warn("[admin-live-classes] instructor_linkedin_url is unavailable in the database schema; saving remaining fields", { liveClassId: id, code: result.error.code });
    update = legacyCourse;
    result = await supabase.from("live_courses").update(update).eq("id", id).select().single();
  }
  return result;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!(await checkBasicAuth(req, res))) return;

  const supabase = getSupabaseAdmin();
  const id = req.query?.id;
  if (typeof id !== "string") return res.status(400).json({ error: "Missing live class id." });

  try {
    if (req.method === "GET") {
      const [{ data: liveClass, error }, { data: registrations, error: registrationsError }] = await Promise.all([
        supabase.from("live_courses").select("*, live_course_sessions(*)").eq("id", id).maybeSingle(),
        supabase.from("live_class_registrations").select("id,user_id,payment_reference,payment_status,enrollment_status,enrolled_at").eq("live_course_id", id).order("enrolled_at", { ascending: false }),
      ]);
      if (error) throw error;
      if (registrationsError) throw registrationsError;
      if (!liveClass) return res.status(404).json({ error: "Live class not found." });
      return res.status(200).json({ liveClass, registrations: registrations ?? [] });
    }

    if (req.method === "PUT") {
      const course = normalizeLiveClass(req.body, { partial: true });
      const sessions = normalizeSessions(req.body?.sessions);
      if (!Object.keys(course).length && sessions === null) return res.status(400).json({ error: "No valid changes provided." });

      let data;
      if (Object.keys(course).length) {
        const result = await updateLiveClass(supabase, id, course);
        if (result.error) throw result.error;
        data = result.data;
      }
      if (sessions !== null) {
        const removed = await supabase.from("live_course_sessions").delete().eq("live_course_id", id);
        if (removed.error) throw removed.error;
        if (sessions.length) {
          const inserted = await supabase.from("live_course_sessions").insert(sessions.map((session) => ({ ...session, live_course_id: id })));
          if (inserted.error) throw inserted.error;
        }
      }
      return res.status(200).json({ liveClass: data });
    }

    if (req.method === "DELETE") {
      const { error } = await supabase.from("live_courses").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    logFailure(req.method, id, error);
    if (isValidationError(error)) return res.status(400).json({ error: error.message });
    return res.status(500).json({ error: "Live class request failed." });
  }
}