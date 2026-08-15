import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Runtime schema bootstrapping is intentionally retired. Database changes must
// be reviewed and applied from the versioned files under supabase/migrations.
export const SETUP_SQL = "-- Apply the reviewed, versioned files under supabase/migrations in order.\n-- Runtime setup SQL is no longer supported.";
