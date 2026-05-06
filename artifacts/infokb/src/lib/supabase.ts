import { createClient } from "@supabase/supabase-js";

let supabaseUrl = (import.meta.env.SUPABASE_URL as string) ?? "";
const supabaseKey = (import.meta.env.SUPABASE_PUBLISHABLE_KEY as string) ?? "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.",
  );
}

// Normalize URL — add https:// if the user omitted the scheme
if (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
  supabaseUrl = `https://${supabaseUrl}`;
}

// Strip trailing slash so Supabase SDK doesn't get confused
supabaseUrl = supabaseUrl.replace(/\/$/, "");

export const supabase = createClient(supabaseUrl, supabaseKey);
