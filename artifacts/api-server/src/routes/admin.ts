import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

function getSupabaseAdmin() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SECRET_KEY"];
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  }
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
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
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
