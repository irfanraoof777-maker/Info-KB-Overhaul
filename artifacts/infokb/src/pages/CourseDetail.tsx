import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Clock, BarChart2, CheckCircle, ArrowLeft, ChevronDown, ChevronUp, Play, Lock, User, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ── DB row shape ──────────────────────────────────────────────────────────────
interface DbCourse {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  long_description: string;
  highlights: string[];
  curriculum: { module: string; topics: string[] }[];
  who_is_it_for: string[];
  instructor_name: string;
  instructor_bio: string;
  difficulty_level: string;
  duration: string;
  trailer_url: string;
  full_video_url: string;
  thumbnail_url: string;
}

interface DisplayCourse {
  id: string;
  title: string;
  category: string;
  level: string;
  description: string;
  longDescription: string;
  highlights: string[];
  curriculum: { module: string; topics: string[] }[];
  whoIsItFor: string[];
  instructor: string;
  instructorBio: string;
  duration: string;
  price: number;
  trailerUrl: string;
  fullVideoUrl: string;
  thumbnailUrl: string;
}

function mapDb(c: DbCourse): DisplayCourse {
  return {
    id: c.id,
    title: c.name,
    category: c.category,
    level: c.difficulty_level || "Intermediate",
    description: c.description,
    longDescription: c.long_description || c.description,
    highlights: Array.isArray(c.highlights) ? c.highlights : [],
    curriculum: Array.isArray(c.curriculum) ? c.curriculum : [],
    whoIsItFor: Array.isArray(c.who_is_it_for) ? c.who_is_it_for : [],
    instructor: c.instructor_name || "",
    instructorBio: c.instructor_bio || "",
    duration: c.duration,
    price: Number(c.price) || 0,
    trailerUrl: c.trailer_url || "",
    fullVideoUrl: c.full_video_url || "",
    thumbnailUrl: c.thumbnail_url || "",
  };
}

// ── Razorpay types ────────────────────────────────────────────────────────────
declare global {
  interface Window {
    Razorpay: new (opts: object) => { open(): void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Video player ──────────────────────────────────────────────────────────────
function VideoPlayer({ url, title, locked }: { url: string; title: string; locked?: boolean }) {
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

  if (locked) {
    return (
      <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden flex flex-col items-center justify-center gap-3">
        <Lock className="h-10 w-10 text-white/40" />
        <p className="text-white/60 text-sm font-medium">Purchase to unlock full course</p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
        <p className="text-white/40 text-sm">No video available</p>
      </div>
    );
  }

  if (isYoutube) {
    let embedId = "";
    try {
      const u = new URL(url);
      embedId = u.searchParams.get("v") ?? u.pathname.replace("/", "");
    } catch { embedId = url; }
    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl">
        <iframe
          src={`https://www.youtube.com/embed/${embedId}?autoplay=0&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl">
      <video src={url} controls className="absolute inset-0 w-full h-full" preload="metadata">
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CourseDetail() {
  const params = useParams<{ slug: string }>();
  const { user, session } = useAuth();
  const [, navigate] = useLocation();

  const [course, setCourse] = useState<DisplayCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [openModule, setOpenModule] = useState<number | null>(0);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");

  // Fetch course from Supabase only
  useEffect(() => {
    async function load() {
      setLoading(true);
      setNotFound(false);

      if (!supabase) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", params.slug)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setCourse(mapDb(data as DbCourse));
      }
      setLoading(false);
    }
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [params.slug]);

  useEffect(() => {
    if (course) document.title = `${course.title} | InfoKB`;
  }, [course]);

  // Check enrollment
  useEffect(() => {
    if (!user || !course || !supabase) return;
    supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setEnrolled(true); });
  }, [user, course]);

  const handleEnroll = async () => {
    if (!course) return;
    if (!user) { navigate("/login"); return; }

    setEnrolling(true);
    setEnrollError("");

    try {
      const rzpKeyId = import.meta.env.RAZORPAY_KEY_ID as string;

      if (!rzpKeyId) {
        const res = await fetch("/api/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            user_email: user.email,
            course_id: course.id,
            course_name: course.title,
            amount: course.price,
            payment_id: "free",
          }),
        });
        if (!res.ok) throw new Error("Enrollment failed");
        setEnrolled(true);
        setEnrolling(false);
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Could not load payment gateway. Please try again.");

      const options = {
        key: rzpKeyId,
        amount: course.price * 100,
        currency: "INR",
        name: "InfoKB",
        description: course.title,
        image: "/favicon.ico",
        prefill: { email: user.email ?? "" },
        theme: { color: "#005B99" },
        handler: async (response: { razorpay_payment_id: string }) => {
          try {
            const res = await fetch("/api/enroll", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({
                user_id: user.id,
                user_email: user.email,
                course_id: course.id,
                course_name: course.title,
                amount: course.price,
                payment_id: response.razorpay_payment_id,
              }),
            });
            if (!res.ok) throw new Error("Could not save enrollment.");
            setEnrolled(true);
            navigate("/dashboard");
          } catch (err) {
            setEnrollError(err instanceof Error ? err.message : "Enrollment failed after payment.");
          } finally {
            setEnrolling(false);
          }
        },
        modal: { ondismiss: () => setEnrolling(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : "Payment failed.");
      setEnrolling(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-20 text-center px-4">
        <h1 className="text-2xl font-bold text-foreground mb-4">Course Not Found</h1>
        <p className="text-muted-foreground mb-6">The course you're looking for doesn't exist or has been removed.</p>
        <Link href="/courses" className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors">
          Browse All Courses
        </Link>
      </div>
    );
  }

  const formatPrice = (p: number) =>
    p === 0 ? "Free" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(p);

  return (
    <div className="min-h-screen bg-[#f4f8fb] pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/courses" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Courses
          </Link>
          <div className="flex flex-wrap gap-3 mb-4">
            {course.category && (
              <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">{course.category}</span>
            )}
            {course.level && (
              <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">{course.level}</span>
            )}
          </div>
          <motion.h1
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 max-w-3xl"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          >
            {course.title}
          </motion.h1>
          <p className="text-white/70 text-base max-w-2xl mb-6">{course.description}</p>
          <div className="flex flex-wrap gap-5">
            {course.duration && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Clock className="h-4 w-4 text-[#23B33A]" />{course.duration}
              </div>
            )}
            {course.level && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <BarChart2 className="h-4 w-4 text-[#23B33A]" />{course.level} Level
              </div>
            )}
            {course.instructor && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <User className="h-4 w-4 text-[#23B33A]" />{course.instructor}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">

            {/* About */}
            {course.longDescription && (
              <motion.div className="bg-white rounded-2xl border border-border p-8"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <h2 className="text-xl font-bold text-foreground mb-4">About This Course</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{course.longDescription}</p>
              </motion.div>
            )}

            {/* What you'll learn */}
            {course.highlights.length > 0 && (
              <motion.div className="bg-white rounded-2xl border border-border p-8"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
                <h2 className="text-xl font-bold text-foreground mb-5">What You'll Learn</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {course.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-[#23B33A] shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{h}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Curriculum */}
            {course.curriculum.length > 0 && (
              <motion.div className="bg-white rounded-2xl border border-border p-8"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                <h2 className="text-xl font-bold text-foreground mb-5">Course Curriculum</h2>
                <div className="space-y-3">
                  {course.curriculum.map((mod, i) => (
                    <div key={i} className="border border-border rounded-xl overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => setOpenModule(openModule === i ? null : i)}
                      >
                        <span className="font-semibold text-foreground text-sm">{mod.module}</span>
                        {openModule === i
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {openModule === i && (
                        <div className="border-t border-border px-5 py-4">
                          <ul className="space-y-2">
                            {mod.topics.map((topic, j) => (
                              <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />{topic}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Who is it for */}
            {course.whoIsItFor.length > 0 && (
              <motion.div className="bg-white rounded-2xl border border-border p-8"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
                <h2 className="text-xl font-bold text-foreground mb-5">Who Is This For</h2>
                <div className="flex flex-wrap gap-2">
                  {course.whoIsItFor.map((w, i) => (
                    <span key={i} className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">{w}</span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Instructor */}
            {course.instructor && (
              <motion.div className="bg-white rounded-2xl border border-border p-8"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
                <h2 className="text-xl font-bold text-foreground mb-4">Your Instructor</h2>
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xl font-bold text-primary">{course.instructor[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{course.instructor}</p>
                    {course.instructorBio && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{course.instructorBio}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <motion.div
              className="bg-white rounded-2xl border border-border overflow-hidden sticky top-24 shadow-lg"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            >
              {/* Video / thumbnail */}
              <div className="p-4 border-b border-border bg-gray-950">
                {enrolled && course.fullVideoUrl ? (
                  <VideoPlayer url={course.fullVideoUrl} title={`${course.title} — Full Course`} />
                ) : course.trailerUrl ? (
                  <div className="relative">
                    <VideoPlayer url={course.trailerUrl} title={`${course.title} — Preview`} />
                    {!enrolled && (
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1">
                        <Play className="h-3 w-3" /> Preview
                      </div>
                    )}
                  </div>
                ) : course.thumbnailUrl ? (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                    <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="h-7 w-7 text-white fill-white ml-1" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-video rounded-xl bg-gray-800 flex items-center justify-center">
                    <Play className="h-10 w-10 text-white/30" />
                  </div>
                )}
              </div>

              {/* Price + CTA */}
              <div className="p-6">
                <div className="mb-5">
                  <span className="text-3xl font-extrabold text-foreground">{formatPrice(course.price)}</span>
                </div>

                {enrolled ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[#23B33A] font-semibold text-sm">
                      <CheckCircle className="h-5 w-5" /> You're enrolled in this course
                    </div>
                    {course.fullVideoUrl && (
                      <button
                        onClick={() => document.querySelector(".aspect-video")?.scrollIntoView({ behavior: "smooth" })}
                        className="w-full py-3.5 bg-[#23B33A] hover:bg-[#1ca033] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
                      >
                        <Play className="h-5 w-5 fill-white" /> Watch Course
                      </button>
                    )}
                    <Link href="/dashboard"
                      className="block text-center w-full py-2.5 border border-border hover:border-primary hover:text-primary text-muted-foreground rounded-xl transition-colors text-sm font-medium">
                      Go to Dashboard
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleEnroll}
                      disabled={enrolling}
                      className="w-full py-3.5 bg-[#23B33A] hover:bg-[#1ca033] disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
                    >
                      {enrolling
                        ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
                        : `Enroll Now — ${formatPrice(course.price)}`}
                    </button>
                    {!user && (
                      <p className="text-xs text-center text-muted-foreground">
                        <Link href="/login" className="text-primary hover:underline">Sign in</Link> to enroll
                      </p>
                    )}
                    {enrollError && (
                      <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{enrollError}</p>
                    )}
                    <div className="pt-2 space-y-2 text-sm text-muted-foreground">
                      {course.duration && <div className="flex items-center gap-2"><Clock className="h-4 w-4" />{course.duration}</div>}
                      {course.level && <div className="flex items-center gap-2"><BarChart2 className="h-4 w-4" />{course.level} level</div>}
                      {course.instructor && <div className="flex items-center gap-2"><User className="h-4 w-4" />by {course.instructor}</div>}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
