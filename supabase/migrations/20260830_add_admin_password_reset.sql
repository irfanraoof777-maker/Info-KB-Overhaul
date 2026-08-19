-- Persistent Admin credentials and one-time password reset tokens.
-- Apply manually in the Supabase SQL Editor; this migration is not applied by the app.

CREATE TABLE IF NOT EXISTS public.admin_auth_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  password_hash text,
  reset_request_last_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.admin_auth_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_password_reset_tokens_active_idx
  ON public.admin_password_reset_tokens (expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.admin_auth_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_admin_password_reset(p_token_hash text, p_expires_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  accepted boolean := false;
BEGIN
  UPDATE public.admin_auth_settings
     SET reset_request_last_sent_at = now()
   WHERE id = true
     AND (reset_request_last_sent_at IS NULL OR reset_request_last_sent_at <= now() - interval '10 minutes')
  RETURNING true INTO accepted;

  IF accepted THEN
    UPDATE public.admin_password_reset_tokens SET used_at = now() WHERE used_at IS NULL;
    INSERT INTO public.admin_password_reset_tokens (token_hash, expires_at) VALUES (p_token_hash, p_expires_at);
  END IF;
  RETURN COALESCE(accepted, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_admin_password_reset(p_token_hash text, p_password_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reset_id uuid;
BEGIN
  UPDATE public.admin_password_reset_tokens
     SET used_at = now()
   WHERE token_hash = p_token_hash
     AND used_at IS NULL
     AND expires_at > now()
  RETURNING id INTO reset_id;

  IF reset_id IS NULL THEN RETURN false; END IF;

  UPDATE public.admin_auth_settings
     SET password_hash = p_password_hash, updated_at = now()
   WHERE id = true;
  RETURN true;
END;
$$;

REVOKE ALL ON TABLE public.admin_auth_settings, public.admin_password_reset_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_admin_password_reset(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_admin_password_reset(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_password_reset(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_admin_password_reset(text, text) TO service_role;