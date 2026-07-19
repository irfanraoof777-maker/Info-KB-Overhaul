import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Play, BookOpen, Loader2, Lock, Clock, BarChart2 } from "lucide-react";

interface EnrolledCourse {
  course_id: string;
  enrolled_at: string;
  courses: {
    id: string;
    name: string;
    category: string;
    price: number;
    duration: string;
    difficulty_level: string;
    thumbnail_url: string;
    full_video_url: string;
    trailer_url: string;
    description: string;
  };
}

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

  let embedUrl = url;
  if (isYoutube) {
    try {
      const u = new URL(url);
      const id = u.searchParams.get("v") ?? u.pathname.replace("/", "");
      embedUrl = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    } catch { embedUrl = url; }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm font-medium"
        >
          ✕ Close
        </button>
        <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
          {isYoutube ? (
            <iframe
              src={embedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          ) : (
            <video src={url} controls autoPlay className="w-full h-full" />
          )}
        </div>
        <p className="text-white/70 text-sm mt-3 text-center">{title}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [myCourses, setMyCourses] = useState<EnrolledCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [playingCourse, setPlayingCourse] = useState<EnrolledCourse | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !session) return;
    async function fetchMyCourses() {
      setCoursesLoading(true);
      try {
        const res = await fetch("/api/my-courses", {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        });
        if (res.ok) {
          const data = await res.json() as { courses: EnrolledCourse[] };
          setMyCourses(data.courses ?? []);
        }
      } catch { /* silently fail */ } finally {
        setCoursesLoading(false);
      }
    }
    fetchMyCourses();
  }, [user, session]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => { await signOut(); navigate("/"); };

  return (
    <div className="min-h-screen bg-background pt-20">
      {playingCourse && (
        <VideoModal
          url={playingCourse.courses.full_video_url || playingCourse.courses.trailer_url}
          title={playingCourse.courses.name}
          onClose={() => setPlayingCourse(null)}
        />
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">My Dashboard</h1>
            <p className="text-white/70 text-sm">{user.email}</p>
          </div>
          <Button
            variant="outline"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-card rounded-2xl border border-border p-5">
            <p className="text-muted-foreground text-sm mb-1">Enrolled Courses</p>
            <p className="text-3xl font-extrabold text-foreground">{myCourses.length}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5">
            <p className="text-muted-foreground text-sm mb-1">Account</p>
            <p className="text-sm font-semibold text-foreground truncate">{user.email}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm mb-1">Browse More</p>
              <p className="text-sm font-semibold text-foreground">Find new courses</p>
            </div>
            <Link href="/courses"
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors">
              Explore
            </Link>
          </div>
        </div>

        {/* My Courses */}
        <h2 className="text-xl font-bold text-foreground mb-5">My Courses</h2>

        {coursesLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm">Loading your courses…</span>
          </div>
        ) : myCourses.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No courses yet</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Enroll in a course to start your learning journey.
            </p>
            <Link href="/courses"
              className="inline-block px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors text-sm">
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {myCourses.map((ec) => {
              const c = ec.courses;
              const hasVideo = !!(c.full_video_url || c.trailer_url);
              return (
                <div key={ec.course_id}
                  className="group bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col">
                  {/* Thumbnail */}
                  <div className="relative h-40 bg-gradient-to-br from-[#003d6b] to-[#005B99] overflow-hidden">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-20">
                        <BookOpen className="h-16 w-16 text-white" />
                      </div>
                    )}
                    {hasVideo && (
                      <button
                        onClick={() => setPlayingCourse(ec)}
                        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Play className="h-6 w-6 text-[#003d6b] fill-[#003d6b] ml-1" />
                        </div>
                      </button>
                    )}
                    {!c.full_video_url && (
                      <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm rounded-md px-2 py-1 flex items-center gap-1">
                        <Lock className="h-3 w-3 text-white/60" />
                        <span className="text-white/60 text-xs">Preview only</span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 flex flex-col flex-1">
                    {c.category && (
                      <span className="text-xs font-bold uppercase tracking-widest text-primary mb-1">{c.category}</span>
                    )}
                    <h3 className="font-bold text-foreground text-sm leading-snug mb-2 line-clamp-2">{c.name}</h3>
                    {c.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">{c.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                      {c.duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.duration}</span>}
                      {c.difficulty_level && <span className="flex items-center gap-1"><BarChart2 className="h-3 w-3" />{c.difficulty_level}</span>}
                    </div>
                    <button
                      onClick={() => hasVideo ? setPlayingCourse(ec) : undefined}
                      disabled={!hasVideo}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                        hasVideo
                          ? "bg-[#23B33A] hover:bg-[#1ca033] text-white"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      {hasVideo ? <><Play className="h-4 w-4 fill-white" /> Watch Course</> : "Video coming soon"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
