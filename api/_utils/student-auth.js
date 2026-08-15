import { getSupabaseAdmin } from "./supabase.js";

export async function requireStudent(req, res) {
  const authorization = req.headers.authorization ?? "";
  if (!authorization.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return { supabase, user };
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
}
