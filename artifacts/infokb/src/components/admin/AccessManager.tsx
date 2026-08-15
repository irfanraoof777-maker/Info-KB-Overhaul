import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Student { id: string; email: string }
interface Course { id: string; name: string }
interface Lab { id: string; title: string }
interface Enrollment { id: string; student_id: string; course_id: string; status: string; starts_at: string; expires_at: string | null }
interface Rental { id: string; user_id: string; lab_id: string; state: string; effective_status: string; starts_at: string | null; expires_at: string | null }

const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`;
const toUtcIso = (value: string) => value ? new Date(value).toISOString() : null;
const toLocalInput = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export default function AccessManager({ auth }: { auth: { u: string; p: string } }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [labId, setLabId] = useState("");
  const [courseStart, setCourseStart] = useState("");
  const [courseExpiry, setCourseExpiry] = useState("");
  const [labStart, setLabStart] = useState("");
  const [labExpiry, setLabExpiry] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { startsAt: string; expiresAt: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const headers = useCallback(() => ({ Authorization: basic(auth.u, auth.p) }), [auth.p, auth.u]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const responses = await Promise.all([
        fetch("/api/admin/students", { cache: "no-store", headers: headers() }),
        fetch("/api/admin/courses", { cache: "no-store", headers: headers() }),
        fetch("/api/admin/labs", { cache: "no-store", headers: headers() }),
        fetch("/api/admin/course-enrollments", { cache: "no-store", headers: headers() }),
        fetch("/api/admin/lab-rentals", { cache: "no-store", headers: headers() }),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error("Apply the authoritative access migration before using access controls.");
      const [studentData, courseData, labData, enrollmentData, rentalData] = await Promise.all(responses.map((response) => response.json()));
      setStudents((studentData as { students?: Student[] }).students ?? []);
      setCourses((courseData as { courses?: Course[] }).courses ?? []);
      setLabs((labData as { labs?: Lab[] }).labs ?? []);
      setEnrollments((enrollmentData as { enrollments?: Enrollment[] }).enrollments ?? []);
      setRentals((rentalData as { rentals?: Rental[] }).rentals ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load access records."); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { void load(); }, [load]);

  const request = async (url: string, method: "POST" | "PATCH", body: Record<string, unknown>) => {
    setSaving(true); setError("");
    try {
      const response = await fetch(url, { method, headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Access update failed.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Access update failed."); }
    finally { setSaving(false); }
  };

  const email = (id: string) => students.find((item) => item.id === id)?.email ?? id;
  const course = (id: string) => courses.find((item) => item.id === id)?.name ?? id;
  const lab = (id: string) => labs.find((item) => item.id === id)?.title ?? id;
  const selectClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

  if (loading) return <div className="text-center py-16 text-muted-foreground animate-pulse">Loading access records…</div>;

  return <div className="space-y-10">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Student Access</h2><p className="text-sm text-muted-foreground">Manual grants until verified payments are implemented.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button></div>
    {error && <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

    <section className="bg-card rounded-2xl border border-border p-6 space-y-5">
      <div><h3 className="text-lg font-bold">Course Access</h3><p className="text-sm text-muted-foreground">Grant scheduled access or revoke an enrollment.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <select className={selectClass} value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Select student</option>{students.map((item) => <option key={item.id} value={item.id}>{item.email}</option>)}</select>
        <select className={selectClass} value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Select course</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <Input type="datetime-local" value={courseStart} onChange={(event) => setCourseStart(event.target.value)} aria-label="Course start" />
        <Input type="datetime-local" value={courseExpiry} onChange={(event) => setCourseExpiry(event.target.value)} aria-label="Course expiry" />
        <Button disabled={saving || !studentId || !courseId} onClick={() => void request("/api/admin/course-enrollments", "POST", { studentId, courseId, startsAt: courseStart ? toUtcIso(courseStart) : undefined, expiresAt: toUtcIso(courseExpiry) })}><Plus className="h-4 w-4 mr-2" />Grant</Button>
      </div>
      <div className="overflow-x-auto border border-border rounded-xl"><table className="w-full text-sm"><thead className="bg-muted/40"><tr><th className="text-left p-3">Student</th><th className="text-left p-3">Course</th><th className="text-left p-3">Status</th><th className="text-left p-3">Window</th><th className="p-3" /></tr></thead><tbody>{enrollments.map((item) => <tr key={item.id} className="border-t border-border"><td className="p-3">{email(item.student_id)}</td><td className="p-3">{course(item.course_id)}</td><td className="p-3">{item.status}</td><td className="p-3 text-xs text-muted-foreground">{new Date(item.starts_at).toLocaleString()} → {item.expires_at ? new Date(item.expires_at).toLocaleString() : "No expiry"}</td><td className="p-3 text-right">{item.status === "active" && <Button variant="outline" size="sm" disabled={saving} onClick={() => void request(`/api/admin/course-enrollments/${item.id}`, "PATCH", { action: "revoke" })}>Revoke</Button>}</td></tr>)}</tbody></table></div>
    </section>

    <section className="bg-card rounded-2xl border border-border p-6 space-y-5">
      <div><h3 className="text-lg font-bold">Student Lab Rentals</h3><p className="text-sm text-muted-foreground">Lab catalog management remains separate in Lab Rentals.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <select className={selectClass} value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Select student</option>{students.map((item) => <option key={item.id} value={item.id}>{item.email}</option>)}</select>
        <select className={selectClass} value={labId} onChange={(event) => setLabId(event.target.value)}><option value="">Select lab</option>{labs.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
        <Input type="datetime-local" value={labStart} onChange={(event) => setLabStart(event.target.value)} aria-label="Lab start" />
        <Input type="datetime-local" value={labExpiry} onChange={(event) => setLabExpiry(event.target.value)} aria-label="Lab expiry" />
        <Button disabled={saving || !studentId || !labId} onClick={() => void request("/api/admin/lab-rentals", "POST", { studentId, labId, startsAt: toUtcIso(labStart), expiresAt: toUtcIso(labExpiry) })}><Plus className="h-4 w-4 mr-2" />Assign</Button>
      </div>
      <div className="space-y-3">{rentals.map((item) => {
        const draft = drafts[item.id] ?? { startsAt: toLocalInput(item.starts_at), expiresAt: toLocalInput(item.expires_at) };
        return <div key={item.id} className="rounded-xl border border-border p-4"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><p className="font-semibold">{lab(item.lab_id)}</p><p className="text-xs text-muted-foreground">{email(item.user_id)}</p></div><span className="text-xs font-semibold uppercase tracking-wide">{item.effective_status.replace("_", " ")}</span><div className="flex flex-wrap gap-2">{item.state === "payment_pending" && <Button size="sm" disabled={saving} onClick={() => void request(`/api/admin/lab-rentals/${item.id}`, "PATCH", { action: "start_preparing" })}>Start Preparing</Button>}{item.state === "preparing" && <Button size="sm" disabled={saving || !draft.expiresAt} onClick={() => void request(`/api/admin/lab-rentals/${item.id}`, "PATCH", { action: "mark_ready", startsAt: draft.startsAt ? toUtcIso(draft.startsAt) : undefined, expiresAt: toUtcIso(draft.expiresAt) })}>Mark Ready</Button>}{item.state !== "cancelled" && <Button variant="outline" size="sm" disabled={saving} onClick={() => void request(`/api/admin/lab-rentals/${item.id}`, "PATCH", { action: "cancel" })}>Cancel</Button>}</div></div><div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mt-4"><Input type="datetime-local" value={draft.startsAt} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, startsAt: event.target.value } }))} /><Input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, expiresAt: event.target.value } }))} /><Button variant="outline" disabled={saving} onClick={() => void request(`/api/admin/lab-rentals/${item.id}`, "PATCH", { action: "update_schedule", startsAt: toUtcIso(draft.startsAt), expiresAt: toUtcIso(draft.expiresAt) })}>Save Dates</Button></div></div>;
      })}{rentals.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No student lab rentals yet.</p>}</div>
    </section>
  </div>;
}
