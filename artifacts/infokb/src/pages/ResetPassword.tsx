import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

type Stage = "loading" | "ready" | "error";

function parseHash(): {
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  error: string | null;
  errorDescription: string | null;
} {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
    error: params.get("error"),
    errorDescription: params.get("error_description"),
  };
}

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>("loading");
  const [initError, setInitError] = useState("This link is invalid or has already been used.");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      // ── 1. Check for error in hash (Supabase puts error info there too) ──
      const { accessToken, refreshToken, type, error, errorDescription } = parseHash();

      if (error) {
        setInitError(
          errorDescription
            ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
            : "This reset link is invalid or has already expired.",
        );
        setStage("error");
        return;
      }

      // ── 2. Hash-based implicit flow: access_token + type=recovery ──
      if (accessToken && type === "recovery") {
        const { error: sessionError } = await supabase!.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? "",
        });
        if (sessionError) {
          setInitError("Could not verify your reset link. It may have expired.");
          setStage("error");
        } else {
          // Clear the hash so the token isn't visible in the URL bar
          window.history.replaceState(null, "", window.location.pathname);
          setStage("ready");
        }
        return;
      }

      // ── 3. PKCE flow: ?code=... in query string ──
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: codeError } = await supabase!.auth.exchangeCodeForSession(code);
        if (codeError) {
          setInitError("This reset link is invalid or has already been used.");
          setStage("error");
        } else {
          window.history.replaceState(null, "", window.location.pathname);
          setStage("ready");
        }
        return;
      }

      // ── 4. Nothing in URL — link is missing or already consumed ──
      setInitError(
        "No reset token found. Please request a new password reset link.",
      );
      setStage("error");
    }

    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase!.auth.updateUser({ password });
      if (error) {
        setFormError(error.message);
      } else {
        await supabase!.auth.signOut();
        navigate("/login?message=Password+updated!+Please+login.");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──
  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background pt-20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <svg
            className="animate-spin h-6 w-6 text-primary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
          <span className="text-sm">Verifying reset link…</span>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (stage === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background px-4 pt-20">
        <div className="w-full max-w-md bg-white dark:bg-card rounded-2xl shadow-lg p-8 border border-border text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Link expired or invalid
          </h1>
          <p className="text-muted-foreground text-sm mb-6">{initError}</p>
          <Link
            href="/forgot-password"
            className="text-primary font-medium hover:underline text-sm"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  // ── Ready — show password form ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background px-4 pt-20">
      <div className="w-full max-w-md bg-white dark:bg-card rounded-2xl shadow-lg p-8 border border-border">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Set a new password
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {formError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
