import { requireStudent } from "../server/vercel-api/_utils/student-auth.js";
import { canAccessLab, effectiveLabStatus } from "../server/vercel-api/_utils/access.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireStudent(req, res);
  if (!auth) return;

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const [enrollmentsResult, rentalsResult] = await Promise.all([
      auth.supabase
        .from("enrollments")
        .select("id, course_id, enrolled_at, starts_at, expires_at")
        .eq("student_id", auth.user.id)
        .eq("status", "active")
        .is("revoked_at", null)
        .lte("starts_at", nowIso)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
      auth.supabase
        .from("lab_rentals")
        .select("id, lab_id, state, starts_at, expires_at, ready_at, cancelled_at, created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (enrollmentsResult.error) throw enrollmentsResult.error;
    if (rentalsResult.error) throw rentalsResult.error;

    const enrollmentRows = enrollmentsResult.data ?? [];
    const courseIds = [...new Set(enrollmentRows.map((row) => row.course_id).filter(Boolean))];
    const courseResult = courseIds.length
      ? await auth.supabase
          .from("courses")
          .select("id, name, category, duration, difficulty_level, thumbnail_url, trailer_url, description")
          .in("id", courseIds)
      : { data: [], error: null };
    if (courseResult.error) throw courseResult.error;

    const coursesById = new Map((courseResult.data ?? []).map((course) => [course.id, course]));
    const courses = [];
    const seenCourses = new Set();
    for (const enrollment of enrollmentRows) {
      if (!enrollment.course_id || seenCourses.has(enrollment.course_id)) continue;
      const course = coursesById.get(enrollment.course_id);
      if (!course) continue;
      seenCourses.add(enrollment.course_id);
      courses.push({
        enrollmentId: enrollment.id,
        courseId: enrollment.course_id,
        enrolledAt: enrollment.enrolled_at,
        startsAt: enrollment.starts_at,
        expiresAt: enrollment.expires_at,
        canAccess: true,
        course,
      });
    }

    const rentalRows = rentalsResult.data ?? [];
    const labIds = [...new Set(rentalRows.map((row) => row.lab_id).filter(Boolean))];
    const labResult = labIds.length
      ? await auth.supabase
          .from("labs")
          .select("id, title, description, image_url, category, duration")
          .in("id", labIds)
      : { data: [], error: null };
    if (labResult.error) throw labResult.error;

    const labsById = new Map((labResult.data ?? []).map((lab) => [lab.id, lab]));
    const labs = rentalRows.flatMap((rental) => {
      const lab = labsById.get(rental.lab_id);
      if (!lab) return [];
      return [{
        rentalId: rental.id,
        labId: rental.lab_id,
        storedState: rental.state,
        status: effectiveLabStatus(rental, now),
        startsAt: rental.starts_at,
        expiresAt: rental.expires_at,
        canAccess: canAccessLab(rental, now),
        lab,
      }];
    });

    return res.status(200).json({
      courses,
      labs,
      counts: { courses: courses.length, labs: labs.length },
    });
  } catch (error) {
    console.error("[dashboard-access] failed", error);
    return res.status(500).json({ error: "Unable to load dashboard access." });
  }
}
