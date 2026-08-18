import { useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Signup() {
  const [, navigate] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalizedFullName = fullName.trim();
    if (!normalizedFullName) {
      setError("Full name is required.");
      return;
    }
    if (normalizedFullName.length > 120) {
      setError("Full name must be 120 characters or fewer.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase!.auth.signUp({
        email,
        password,
        options: { data: { full_name: normalizedFullName } },
      });
      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        navigate("/dashboard");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.toLowerCase().includes("failed to fetch")
          ? "Could not reach Supabase. Check that your SUPABASE_URL is correct and the project is active."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 pt-20">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-lg p-8 border border-border text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account, then{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              sign in
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 pt-20">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-lg p-8 border border-border">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground">Create an account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join InfoKB and start learning today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full Name</Label>
            <Input id="full-name" type="text" placeholder="Mohammed Irfan Raoof" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" maxLength={120} />
          </div>
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

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
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

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Sign Up"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
