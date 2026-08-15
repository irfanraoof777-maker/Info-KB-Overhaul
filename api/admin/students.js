import { checkBasicAuth, setCors } from "../_utils/auth.js";
import { getSupabaseAdmin } from "../_utils/supabase.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = getSupabaseAdmin();
    const [usersResult, enrollmentsResult] = await Promise.all([
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase
        .from("enrollments")
        .select("student_id, enrolled_at, courses(id, name, category, price)"),
    ]);
    if (usersResult.error) throw usersResult.error;

    const enrollments = enrollmentsResult.data ?? [];
    const enrollmentsByUser = {};
    for (const e of enrollments) {
      if (!enrollmentsByUser[e.student_id]) enrollmentsByUser[e.student_id] = [];
      enrollmentsByUser[e.student_id].push(e);
    }

    const students = usersResult.data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      enrollments: (enrollmentsByUser[u.id] ?? []).map((e) => ({
        course: e.courses,
        enrolled_at: e.enrolled_at,
      })),
    }));

    return res.status(200).json({ students });
  } catch (err) {
    return res.status(500).json({ error: err.message ?? "Unknown error" });
  }
}
