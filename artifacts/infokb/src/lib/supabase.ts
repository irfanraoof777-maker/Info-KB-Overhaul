import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseUrl = ((import.meta.env.SUPABASE_URL as string) ?? "").trim();
const supabaseKey = ((import.meta.env.SUPABASE_PUBLISHABLE_KEY as string) ?? "").trim();

if (!supabaseUrl && !supabaseKey) {
  console.error(
    "[supabase] Missing env vars: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are both empty. " +
    "Make sure they are set in Vercel as Build-time environment variables.",
  );
} else if (!supabaseUrl) {
  console.error("[supabase] Missing env var: SUPABASE_URL is empty.");
} else if (!supabaseKey) {
  console.error("[supabase] Missing env var: SUPABASE_PUBLISHABLE_KEY is empty.");
}

// Normalize URL — add https:// if the user omitted the scheme
if (supabaseUrl && !supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
  supabaseUrl = `https://${supabaseUrl}`;
}

// Strip trailing slash
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.replace(/\/$/, "");
}

// Export null if credentials are missing so callers can detect and handle it
// without a module-level throw that bypasses try/catch blocks.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export const SUPABASE_URL_VALUE = supabaseUrl;
export const SUPABASE_KEY_VALUE = supabaseKey;
