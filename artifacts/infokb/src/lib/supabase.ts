import { createClient } from "@supabase/supabase-js";

// .trim() strips any accidental whitespace / newlines from the secret value
let supabaseUrl = ((import.meta.env.SUPABASE_URL as string) ?? "").trim();
const supabaseKey = ((import.meta.env.SUPABASE_PUBLISHABLE_KEY as string) ?? "").trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.",
  );
}

// Normalize URL — add https:// if the user omitted the scheme
if (!supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
  supabaseUrl = `https://${supabaseUrl}`;
}

// Strip trailing slash
supabaseUrl = supabaseUrl.replace(/\/$/, "");

export const supabase = createClient(supabaseUrl, supabaseKey);
