BEGIN;

REVOKE SELECT ON TABLE public.courses FROM PUBLIC, anon, authenticated;

DO $revoke_column_select$
DECLARE
  course_columns text;
BEGIN
  SELECT string_agg(format('%I', attributes.attname), ', ' ORDER BY attributes.attnum)
  INTO course_columns
  FROM pg_catalog.pg_attribute AS attributes
  WHERE attributes.attrelid = 'public.courses'::regclass
    AND attributes.attnum > 0
    AND NOT attributes.attisdropped;

  EXECUTE format(
    'REVOKE SELECT (%s) ON TABLE public.courses FROM PUBLIC, anon, authenticated',
    course_columns
  );
END;
$revoke_column_select$;

GRANT SELECT (
  id,
  name,
  category,
  price,
  description,
  difficulty,
  duration,
  trailer_url,
  thumbnail_url,
  created_at,
  difficulty_level,
  is_published,
  slug,
  updated_at,
  long_description,
  highlights,
  curriculum,
  who_is_it_for,
  instructor_name,
  instructor_bio
) ON TABLE public.courses TO anon, authenticated;

REVOKE SELECT (full_video_url) ON TABLE public.courses FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_enrolled_course_video(p_course_id uuid)
RETURNS TABLE (
  course_id uuid,
  video_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Course video unavailable';
  END IF;

  RETURN QUERY
  SELECT courses.id, courses.full_video_url
  FROM public.courses AS courses
  WHERE courses.id = p_course_id
    AND NULLIF(courses.full_video_url, '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.enrollments AS enrollments
      WHERE enrollments.user_id = caller_id
        AND enrollments.course_id = courses.id
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course video unavailable';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_enrolled_course_video(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_enrolled_course_video(uuid) TO authenticated;

DO $verification$
BEGIN
  IF has_column_privilege('anon', 'public.courses', 'full_video_url', 'SELECT') THEN
    RAISE EXCEPTION 'Verification failed: anon can select full_video_url';
  END IF;

  IF has_column_privilege('authenticated', 'public.courses', 'full_video_url', 'SELECT') THEN
    RAISE EXCEPTION 'Verification failed: authenticated can select full_video_url';
  END IF;

  IF has_function_privilege('anon', 'public.get_enrolled_course_video(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: anon can execute get_enrolled_course_video';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_enrolled_course_video(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: authenticated cannot execute get_enrolled_course_video';
  END IF;
END;
$verification$;

COMMIT;

NOTIFY pgrst, 'reload schema';
