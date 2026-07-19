import { useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: "https://infokb.com/reset-password" },
      );
      if (authError) {
        setError(authError.message);
      } else {
        setSent(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.toLowerCase().includes("failed to fetch")
          ? "Could not reach Supabase. Check that your SUPABASE_URL is correct."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background px-4 pt-20">
        <div className="w-full max-w-md bg-white dark:bg-card rounded-2xl shadow-lg p-8 border border-border text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Check your email for a password reset link
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            We sent a reset link to <strong>{email}</strong>. It may take a
            minute to arrive. Check your spam folder too.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background px-4 pt-20">
      <div className="w-full max-w-md bg-white dark:bg-card rounded-2xl shadow-lg p-8 border border-border">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            Forgot your password?
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send Reset Link"}
          </Button>
        </form>
      </div>
    </div>
  );
}
