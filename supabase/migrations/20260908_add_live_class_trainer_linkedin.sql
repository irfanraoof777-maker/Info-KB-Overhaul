BEGIN;
ALTER TABLE public.live_courses ADD COLUMN IF NOT EXISTS instructor_linkedin_url text;
COMMIT;
NOTIFY pgrst, 'reload schema';
