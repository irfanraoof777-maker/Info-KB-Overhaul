import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.SUPABASE_URL as string;
const supabaseKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
