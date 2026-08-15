import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router: IRouter = Router();

function getSupabaseAdmin() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SECRET_KEY"];
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Supabase throws PostgrestError objects, NOT standard Error instances.
 * PostgrestError = { message, details, hint, code } — none of which are
 * accessible via `instanceof Error`. This helper handles both cases and
 * returns the most useful string for display / logging.
 */
function extractError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err !== null && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof e["message"] === "string") parts.push(e["message"]);
    if (typeof e["details"] === "string" && e["details"]) parts.push(`Details: ${e["details"]}`);
    if (typeof e["hint"] === "string" && e["hint"]) parts.push(`Hint: ${e["hint"]}`);
    if (typeof e["code"] === "string" && e["code"]) parts.push(`(code: ${e["code"]})`);
    if (parts.length) return parts.join(" — ");
  }
  return String(err);
}

/** PostgreSQL / PostgREST error codes meaning the table doesn't exist yet */
const MISSING_TABLE_CODES = new Set([
  "42P01",    // PostgreSQL: relation does not exist
  "PGRST205", // PostgREST: table not found in schema cache
]);

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

export const SETUP_SQL = `-- Apply the reviewed, versioned files under supabase/migrations in order.
-- Runtime setup SQL is no longer supported.
/* Retired legacy setup reference; intentionally commented out.

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

CREATE TABLE IF NOT EXISTS public.labs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  description      text NOT NULL DEFAULT '',
  image_url        text NOT NULL DEFAULT '',
  category         text NOT NULL DEFAULT '',
  duration         text NOT NULL DEFAULT '',
  price            numeric(10,2) NOT NULL DEFAULT 0,
  discounted_price numeric(10,2),
  enabled          boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Allow the anonymous (public) role to read from labs — same as courses.
-- Without this, direct Supabase queries from the browser return empty results
-- if Supabase has RLS auto-enabled on the project.
ALTER TABLE public.labs DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.labs TO anon, authenticated;

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
);

-- Team members table (handles both fresh install and migration from old trainers schema)
DO $
BEGIN
  -- Create with new schema if it doesn't exist yet
  CREATE TABLE IF NOT EXISTS public.trainers (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name             text NOT NULL DEFAULT '',
    role             text NOT NULL DEFAULT '',
    certifications   text NOT NULL DEFAULT '',
    experience_years integer NOT NULL DEFAULT 0,
    bio              text NOT NULL DEFAULT '',
    photo_url        text NOT NULL DEFAULT '',
    sort_order       integer NOT NULL DEFAULT 0,
    created_at       timestamptz DEFAULT now()
  );

  -- Migrate title → role (for existing installs)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trainers' AND column_name='role') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trainers' AND column_name='title') THEN
      ALTER TABLE public.trainers RENAME COLUMN title TO role;
    ELSE
      ALTER TABLE public.trainers ADD COLUMN role text NOT NULL DEFAULT '';
    END IF;
  END IF;

  -- Migrate certs → certifications (for existing installs)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trainers' AND column_name='certifications') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trainers' AND column_name='certs') THEN
      ALTER TABLE public.trainers RENAME COLUMN certs TO certifications;
    ELSE
      ALTER TABLE public.trainers ADD COLUMN certifications text NOT NULL DEFAULT '';
    END IF;
  END IF;

  -- Migrate experience (text) → experience_years (integer) (for existing installs)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trainers' AND column_name='experience_years') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trainers' AND column_name='experience') THEN
      ALTER TABLE public.trainers ADD COLUMN experience_years integer NOT NULL DEFAULT 0;
      UPDATE public.trainers
        SET experience_years = COALESCE(NULLIF(regexp_replace(experience, '[^0-9]', '', 'g'), '')::integer, 0);
      ALTER TABLE public.trainers DROP COLUMN experience;
    ELSE
      ALTER TABLE public.trainers ADD COLUMN experience_years integer NOT NULL DEFAULT 0;
    END IF;
  END IF;

  -- Add bio column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trainers' AND column_name='bio') THEN
    ALTER TABLE public.trainers ADD COLUMN bio text NOT NULL DEFAULT '';
  END IF;
END $;
*/`;

// ── Verify credentials (POST with JSON body — no Supabase call) ──────
router.post("/verify", (req: Request, res: Response) => {
  const expectedUser = process.env["ADMIN_USERNAME"];
  const expectedPass = process.env["ADMIN_PASSWORD"];
  if (!expectedUser || !expectedPass) {
    res.status(500).json({ error: "Admin credentials not configured on server." });
    return;
  }
  const { username, password } = req.body as { username?: string; password?: string };
  if (username === expectedUser && password === expectedPass) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "Invalid admin credentials." });
  }
});

// Keep GET for direct server-side testing via curl
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
    res.status(500).json({ error: extractError(err) });
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
    res.status(500).json({ error: extractError(err) });
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
    res.status(500).json({ error: extractError(err) });
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
    res.status(500).json({ error: extractError(err) });
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
    res.status(500).json({ error: extractError(err) });
  }
});

// ── Labs ─────────────────────────────────────────────────────
router.get("/labs", adminAuth, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("labs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      const code = String((error as unknown as Record<string, unknown>)["code"] ?? "");
      if (MISSING_TABLE_CODES.has(code)) {
        res.status(503).json({ error: "The labs table does not exist yet. Run the setup SQL in Supabase Dashboard → SQL Editor, then click Refresh.", setupRequired: true, sql: SETUP_SQL });
        return;
      }
      throw error;
    }
    res.json({ labs: data ?? [] });
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

router.post("/labs", adminAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const body = req.body as Record<string, unknown>;
    const { data, error } = await supabase
      .from("labs")
      .insert([body])
      .select()
      .single();
    if (error) throw error;
    res.json({ lab: data });
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

router.put("/labs/:id", adminAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    const supabase = getSupabaseAdmin();
    const body = req.body as Record<string, unknown>;
    delete body.id;
    delete body.created_at;
    const { data, error } = await supabase
      .from("labs")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json({ lab: data });
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
  }
});

router.delete("/labs/:id", adminAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("labs").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: extractError(err) });
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
    const enrollments = (enrollmentsResult.data ?? []) as unknown as EnrollmentRow[];

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
    res.status(500).json({ error: extractError(err) });
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
    res.status(500).json({ error: extractError(err) });
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
    res.status(500).json({ error: extractError(err) });
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
    console.error("[DELETE /admin/users] error:", err);
    res.status(500).json({ error: extractError(err) });
  }
});

// ── Supabase Storage Upload — returns signed URL for direct browser upload ────
// POST /upload   body: { fileName, contentType }
// Response:      { signedUrl, path, publicUrl }
// The browser then PUTs the file bytes directly to signedUrl (no server proxy).
router.post("/upload", adminAuth, async (req, res) => {
  try {
    const { fileName, contentType } = (req.body ?? {}) as Record<string, string>;
    if (!fileName || !contentType) {
      res.status(400).json({ error: "fileName and contentType are required." });
      return;
    }

    const supabase = getSupabaseAdmin();
    const BUCKET = "course-assets";

    // Ensure bucket exists (idempotent)
    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024,
    });
    if (bucketErr && !bucketErr.message.toLowerCase().includes("already exists")) {
      console.error("[upload] bucket create error:", bucketErr.message);
    }

    const ext = (fileName.split(".").pop() ?? "bin").toLowerCase();
    const path = `${randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    console.log("[upload] signed URL created for:", path);
    res.json({ signedUrl: data.signedUrl, path, publicUrl });
  } catch (err) {
    console.error("[upload] FAILED:", extractError(err));
    res.status(500).json({ error: extractError(err) });
  }
});

// ── Supabase Storage Upload (team member photos only) ─────────────────────────
// ── Supabase Storage Upload — team member photos (signed URL, same pattern as /upload) ──
// POST /upload-team-photo   body: { fileName, contentType }
// Response:                 { signedUrl, path, publicUrl }
router.post("/upload-team-photo", adminAuth, async (req, res) => {
  try {
    const { fileName, contentType } = (req.body ?? {}) as Record<string, string>;
    if (!fileName || !contentType) {
      res.status(400).json({ error: "fileName and contentType are required." });
      return;
    }
    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "Only image files are allowed for team member photos." });
      return;
    }

    const supabase = getSupabaseAdmin();
    const BUCKET = "team-member-photos";

    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });
    if (bucketErr && !bucketErr.message.toLowerCase().includes("already exists")) {
      console.error("[upload-team-photo] bucket create error:", bucketErr.message);
    }

    const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    console.log("[upload-team-photo] signed URL created for:", path);
    res.json({ signedUrl: data.signedUrl, path, publicUrl });
  } catch (err) {
    console.error("[upload-team-photo] FAILED:", extractError(err));
    res.status(500).json({ error: extractError(err) });
  }
});

// ── Team Members ───────────────────────────────────────────────
router.get("/team-members", adminAuth, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("trainers")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[GET /admin/team-members] Supabase error:", error);
      const code = String((error as unknown as Record<string, unknown>)["code"] ?? "");
      if (MISSING_TABLE_CODES.has(code)) {
        res.status(503).json({ error: "The team members table does not exist yet. Please run the setup SQL in your Supabase Dashboard → SQL Editor, then click Refresh.", setupRequired: true, sql: SETUP_SQL });
        return;
      }
      throw error;
    }
    res.json({ members: data ?? [] });
  } catch (err) {
    console.error("[GET /admin/team-members] Unexpected error:", err);
    res.status(500).json({ error: extractError(err) });
  }
});

router.post("/team-members", adminAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const body = req.body as Record<string, unknown>;
    // Coerce experience_years to integer
    if (body["experience_years"] !== undefined) {
      body["experience_years"] = parseInt(String(body["experience_years"]), 10) || 0;
    }
    console.log("[UPLOAD TRACE] Backend Step F — POST /team-members, photo_url in body:", JSON.stringify(body["photo_url"]));
    console.log("[POST /admin/team-members] Inserting body:", JSON.stringify(body));
    const { data, error } = await supabase.from("trainers").insert([body]).select().single();
    if (error) {
      console.error("[POST /admin/team-members] Supabase error:", error);
      const code = String((error as unknown as Record<string, unknown>)["code"] ?? "");
      if (MISSING_TABLE_CODES.has(code)) {
        res.status(503).json({ error: "The team members table does not exist yet. Please run the setup SQL in your Supabase Dashboard → SQL Editor, then click Refresh.", setupRequired: true, sql: SETUP_SQL });
        return;
      }
      throw error;
    }
    res.json({ member: data });
  } catch (err) {
    console.error("[POST /admin/team-members] Unexpected error:", err);
    res.status(500).json({ error: extractError(err) });
  }
});

router.put("/team-members/:id", adminAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    const supabase = getSupabaseAdmin();
    const body = req.body as Record<string, unknown>;
    delete body.id;
    delete body.created_at;
    // Coerce experience_years to integer
    if (body["experience_years"] !== undefined) {
      body["experience_years"] = parseInt(String(body["experience_years"]), 10) || 0;
    }
    console.log("[PUT /admin/team-members] Updating id:", id, "body:", JSON.stringify(body));
    const { data, error } = await supabase.from("trainers").update(body).eq("id", id).select().single();
    if (error) {
      console.error("[PUT /admin/team-members] Supabase error:", error);
      throw error;
    }
    res.json({ member: data });
  } catch (err) {
    console.error("[PUT /admin/team-members] Unexpected error:", err);
    res.status(500).json({ error: extractError(err) });
  }
});

router.delete("/team-members/:id", adminAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("trainers").delete().eq("id", id);
    if (error) {
      console.error("[DELETE /admin/team-members] Supabase error:", error);
      throw error;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /admin/team-members] Unexpected error:", err);
    res.status(500).json({ error: extractError(err) });
  }
});

export default router;
