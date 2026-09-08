import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Clock, GraduationCap, Loader2 } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatINR, liveState, mockLiveClasses, type LiveClass } from "@/data/mockLiveClasses";

const dateTime = (value: string, timeZone: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
const time = (value: string, timeZone: string) => new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone }).format(new Date(value));

export default function LiveClassDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user, session } = useAuth();
  const [, navigate] = useLocation();
  const [item, setItem] = useState<LiveClass | null>(null);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!supabase) { setItem(mockLiveClasses.find((entry) => entry.slug === slug && liveState(entry) === "upcoming") ?? null); setLoading(false); return; }
      const { data } = await supabase.from("live_courses").select("*,live_course_sessions(id,session_title,starts_at,ends_at,timezone)").eq("slug", slug).maybeSingle();
      const selected = ((data as LiveClass | null) ?? mockLiveClasses.find((entry) => entry.slug === slug) ?? null);
      setItem(selected && liveState(selected) === "upcoming" ? selected : null);
      if (data && user) {
        const response = await fetch("/api/live-classes/my", { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
        const result = response.ok ? await response.json() : { liveClasses: [] };
        setRegistered((result.liveClasses ?? []).some((liveClass: { id: string }) => liveClass.id === data.id));
      }
      setLoading(false);
    };
    void load();
  }, [slug, user, session]);

  const enroll = async () => {
    if (!item || item.isDemo) return;
    if (!user || !session) { navigate(`/login?redirect=${encodeURIComponent(`/courses/live/${slug}`)}`); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/live-class-payments?paymentPath=razorpay/order", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ liveCourseId: item.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await new Promise<void>((resolve, reject) => { const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Unable to load payment checkout.")); document.head.appendChild(script); });
      const Razorpay = (window as any).Razorpay;
      new Razorpay({ key: body.order.keyId, amount: body.order.amount, currency: "INR", name: body.order.name, order_id: body.order.razorpayOrderId, handler: async (payment: any) => {
        const verified = await fetch("/api/live-class-payments?paymentPath=razorpay/verify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(payment) });
        if (!verified.ok) setError((await verified.json()).error ?? "Payment verification is pending."); else setRegistered(true);
      } }).open();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to start registration."); } finally { setBusy(false); }
  };

  if (loading) return <div className="grid min-h-screen place-items-center pt-20"><Loader2 className="animate-spin text-primary" /></div>;
  if (!item) return <div className="min-h-screen bg-background pt-28 text-center text-muted-foreground">Upcoming training not found.</div>;
  const firstSession = item.live_course_sessions[0];

  return <main className="min-h-screen bg-background pt-20">
    <section className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link href="/courses/live" className="mb-6 inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Live Training</Link>
        <div className="mb-4"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">Upcoming Live Training</span></div>
        <h1 className="mb-4 max-w-3xl text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">{item.title}</h1>
        <div className="flex flex-wrap gap-5 text-sm text-white/80"><span className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-[#23B33A]" />{item.instructor}</span>{firstSession && <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#23B33A]" />{dateTime(firstSession.starts_at, firstSession.timezone)}</span>}<span className="flex items-center gap-2"><Clock className="h-4 w-4 text-[#23B33A]" />{item.duration || "Live session"}</span></div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        <section className="rounded-2xl border border-border bg-card p-8"><h2 className="mb-4 text-xl font-bold text-foreground">About This Training</h2><p className="whitespace-pre-line leading-relaxed text-muted-foreground">{item.description || item.short_description}</p></section>
        <section className="rounded-2xl border border-border bg-card p-8"><h2 className="mb-5 text-xl font-bold text-foreground">Training Details</h2><dl className="grid grid-cols-1 gap-5 sm:grid-cols-2"><div><dt className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Trainer</dt><dd className="flex items-center gap-1.5 font-medium text-foreground"><GraduationCap className="h-4 w-4 text-primary" />{item.instructor}</dd></div><div><dt className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Duration</dt><dd className="flex items-center gap-1.5 font-medium text-foreground"><Clock className="h-4 w-4 text-primary" />{item.duration || "Live session"}</dd></div><div><dt className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Price</dt><dd className="text-lg font-bold text-foreground">{formatINR(Number(item.price_inr))}</dd></div><div><dt className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</dt><dd className="font-medium text-[#23B33A]">Registration open</dd></div></dl></section>
        <section className="rounded-2xl border border-border bg-card p-8"><h2 className="mb-5 text-xl font-bold text-foreground">Training Schedule</h2><div className="space-y-4">{item.live_course_sessions.map((trainingSession) => <div key={trainingSession.id} className="rounded-xl border border-border bg-muted/30 p-4"><p className="font-semibold text-foreground">{trainingSession.session_title || "Live training session"}</p><div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{dateTime(trainingSession.starts_at, trainingSession.timezone)}</p><p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{time(trainingSession.starts_at, trainingSession.timezone)} – {time(trainingSession.ends_at, trainingSession.timezone)}</p></div></div>)}</div></section>
      </div>
      <aside><div className="sticky top-24 overflow-hidden rounded-2xl border border-border bg-card shadow-lg"><div className="border-b border-border"><div className="flex aspect-video items-center justify-center bg-gradient-to-br from-[#0a192f] to-[#1a3a5c]">{item.thumbnail_url ? <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover" /> : <GraduationCap className="h-12 w-12 text-white/20" />}</div></div><div className="space-y-4 p-6"><span className="text-2xl font-extrabold text-foreground">{formatINR(Number(item.price_inr))}</span>{registered ? <Link href="/dashboard" className="flex w-full items-center justify-center rounded-xl bg-[#23B33A] px-4 py-3.5 text-base font-bold text-white transition-colors hover:bg-[#1ca033]">View My Training</Link> : <button disabled={busy || item.isDemo || !item.registration_open} onClick={() => void enroll()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#23B33A] px-4 py-3.5 text-base font-bold text-white transition-colors hover:bg-[#1ca033] disabled:cursor-not-allowed disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Preparing checkout…" : item.isDemo ? "Demo Training" : "Book Live Training"}</button>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="space-y-3 border-t border-border pt-4 text-sm text-muted-foreground"><p className="flex items-center gap-2"><GraduationCap className="h-4 w-4 shrink-0" />Trainer: {item.instructor}</p>{firstSession && <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" />{dateTime(firstSession.starts_at, firstSession.timezone)}</p>}<p className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" />{item.duration || "Live session"}</p></div></div></div></aside>
    </div></section>
  </main>;
}