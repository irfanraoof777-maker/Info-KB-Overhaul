import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { BarChart2, BookOpen, Clock, Loader2, Play, RefreshCw, Server } from "lucide-react";

interface DashboardCourse {
  enrollmentId: string;
  courseId: string;
  enrolledAt: string | null;
  startsAt: string;
  expiresAt: string | null;
  canAccess: boolean;
  course: {
    id: string;
    name: string;
    category: string | null;
    duration: string | null;
    difficulty_level: string | null;
    thumbnail_url: string | null;
    trailer_url: string | null;
    description: string | null;
  };
}

type LabStatus = "payment_pending" | "preparing" | "ready" | "expired" | "cancelled";

interface DashboardLab {
  rentalId: string;
  labId: string;
  storedState: string;
  status: LabStatus;
  startsAt: string | null;
  expiresAt: string | null;
  canAccess: boolean;
  lab: {
    id: string;
    title: string;
    description: string;
    image_url: string;
    category: string;
    duration: string;
  };
}

interface DashboardAccess {
  courses: DashboardCourse[];
  labs: DashboardLab[];
  counts: { courses: number; labs: number };
}

const EMPTY_ACCESS: DashboardAccess = { courses: [], labs: [], counts: { courses: 0, labs: 0 } };
const STATUS_LABELS: Record<LabStatus, string> = {
  payment_pending: "Payment Pending",
  preparing: "Preparing",
  ready: "Ready",
  expired: "Expired",
  cancelled: "Cancelled",
};
const STATUS_STYLES: Record<LabStatus, string> = {
  payment_pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  preparing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ready: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  expired: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  let embedUrl = url;
  if (isYoutube) {
    try {
      const parsed = new URL(url);
      const id = parsed.searchParams.get("v") ?? parsed.pathname.replace("/", "");
      embedUrl = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    } catch { /* use original URL */ }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm font-medium">× Close</button>
        <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
          {isYoutube ? (
            <iframe src={embedUrl} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
          ) : (
            <video src={url} controls autoPlay className="w-full h-full" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [access, setAccess] = useState<DashboardAccess>(EMPTY_ACCESS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [videoLoadingId, setVideoLoadingId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ title: string; url: string } | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, navigate, user]);

  const loadAccess = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard-access", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error("Unable to load your access records.");
      setAccess(await response.json() as DashboardAccess);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your access records.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void loadAccess(); }, [loadAccess]);

  const openCourse = async (item: DashboardCourse) => {
    if (!supabase || !item.canAccess) return;
    setVideoLoadingId(item.courseId);
    setNotice("");
    const { data, error: videoError } = await supabase
      .rpc("get_enrolled_course_video", { p_course_id: item.courseId })
      .single();
    setVideoLoadingId(null);
    const result = data as { video_url?: string } | null;
    if (videoError || !result?.video_url) {
      setNotice("This course video is currently unavailable.");
      return;
    }
    setPlaying({ title: item.course.name, url: result.video_url });
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center pt-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      {playing && <VideoModal url={playing.url} title={playing.title} onClose={() => setPlaying(null)} />}
      <div className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div><h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">My Dashboard</h1><p className="text-white/70 text-sm">{user.email}</p></div>
          <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white" onClick={async () => { await signOut(); navigate("/"); }}>Logout</Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-2xl border border-border p-5"><p className="text-muted-foreground text-sm mb-1">My Courses</p><p className="text-3xl font-extrabold">{access.counts.courses}</p></div>
          <div className="bg-card rounded-2xl border border-border p-5"><p className="text-muted-foreground text-sm mb-1">My Labs</p><p className="text-3xl font-extrabold">{access.counts.labs}</p></div>
          <div className="bg-card rounded-2xl border border-border p-5"><p className="text-muted-foreground text-sm mb-1">Account</p><p className="text-sm font-semibold truncate">{user.email}</p></div>
        </div>

        {error && (
          <div className="bg-card rounded-2xl border border-destructive/40 p-8 text-center">
            <p className="text-destructive text-sm mb-4">{error}</p>
            <Button onClick={() => void loadAccess()}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
          </div>
        )}
        {notice && <p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">{notice}</p>}
        {loading && <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-primary" />Loading your access…</div>}

        {!loading && !error && (
          <>
            <section>
              <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-bold">My Courses</h2><Link href="/courses" className="text-sm font-semibold text-primary hover:underline">Browse Courses</Link></div>
              {access.courses.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-10 text-center"><BookOpen className="h-11 w-11 text-muted-foreground/30 mx-auto mb-3" /><h3 className="font-semibold mb-2">No course access yet</h3><p className="text-sm text-muted-foreground mb-5">Courses granted to your account will appear here.</p><Link href="/courses" className="inline-block px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold">Browse Courses</Link></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {access.courses.map((item) => <div key={item.enrollmentId} className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col"><div className="h-40 bg-gradient-to-br from-[#003d6b] to-[#005B99]">{item.course.thumbnail_url && <img src={item.course.thumbnail_url} alt={item.course.name} className="w-full h-full object-cover" />}</div><div className="p-4 flex flex-col flex-1">{item.course.category && <span className="text-xs font-bold uppercase tracking-widest text-primary mb-1">{item.course.category}</span>}<h3 className="font-bold text-sm mb-2">{item.course.name}</h3><p className="text-xs text-muted-foreground line-clamp-2 flex-1">{item.course.description}</p><div className="flex gap-3 text-xs text-muted-foreground my-4">{item.course.duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{item.course.duration}</span>}{item.course.difficulty_level && <span className="flex items-center gap-1"><BarChart2 className="h-3 w-3" />{item.course.difficulty_level}</span>}</div><button onClick={() => void openCourse(item)} disabled={!item.canAccess || videoLoadingId === item.courseId} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#23B33A] hover:bg-[#1ca033] text-white disabled:opacity-60 flex items-center justify-center gap-2">{videoLoadingId === item.courseId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}Access Course</button></div></div>)}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-bold">My Labs</h2><Link href="/labs" className="text-sm font-semibold text-primary hover:underline">Browse Labs</Link></div>
              {access.labs.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-10 text-center"><Server className="h-11 w-11 text-muted-foreground/30 mx-auto mb-3" /><h3 className="font-semibold mb-2">No lab rentals yet</h3><p className="text-sm text-muted-foreground mb-5">Only labs assigned to your account will appear here.</p><Link href="/labs" className="inline-block px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold">Browse Labs</Link></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {access.labs.map((item) => <div key={item.rentalId} className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col"><div className="h-40 bg-gradient-to-br from-[#0a192f] to-[#1a3a5c]">{item.lab.image_url && <img src={item.lab.image_url} alt={item.lab.title} className="w-full h-full object-cover" />}</div><div className="p-4 flex flex-col flex-1"><div className="flex justify-between gap-2 mb-2"><span className="text-xs font-bold uppercase tracking-widest text-primary">{item.lab.category}</span><span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span></div><h3 className="font-bold text-sm mb-2">{item.lab.title}</h3><p className="text-xs text-muted-foreground line-clamp-2 flex-1">{item.lab.description}</p>{item.expiresAt && <p className="text-xs text-muted-foreground mt-4">Expires {new Date(item.expiresAt).toLocaleString()}</p>}<button onClick={() => setNotice("Lab access setup is coming soon.")} disabled={!item.canAccess} className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold bg-[#23B33A] hover:bg-[#1ca033] text-white disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed">Access Lab</button>{item.canAccess && <p className="text-xs text-center text-muted-foreground mt-2">Lab access setup is coming soon.</p>}</div></div>)}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
