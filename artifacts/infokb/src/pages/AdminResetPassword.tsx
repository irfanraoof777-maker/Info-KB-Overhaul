import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = "loading" | "ready" | "invalid" | "success";

export default function AdminResetPassword() {
  const [state, setState] = useState<State>("loading");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.search).get("token") ?? "";
    if (!resetToken) { setState("invalid"); return; }
    setToken(resetToken);
    fetch("/api/admin-password-reset/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken }) })
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => setState(response.ok && data.valid ? "ready" : "invalid"))
      .catch(() => setState("invalid"));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin-password-reset/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(data.error ?? "Unable to update the password."); if (response.status === 400) setState("invalid"); return; }
      setPassword(""); setConfirm(""); setState("success");
    } catch { setError("Could not reach the server. Please try again."); }
    finally { setSubmitting(false); }
  };

  return <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background px-4"><div className="w-full max-w-sm bg-white dark:bg-card rounded-2xl shadow-lg p-8 border border-border">
    {state === "loading" && <p className="text-center text-sm text-muted-foreground">Verifying reset link…</p>}
    {state === "invalid" && <div className="text-center"><h1 className="text-xl font-bold text-foreground">This password reset link is invalid or has expired.</h1><p className="text-sm text-muted-foreground mt-3">Return to Admin Login and request another reset link.</p><Link href="/admin" className="inline-block mt-6 text-sm text-primary font-medium hover:underline">Return to Admin Login</Link></div>}
    {state === "success" && <div className="text-center"><h1 className="text-xl font-bold text-foreground">Password updated successfully.</h1><Link href="/admin" className="inline-block mt-6 text-sm text-primary font-medium hover:underline">Return to Admin Login</Link></div>}
    {state === "ready" && <><div className="mb-6 text-center"><h1 className="text-2xl font-bold text-foreground">Reset Admin Password</h1><p className="text-sm text-muted-foreground mt-1">Choose a new, strong password.</p></div><form onSubmit={submit} className="space-y-4"><div className="space-y-1.5"><Label htmlFor="admin-new-password">New Password</Label><Input id="admin-new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required autoComplete="new-password" /></div><div className="space-y-1.5"><Label htmlFor="admin-confirm-password">Confirm New Password</Label><Input id="admin-confirm-password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={12} required autoComplete="new-password" /></div>{error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}<Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Updating…" : "Update Password"}</Button></form></>}
  </div></div>;
}