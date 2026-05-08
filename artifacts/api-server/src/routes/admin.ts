import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

function getSupabaseAdmin() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SECRET_KEY"];
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expectedUser = process.env["ADMIN_USERNAME"];
  const expectedPass = process.env["ADMIN_PASSWORD"];
  if (!expectedUser || !expectedPass) {
    res.status(500).json({ error: "Admin credentials not configured on server." });
    return;
  }
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Basic ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  const colonIdx = decoded.indexOf(":");
  const user = decoded.slice(0, colonIdx);
  const pass = decoded.slice(colonIdx + 1);
  if (user !== expectedUser || pass !== expectedPass) {
    res.status(401).json({ error: "Invalid admin credentials." });
    return;
  }
  next();
}

export const SETUP_SQL = `-- Run this once in your Supabase Dashboard → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS public.courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  category      text NOT NULL DEFAULT '',
  price         numeric(10,2) NOT NULL DEFAULT 0,
  description   text NOT NULL DEFAULT '',
  difficulty_level text NOT NULL DEFAULT 'Beginner',
  duration      text NOT NULL DEFAULT '',
  trailer_url   text NOT NULL DEFAULT '',
  thumbnail_url text NOT NULL DEFAULT '',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  course_id   uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  user_email  text NOT NULL DEFAULT '',
  course_name text NOT NULL DEFAULT '',
  amount      numeric(10,2) NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'completed',
  payment_id  text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id)
);`;

// ── Verify credentials (lightweight — no Supabase call) ──────
router.get("/verify", adminAuth, (_req, res) => {
  res.json({ ok: true });
});

// ── DB status ────────────────────────────────────────────────
router.get("/db-status", adminAuth, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("courses").select("id").limit(1);
    if (error) {
      res.json({ ready: false, sql: SETUP_SQL, error: error.message });
    } else {
      res.json({ ready: true });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown" });
  }
});

// ── Courses ──────────────────────────────────────────────────
router.get("/courses", adminAuth, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ courses: data ?? [] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown" });
  }
});

router.post("/courses", adminAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const body = req.body as Record<string, unknown>;
    const { data, error } = await supabase
      .from("courses")
      .insert([body])
      .select()
      .single();
    if (error) throw error;
    res.json({ course: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown" });
  }
});

router.put("/courses/:id", adminAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    const supabase = getSupabaseAdmin();
    const body = req.body as Record<string, unknown>;
    delete body.id;
    delete body.created_at;
    const { data, error } = await supabase
      .from("courses")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json({ course: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown" });
  }
});

router.delete("/courses/:id", adminAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown" });
  }
});

// ── Students ─────────────────────────────────────────────────
router.get("/students", adminAuth, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const [usersResult, enrollmentsResult] = await Promise.all([
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase
        .from("enrollments")
        .select("user_id, enrolled_at, courses(id, name, category, price)"),
    ]);
    if (usersResult.error) throw usersResult.error;

    type EnrollmentRow = {
      user_id: string;
      enrolled_at: string;
      courses: { id: string; name: string; category: string; price: number } | null;
    };
    const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[];

    const enrollmentsByUser: Record<string, EnrollmentRow[]> = {};
    for (const e of enrollments) {
      if (!enrollmentsByUser[e.user_id]) enrollmentsByUser[e.user_id] = [];
      enrollmentsByUser[e.user_id].push(e);
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

    res.json({ students });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown" });
  }
});

// ── Orders ───────────────────────────────────────────────────
router.get("/orders", adminAuth, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ orders: data ?? [] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown" });
  }
});

// ── Users (existing) ─────────────────────────────────────────
router.get("/users", adminAuth, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown" });
  }
});

router.delete("/users/:id", adminAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

export default router;
