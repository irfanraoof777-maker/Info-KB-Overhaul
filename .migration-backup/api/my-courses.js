import { getSupabaseAdmin } from "./_utils/supabase.js";
import { setCors } from "./_utils/auth.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers["authorization"] ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token." });
  }
  const token = authHeader.slice(7);

  try {
    const supabase = getSupabaseAdmin();

    // Verify the JWT and get user
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Invalid or expired token." });

    const { data, error } = await supabase
      .from("enrollments")
      .select("course_id, enrolled_at, courses(*)")
      .eq("user_id", user.id);

    if (error) throw error;

    return res.status(200).json({ courses: data ?? [] });
  } catch (err) {
    console.error("[my-courses] error:", err);
    return res.status(500).json({ error: err.message ?? "Failed to fetch courses." });
  }
}
