import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const SETUP_SQL = `-- Run this once in your Supabase Dashboard → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS public.courses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  category          text NOT NULL DEFAULT '',
  price             numeric(10,2) NOT NULL DEFAULT 0,
  description       text NOT NULL DEFAULT '',
  long_description  text NOT NULL DEFAULT '',
  highlights        text[] NOT NULL DEFAULT '{}',
  curriculum        jsonb NOT NULL DEFAULT '[]',
  who_is_it_for     text[] NOT NULL DEFAULT '{}',
  instructor_name   text NOT NULL DEFAULT '',
  instructor_bio    text NOT NULL DEFAULT '',
  difficulty_level  text NOT NULL DEFAULT 'Beginner',
  duration          text NOT NULL DEFAULT '',
  trailer_url       text NOT NULL DEFAULT '',
  full_video_url    text NOT NULL DEFAULT '',
  thumbnail_url     text NOT NULL DEFAULT '',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
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
);`;
