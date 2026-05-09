import { getSupabaseAdmin } from "./_utils/supabase.js";
import { setCors } from "./_utils/auth.js";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user_id, user_email, course_id, course_name, amount, payment_id } = req.body ?? {};
  if (!user_id || !course_id) {
    return res.status(400).json({ error: "user_id and course_id are required." });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Upsert enrollment (idempotent)
    const { error: enrollErr } = await supabase
      .from("enrollments")
      .upsert({ user_id, course_id }, { onConflict: "user_id,course_id" });
    if (enrollErr) throw enrollErr;

    // Record order
    if (payment_id && amount) {
      const { error: orderErr } = await supabase.from("orders").insert([{
        user_id,
        user_email: user_email ?? "",
        course_id,
        course_name: course_name ?? "",
        amount: Number(amount),
        status: "completed",
        payment_id,
      }]);
      if (orderErr) console.error("[enroll] order insert error:", orderErr);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[enroll] error:", err);
    return res.status(500).json({ error: err.message ?? "Enrollment failed." });
  }
}
