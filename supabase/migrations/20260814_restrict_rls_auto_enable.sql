BEGIN;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

DO $verification$
DECLARE
  function_oid oid := to_regprocedure('public.rls_auto_enable()')::oid;
  function_owner oid;
  trigger_enabled "char";
BEGIN
  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'Verification failed: public.rls_auto_enable() does not exist';
  END IF;

  SELECT proowner
  INTO function_owner
  FROM pg_proc
  WHERE oid = function_oid;

  IF NOT has_function_privilege(function_owner, function_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: the owner of public.rls_auto_enable() cannot execute it';
  END IF;

  SELECT evtenabled
  INTO trigger_enabled
  FROM pg_event_trigger
  WHERE evtname = 'ensure_rls'
    AND evtfoid = function_oid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification failed: event trigger ensure_rls does not exist';
  END IF;

  IF trigger_enabled NOT IN ('O', 'R', 'A') THEN
    RAISE EXCEPTION 'Verification failed: event trigger ensure_rls is not enabled';
  END IF;

  IF has_function_privilege('anon', function_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: anon can still execute public.rls_auto_enable()';
  END IF;

  IF has_function_privilege('authenticated', function_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Verification failed: authenticated can still execute public.rls_auto_enable()';
  END IF;
END;
$verification$;

COMMIT;
