BEGIN;
-- Completed classes remain visible as an archive; drafts and cancelled classes remain private.
DROP POLICY IF EXISTS "Published live courses are public" ON public.live_courses;
CREATE POLICY "Published and completed live courses are public" ON public.live_courses
  FOR SELECT USING (status IN ('published', 'completed'));
DROP POLICY IF EXISTS "Published live sessions are public" ON public.live_course_sessions;
CREATE POLICY "Published and completed live sessions are public" ON public.live_course_sessions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.live_courses c WHERE c.id = live_course_id AND c.status IN ('published', 'completed')));
COMMIT;
NOTIFY pgrst, 'reload schema';
