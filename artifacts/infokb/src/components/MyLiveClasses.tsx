import { useEffect, useState } from "react";
import { CalendarDays, Clock, Loader2, Users } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type Session = { id: string; session_title: string; starts_at: string; ends_at: string; timezone: string };
type Registration = { enrollment_status: string; payment_status: string; enrolled_at: string };
type Item = { id: string; slug: string; title: string; thumbnail_url?: string | null; instructor: string; duration?: string; timezone: string; status: string; registration?: Registration; live_course_sessions: Session[] };
type SessionState = "upcoming" | "live" | "completed";
const stateFor = (session: Session, now = Date.now()): SessionState => Date.parse(session.ends_at) <= now ? "completed" : Date.parse(session.starts_at) <= now ? "live" : "upcoming";
const format = (value: string, zone: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(value));

export default function MyLiveClasses() {
  const { session } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [notice, setNotice] = useState("");
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/live-classes/my", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setItems(data?.liveClasses ?? []));
  }, [session]);

  const join = async (trainingSession: Session) => {
    if (!supabase) return;
    setJoining(trainingSession.id);
    setNotice("");
    const target = window.open("about:blank", "_blank");
    if (!target) {
      setNotice("Allow pop-ups to join the live training in a new tab.");
      setJoining(null);
      return;
    }
    target.opener = null;
    try {
      const { data, error } = await supabase.rpc("get_live_session_join_info", { p_session_id: trainingSession.id }).single();
      const url = (data as { meeting_url?: string } | null)?.meeting_url;
      if (error || !url) throw new Error("Live training is unavailable.");
      const parsed = new URL(url);
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Live training is unavailable.");
      target.location.replace(parsed.toString());
    } catch {
      target.close();
      setNotice("This training is unavailable. Confirm that it has started and your booking remains active.");
    } finally {
      setJoining(null);
    }
  };

  const now = Date.now();
  return <section>
    <div className="mb-5 flex justify-between"><h2 className="text-xl font-bold">My Live Training</h2><Link href="/courses/live" className="text-sm font-semibold text-primary hover:underline">Browse Live Training</Link></div>
    {notice && <p className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">{notice}</p>}
    {items.length === 0 ? <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Your booked live training will appear here.</div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <div key={item.id} className="overflow-hidden rounded-2xl border bg-card"><div className="h-32 bg-primary/15">{item.thumbnail_url && <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />}</div><div className="p-4"><div className="mb-2 flex items-start justify-between gap-2"><h3 className="font-bold">{item.title}</h3><span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">{item.registration?.payment_status === "paid" ? "Booked" : item.registration?.payment_status ?? "Pending"}</span></div><p className="text-xs text-muted-foreground">Trainer: {item.instructor}</p>{item.live_course_sessions.map((trainingSession) => { const state = stateFor(trainingSession, now); return <div key={trainingSession.id} className="mt-3 border-t pt-3 text-xs"><p className="font-medium">{trainingSession.session_title || "Live training"}</p><p className="mt-1 flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{format(trainingSession.starts_at, trainingSession.timezone)}</p><p className="mt-1 flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{format(trainingSession.starts_at, trainingSession.timezone)} – {new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: trainingSession.timezone }).format(new Date(trainingSession.ends_at))}</p>{state === "live" ? <button disabled={joining === trainingSession.id} onClick={() => void join(trainingSession)} className="mt-3 w-full rounded-xl bg-[#23B33A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{joining === trainingSession.id ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Joining…</> : "Join Training"}</button> : <p className="mt-2 text-muted-foreground">{state === "completed" ? "Training ended" : `Starts ${format(trainingSession.starts_at, trainingSession.timezone)}`}</p>}</div>; })}<Link className="mt-4 block rounded-xl border py-2 text-center text-sm font-semibold text-primary" href={`/courses/live/${item.slug}`}>View Training</Link></div></div>)}</div>}
  </section>;
}