import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Users,
  ShoppingCart,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  difficulty_level: string;
  duration: string;
  trailer_url: string;
  thumbnail_url: string;
  created_at: string;
}

interface Student {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  enrollments: Array<{
    course: { id: string; name: string; category: string; price: number } | null;
    enrolled_at: string;
  }>;
}

interface Order {
  id: string;
  user_email: string;
  course_name: string;
  amount: number;
  status: string;
  payment_id: string;
  created_at: string;
}

type Tab = "courses" | "students" | "orders";

const BLANK_COURSE: Omit<Course, "id" | "created_at"> = {
  name: "",
  category: "",
  price: 0,
  description: "",
  difficulty_level: "Beginner",
  duration: "",
  trailer_url: "",
  thumbnail_url: "",
};

const DIFFICULTY_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const CATEGORIES = ["Cloud", "DevOps", "Cybersecurity", "AI/ML", "Networking", "Database", "Programming", "Other"];

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeBasicAuth(u: string, p: string) {
  return "Basic " + btoa(`${u}:${p}`);
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function statusColor(status: string) {
  if (status === "completed") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (status === "pending") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-muted text-muted-foreground";
}

// ── DB Setup Banner ──────────────────────────────────────────────────────────

function DbSetupBanner({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mb-6 rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-700 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">
            Database tables not found
          </p>
          <p className="text-yellow-700 dark:text-yellow-400 text-sm mt-0.5">
            Run the SQL below in your Supabase Dashboard → SQL Editor → New Query, then refresh.
          </p>
          <button
            onClick={() => setOpen(!open)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-yellow-700 dark:text-yellow-400 hover:underline"
          >
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {open ? "Hide SQL" : "Show SQL"}
          </button>
          {open && (
            <div className="mt-2 relative">
              <pre className="text-xs bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-3 overflow-auto max-h-56 font-mono text-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700">
                {sql}
              </pre>
              <button
                onClick={copy}
                className="absolute top-2 right-2 flex items-center gap-1 text-xs bg-white dark:bg-card border border-yellow-300 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded px-2 py-1 hover:bg-yellow-50"
              >
                {copied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Course Form Modal ────────────────────────────────────────────────────────

interface CourseModalProps {
  open: boolean;
  onClose: () => void;
  initial: Partial<Course> | null;
  auth: { u: string; p: string };
  onSaved: () => void;
}

function CourseModal({ open, onClose, initial, auth, onSaved }: CourseModalProps) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({ ...BLANK_COURSE, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({ ...BLANK_COURSE, ...initial });
    setError("");
  }, [initial, open]);

  const set = (k: string, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Course name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const url = isEdit ? `/api/admin/courses/${initial!.id}` : "/api/admin/courses";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: makeBasicAuth(auth.u, auth.p),
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Save failed");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Course" : "Add New Course"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Course Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. AWS Solutions Architect"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Difficulty Level</Label>
              <Select value={form.difficulty_level} onValueChange={(v) => set("difficulty_level", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_LEVELS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Input
                value={form.duration}
                onChange={(e) => set("duration", e.target.value)}
                placeholder="e.g. 40 hours"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Description</Label>
              <textarea
                className="w-full min-h-[90px] rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Short course description…"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Trailer Video URL</Label>
              <Input
                value={form.trailer_url}
                onChange={(e) => set("trailer_url", e.target.value)}
                placeholder="https://youtube.com/..."
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Thumbnail Image URL</Label>
              <Input
                value={form.thumbnail_url}
                onChange={(e) => set("thumbnail_url", e.target.value)}
                placeholder="https://..."
              />
              {form.thumbnail_url && (
                <img
                  src={form.thumbnail_url}
                  alt="Preview"
                  className="mt-1 h-24 w-40 rounded-lg object-cover border border-border"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Courses Tab ──────────────────────────────────────────────────────────────

function CoursesTab({ auth }: { auth: { u: string; p: string } }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupSql, setSetupSql] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSetupSql("");
    try {
      const res = await fetch("/api/admin/courses", {
        headers: { Authorization: makeBasicAuth(auth.u, auth.p) },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const msg = (d as { error?: string }).error ?? "Failed to load courses.";
        if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")) {
          const sr = await fetch("/api/admin/db-status", {
            headers: { Authorization: makeBasicAuth(auth.u, auth.p) },
          });
          const sd = await sr.json() as { sql?: string };
          if (sd.sql) setSetupSql(sd.sql);
        } else {
          setError(msg);
        }
        return;
      }
      const data = await res.json() as { courses: Course[] };
      setCourses(data.courses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this course permanently?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/courses/${id}`, {
        method: "DELETE",
        headers: { Authorization: makeBasicAuth(auth.u, auth.p) },
      });
      if (!res.ok) throw new Error("Delete failed");
      await load();
    } catch {
      alert("Delete failed. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Courses</h2>
          <p className="text-sm text-muted-foreground">{courses.length} course{courses.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Course
          </Button>
        </div>
      </div>

      {setupSql && <DbSetupBanner sql={setupSql} />}

      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground animate-pulse">Loading courses…</div>
      ) : courses.length === 0 && !setupSql ? (
        <div className="text-center py-16">
          <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No courses yet.</p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => { setEditing(null); setModalOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add your first course
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-white dark:bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70">Course</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70 hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70 hidden sm:table-cell">Difficulty</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70 hidden lg:table-cell">Duration</th>
                  <th className="text-right px-4 py-3 font-medium text-foreground/70">Price</th>
                  <th className="text-right px-4 py-3 font-medium text-foreground/70">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {courses.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.thumbnail_url ? (
                          <img
                            src={c.thumbnail_url}
                            alt=""
                            className="h-10 w-14 rounded-md object-cover border border-border shrink-0"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        ) : (
                          <div className="h-10 w-14 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground leading-tight">{c.name}</p>
                          {c.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">
                              {c.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.category ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {c.category}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.difficulty_level || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{c.duration || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {c.price > 0 ? `₹${Number(c.price).toLocaleString("en-IN")}` : "Free"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => { setEditing(c); setModalOpen(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deletingId === c.id}
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CourseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        auth={auth}
        onSaved={load}
      />
    </div>
  );
}

// ── Students Tab ─────────────────────────────────────────────────────────────

function StudentsTab({ auth }: { auth: { u: string; p: string } }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupSql, setSetupSql] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSetupSql("");
    try {
      const res = await fetch("/api/admin/students", {
        headers: { Authorization: makeBasicAuth(auth.u, auth.p) },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const msg = (d as { error?: string }).error ?? "Failed to load.";
        if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")) {
          const sr = await fetch("/api/admin/db-status", {
            headers: { Authorization: makeBasicAuth(auth.u, auth.p) },
          });
          const sd = await sr.json() as { sql?: string };
          if (sd.sql) setSetupSql(sd.sql);
        } else {
          setError(msg);
        }
        return;
      }
      const data = await res.json() as { students: Student[] };
      setStudents(data.students ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Students</h2>
          <p className="text-sm text-muted-foreground">{students.length} registered student{students.length !== 1 ? "s" : ""}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {setupSql && <DbSetupBanner sql={setupSql} />}
      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground animate-pulse">Loading students…</div>
      ) : students.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No registered students yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-white dark:bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-foreground/70">Student</th>
                <th className="text-left px-4 py-3 font-medium text-foreground/70 hidden md:table-cell">Joined</th>
                <th className="text-left px-4 py-3 font-medium text-foreground/70 hidden lg:table-cell">Last Login</th>
                <th className="text-right px-4 py-3 font-medium text-foreground/70">Courses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((s) => (
                <>
                  <tr
                    key={s.id}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {(s.email[0] ?? "?").toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-foreground">{s.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {fmt(s.created_at)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {s.last_sign_in_at ? fmt(s.last_sign_in_at) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {s.enrollments.length} enrolled
                      </span>
                    </td>
                  </tr>
                  {expandedId === s.id && s.enrollments.length > 0 && (
                    <tr key={`${s.id}-exp`} className="bg-muted/30">
                      <td colSpan={4} className="px-4 py-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Enrolled Courses
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {s.enrollments.map((e, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 bg-white dark:bg-card rounded-lg px-3 py-1.5 border border-border text-xs"
                            >
                              <BookOpen className="h-3 w-3 text-primary shrink-0" />
                              <span className="font-medium">{e.course?.name ?? "Unknown"}</span>
                              {e.course?.price != null && (
                                <span className="text-muted-foreground">
                                  ₹{Number(e.course.price).toLocaleString("en-IN")}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab({ auth }: { auth: { u: string; p: string } }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupSql, setSetupSql] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSetupSql("");
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: makeBasicAuth(auth.u, auth.p) },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const msg = (d as { error?: string }).error ?? "Failed to load.";
        if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")) {
          const sr = await fetch("/api/admin/db-status", {
            headers: { Authorization: makeBasicAuth(auth.u, auth.p) },
          });
          const sd = await sr.json() as { sql?: string };
          if (sd.sql) setSetupSql(sd.sql);
        } else {
          setError(msg);
        }
        return;
      }
      const data = await res.json() as { orders: Order[] };
      setOrders(data.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  const total = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + Number(o.amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Orders</h2>
          <p className="text-sm text-muted-foreground">
            {orders.length} order{orders.length !== 1 ? "s" : ""}
            {total > 0 && ` · ₹${total.toLocaleString("en-IN")} total`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {setupSql && <DbSetupBanner sql={setupSql} />}
      {error && (
        <div className="mb-4 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground animate-pulse">Loading orders…</div>
      ) : orders.length === 0 && !setupSql ? (
        <div className="text-center py-16">
          <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No orders yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-white dark:bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70">Course</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70 hidden md:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground/70 hidden lg:table-cell">Payment ID</th>
                  <th className="text-center px-4 py-3 font-medium text-foreground/70 hidden sm:table-cell">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-foreground/70">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{o.user_email || "—"}</td>
                    <td className="px-4 py-3 text-foreground">{o.course_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{fmt(o.created_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden lg:table-cell">
                      {o.payment_id || "—"}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      ₹{Number(o.amount).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
              {total > 0 && (
                <tfoot className="bg-muted/30 border-t-2 border-border">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-foreground/70">
                      Total Revenue
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">
                      ₹{total.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Component ─────────────────────────────────────────────────────

export default function Admin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("courses");
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: makeBasicAuth(username, password) },
      });
      if (res.status === 401) {
        setAuthError("Invalid admin credentials.");
        return;
      }
      if (!res.ok) {
        setAuthError("Server error. Make sure the API server is running.");
        return;
      }
      setAuthed(true);
    } catch {
      setAuthError("Could not reach the server. Check that the API server is running.");
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Login Screen ────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background px-4 pt-20">
        <div className="w-full max-w-sm bg-white dark:bg-card rounded-2xl shadow-lg p-8 border border-border">
          <div className="mb-6 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
              <span className="text-2xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-user">Username</Label>
              <Input
                id="admin-user"
                ref={usernameRef}
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
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
                autoComplete="current-password"
              />
            </div>
            {authError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={authLoading}>
              {authLoading ? "Verifying…" : "Enter Admin Panel"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── Admin Panel Layout ──────────────────────────────────────
  const auth = { u: username, p: password };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
    { id: "students", label: "Students", icon: <Users className="h-4 w-4" /> },
    { id: "orders", label: "Orders", icon: <ShoppingCart className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-muted/20 dark:bg-background pt-16">
      {/* Top bar */}
      <div className="sticky top-16 z-40 bg-white dark:bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id
                      ? "bg-primary text-white"
                      : "text-foreground/60 hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setAuthed(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {tab === "courses" && <CoursesTab auth={auth} />}
        {tab === "students" && <StudentsTab auth={auth} />}
        {tab === "orders" && <OrdersTab auth={auth} />}
      </div>
    </div>
  );
}
