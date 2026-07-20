import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import healthRouter from "./health";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);

function getSupabaseAdmin() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SECRET_KEY"];
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ── POST /enroll — upsert enrollment + record order ──
router.post("/enroll", async (req: Request, res: Response) => {
  const { user_id, user_email, course_id, course_name, amount, payment_id } = (req.body ?? {}) as Record<string, unknown>;
  if (!user_id || !course_id) {
    res.status(400).json({ error: "user_id and course_id are required." });
    return;
  }
  try {
    const supabase = getSupabaseAdmin();

    // Upsert enrollment (idempotent)
    const { error: enrollErr } = await supabase
      .from("enrollments")
      .upsert({ user_id, course_id }, { onConflict: "user_id,course_id" });
    if (enrollErr) throw enrollErr;

    // Record order if payment info provided
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

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[enroll] error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Enrollment failed." });
  }
});

// ── GET /my-courses — fetch enrolled courses for authenticated user ──
router.get("/my-courses", async (req: Request, res: Response) => {
  const authHeader = (req.headers["authorization"] as string | undefined) ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const supabase = getSupabaseAdmin();

    // Verify the JWT and get user
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      res.status(401).json({ error: "Invalid or expired token." });
      return;
    }

    const { data, error } = await supabase
      .from("enrollments")
      .select("course_id, enrolled_at, courses(*)")
      .eq("user_id", user.id);

    if (error) throw error;

    res.status(200).json({ courses: data ?? [] });
  } catch (err) {
    console.error("[my-courses] error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to fetch courses." });
  }
});

// ── Public: Trainers (no auth required — powers the About page) ──
router.get("/trainers", async (_req, res) => {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SECRET_KEY"];
    if (!url || !key) { res.json({ trainers: [] }); return; }
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supabase
      .from("trainers")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) { res.json({ trainers: [] }); return; }
    res.json({ trainers: data ?? [] });
  } catch {
    res.json({ trainers: [] });
  }
});

export default router;
