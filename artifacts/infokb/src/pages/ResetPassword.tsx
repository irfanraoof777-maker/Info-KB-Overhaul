import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Stage = "loading" | "ready" | "error" | "success";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>("loading");
  const [initError, setInitError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase sends either ?code=... (PKCE) or #access_token=...&type=recovery (implicit)
    const code = new URLSearchParams(window.location.search).get("code");

    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            setInitError("This reset link is invalid or has already been used.");
            setStage("error");
          } else {
            setStage("ready");
          }
        });
      return;
    }

    // Implicit / hash-based flow — Supabase fires PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setStage("ready");
          subscription.unsubscribe();
        }
      },
    );

    // Timeout if no recovery event after 5 s
    const timer = setTimeout(() => {
      setInitError(
        "No valid reset session found. Please request a new password reset link.",
      );
      setStage("error");
      subscription.unsubscribe();
    }, 5000);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password !== confirm) {
      setFormError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFormError(error.message);
      } else {
        await supabase.auth.signOut();
        navigate("/login?message=Password+updated!+Please+login.");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background pt-20">
        <div className="animate-pulse text-muted-foreground">
          Verifying reset link…
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background px-4 pt-20">
        <div className="w-full max-w-md bg-white dark:bg-card rounded-2xl shadow-lg p-8 border border-border text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Reset link expired
          </h1>
          <p className="text-muted-foreground text-sm mb-6">{initError}</p>
          <button
            onClick={() => navigate("/forgot-password")}
            className="text-primary font-medium hover:underline text-sm"
          >
            Request a new reset link
          </button>
        </div>
      </div>
    );
  }

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
