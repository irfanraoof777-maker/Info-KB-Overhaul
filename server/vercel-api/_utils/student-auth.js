import { getSupabaseAdmin } from "./supabase.js";
import { requireVerifiedStudent } from "./student-token.js";

export function requireStudent(req, res) {
  return requireVerifiedStudent(req, res, getSupabaseAdmin);
}
