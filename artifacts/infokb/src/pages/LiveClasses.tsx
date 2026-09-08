import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Clock, GraduationCap, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { formatINR, liveState, mockLiveClasses, type LiveClass } from "@/data/mockLiveClasses";

const dateTime = (value: string, timeZone: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
const time = (value: string, timeZone: string) => new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone }).format(new Date(value));

export default function LiveClasses() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Live Training | InfoKB";
    if (!supabase) { setItems(mockLiveClasses); setLoading(false); return; }
    supabase.from("live_courses").select("*,live_course_sessions(id,session_title,starts_at,ends_at,timezone)").eq("status", "published").eq("registration_open", true).then(({ data }) => {
      setItems((data?.length ? data : mockLiveClasses) as LiveClass[]);
      setLoading(false);
    });
  }, []);

  const upcoming = useMemo(() => items.filter((item) => liveState(item) === "upcoming").sort((a, b) => Date.parse(a.live_course_sessions[0]?.starts_at ?? "0") - Date.parse(b.live_course_sessions[0]?.starts_at ?? "0")), [items]);

  return <main className="min-h-screen bg-background pt-20">
    <section className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-14">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/70">Instructor-led learning</p>
        <h1 className="mb-4 text-4xl font-extrabold text-white sm:text-5xl">Live Training</h1>
        <p className="mx-auto max-w-2xl text-lg font-semibold text-white sm:text-xl">Learn directly from InfoKB instructors in practical, scheduled training sessions.</p>
        <p className="mx-auto mt-3 max-w-xl text-base text-white/70">Book an upcoming session and join from your dashboard when the training begins.</p>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {loading ? <div className="flex flex-col items-center justify-center gap-3 py-28 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm">Loading live training…</p></div> : upcoming.length === 0 ? <div className="flex flex-col items-center justify-center gap-4 py-28 text-center"><GraduationCap className="h-14 w-14 text-muted-foreground/30" /><h2 className="text-xl font-semibold">No live training available yet</h2><p className="max-w-xs text-sm text-muted-foreground">New instructor-led sessions will appear here once they are scheduled.</p></div> : <>
        <div className="mb-6 flex items-center justify-between"><p className="text-sm text-muted-foreground">Showing all {upcoming.length} upcoming training{upcoming.length === 1 ? "" : " sessions"}</p></div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((item) => {
            const session = item.live_course_sessions[0];
            return <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative h-40 bg-gradient-to-br from-[#0a192f] to-[#1a3a5c]">
                {item.thumbnail_url && <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover" />}
                <span className="absolute left-3 top-3 rounded-full bg-[#23B33A] px-2.5 py-1 text-xs font-bold text-white">Upcoming</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Live Training</p>
                <h2 className="text-lg font-bold text-foreground">{item.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.short_description}</p>
                <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" />{item.instructor}</p>
                  <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{session ? dateTime(session.starts_at, session.timezone) : "Schedule coming soon"}</p>
                  {session && <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{time(session.starts_at, session.timezone)} – {time(session.ends_at, session.timezone)}</p>}
                </div>
                <div className="mt-5 flex items-center justify-between"><span className="text-xl font-extrabold text-foreground">{formatINR(Number(item.price_inr))}</span><span className="text-sm text-muted-foreground">{item.duration || "Live session"}</span></div>
                <Link href={`/courses/live/${item.slug}`} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#23B33A] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1ca033]">View Training <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </article>;
          })}
        </div>
      </>}
    </section>
  </main>;
}