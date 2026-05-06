import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SupabaseUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

function makeBasicAuth(username: string, password: string) {
  return "Basic " + btoa(`${username}:${password}`);
}

export default function Admin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [users, setUsers] = useState<SupabaseUser[]>([]);
  const [fetchError, setFetchError] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async (u: string, p: string) => {
    setLoadingUsers(true);
    setFetchError("");
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: makeBasicAuth(u, p) },
      });
      if (res.status === 401) {
        setAuthed(false);
        setAuthError("Invalid credentials.");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: makeBasicAuth(username, password) },
    });
    if (res.status === 401) {
      setAuthError("Invalid admin credentials.");
      return;
    }
    if (!res.ok) {
      setAuthError("Server error. Check that the server is running.");
      return;
    }
    const data = await res.json();
    setUsers(data.users ?? []);
    setAuthed(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: makeBasicAuth(username, password) },
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchUsers(username, password);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (authed) fetchUsers(username, password);
  }, [authed, fetchUsers, username, password]);

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 pt-20">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 border border-border">
          <div className="mb-6 text-center">
            <span className="text-3xl">🔐</span>
            <h1 className="text-2xl font-bold text-foreground mt-2">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your admin credentials to continue
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-user">Username</Label>
              <Input
                id="admin-user"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-pass">Password</Label>
              <Input
                id="admin-pass"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {authError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}
            <Button type="submit" className="w-full">
              Enter Admin Panel
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pt-24 px-4 pb-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage Supabase users
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchUsers(username, password)}
              disabled={loadingUsers}
            >
              {loadingUsers ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAuthed(false)}
            >
              Log out
            </Button>
          </div>
        </div>

        {fetchError && (
          <div className="mb-4 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
            {fetchError}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow border border-border overflow-hidden">
          {loadingUsers ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">
              Loading users…
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No users found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70 hidden md:table-cell">
                    Created
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70 hidden lg:table-cell">
                    Last Sign-in
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-foreground/70">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {u.email}
                      <div className="text-xs text-muted-foreground font-normal">
                        {u.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === u.id}
                        onClick={() => handleDelete(u.id)}
                      >
                        {deletingId === u.id ? "Deleting…" : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          {users.length} user{users.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
