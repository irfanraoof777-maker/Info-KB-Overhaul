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

// ── POST /enroll — temporarily unavailable ──
// Automatic enrollment will be restored only after a server-verified payment
// webhook exists. The user must then be derived from a verified session;
// browser-supplied payment claims must never authorize enrollment.
router.post("/enroll", (_req: Request, res: Response) => {
  res.status(503).json({ error: "Enrollment is coming soon." });
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
      .select("course_id, enrolled_at, courses(id, name, category, price, duration, difficulty_level, thumbnail_url, trailer_url, description)")
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
