BEGIN;

-- Keep the existing unlimited live-training schema and payment finalization flow.
-- Only the protected join URL gains a server-enforced session time window.
CREATE OR REPLACE FUNCTION public.get_live_session_join_info(p_session_id uuid)
RETURNS TABLE(session_id uuid, meeting_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Live session unavailable'; END IF;

  RETURN QUERY
  SELECT s.id, s.meeting_url
  FROM public.live_course_sessions s
  JOIN public.live_courses c ON c.id = s.live_course_id
  WHERE s.id = p_session_id
    AND c.status = 'published'
    AND NULLIF(s.meeting_url, '') IS NOT NULL
    AND s.starts_at <= now()
    AND s.ends_at > now()
    AND EXISTS (
      SELECT 1
      FROM public.live_class_registrations r
      WHERE r.user_id = auth.uid()
        AND r.live_course_id = s.live_course_id
        AND r.payment_status = 'paid'
        AND r.enrollment_status = 'active'
    );

  IF NOT FOUND THEN RAISE EXCEPTION 'Live session unavailable'; END IF;
END; $fn$;

REVOKE ALL ON FUNCTION public.get_live_session_join_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_session_join_info(uuid) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';