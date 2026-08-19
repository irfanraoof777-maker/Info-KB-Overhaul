import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Search, ArrowRight, CheckCircle, Star, Users, BookOpen, Award, Clock, Loader2, Server, Tag, Building2 } from "lucide-react";
import CourseCard from "@/components/CourseCard";
import { testimonials } from "@/data/courses";
import type { Course, Category } from "@/data/courses";
import { supabase } from "@/lib/supabase";

// -- DB row shape --------------------------------------------------------------
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
  difficulty_level: string;
  duration: string;
  trailer_url: string;
  thumbnail_url: string;
  created_at: string;
}

interface DbLab {
  id: string;
  title: string;
  image_url: string | null;
  category: string | null;
  duration: string | null;
  created_at: string;
}

const LAB_GRADIENTS = [
  "linear-gradient(135deg, #0a192f 0%, #1a3a5c 50%, #0d2137 100%)",
  "linear-gradient(135deg, #001219 0%, #005f73 50%, #0a9396 100%)",
  "linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #14b8a6 100%)",
];
const DB_GRADIENTS = [
  { gradient: "linear-gradient(135deg, #0a192f 0%, #1a3a5c 50%, #0d2137 100%)", accent: "#0ea5e9" },
  { gradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", accent: "#7c3aed" },
  { gradient: "linear-gradient(135deg, #001219 0%, #005f73 50%, #0a9396 100%)", accent: "#0d9488" },
  { gradient: "linear-gradient(135deg, #03045e 0%, #0077b6 50%, #00b4d8 100%)", accent: "#06b6d4" },
  { gradient: "linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #14b8a6 100%)", accent: "#14b8a6" },
  { gradient: "linear-gradient(135deg, #042f2e 0%, #065f46 50%, #047857 100%)", accent: "#34d399" },
];

function mapDbCourse(c: DbCourse, index: number): Course {
  const { gradient, accent } = DB_GRADIENTS[index % DB_GRADIENTS.length];
  const level = (["Beginner", "Intermediate", "Advanced", "Expert"].includes(c.difficulty_level)
    ? c.difficulty_level : "Intermediate") as Course["level"];
  return {
    id: c.id,
    slug: c.id,
    title: c.name,
    category: (c.category || "Cloud") as Exclude<Category, "All">,
    duration: c.duration || "",
    level,
    description: c.description || "",
    longDescription: c.long_description || c.description || "",
    highlights: Array.isArray(c.highlights) ? c.highlights : [],
    curriculum: Array.isArray(c.curriculum) ? c.curriculum : [],
    whoIsItFor: Array.isArray(c.who_is_it_for) ? c.who_is_it_for : [],
    instructor: c.instructor_name || "InfoKB",
    rating: 0,
    reviewCount: 0,
    students: 0,
    modules: Array.isArray(c.curriculum) ? c.curriculum.length : 0,
    price: Number(c.price) || 0,
    originalPrice: Number(c.price) || 0,
    onSale: false,
    imageGradient: gradient,
    imageAccent: accent,
    thumbnailUrl: c.thumbnail_url || undefined,
  };
}

const stats = [
  { icon: Award, value: "10+", label: "Years Experience" },
  { icon: Users, value: "6200+", label: "Students Trained" },
  { icon: BookOpen, value: "15+", label: "Courses Offered" },
  { icon: CheckCircle, value: "95%", label: "Success Rate" },
];

const steps = [
  { number: "01", title: "Browse Courses", description: "Explore our curated catalog of IT certifications and training programs across cloud, DevOps, AI, and more." },
  { number: "02", title: "Enquire & Enroll", description: "Reach out to our team. We'll help you choose the right course, schedule, and format for your career goals." },
  { number: "03", title: "Learn & Certify", description: "Train with expert instructors, get hands-on lab access, and walk away with an industry-recognized certification." },
];

export default function Home() {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [featuredLabs, setFeaturedLabs] = useState<DbLab[]>([]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(search.trim() ? `/courses?q=${encodeURIComponent(search.trim())}` : "/courses");
  };

  useEffect(() => {
    if (!supabase) { setCoursesLoading(false); return; }
    supabase
      .from("courses")
      .select("id,name,category,price,description,difficulty,duration,trailer_url,thumbnail_url,created_at,difficulty_level,is_published,slug,updated_at,long_description,highlights,curriculum,who_is_it_for,instructor_name,instructor_bio")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setFeaturedCourses((data as DbCourse[]).map(mapDbCourse));
        }
        setCoursesLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("labs")
      .select("id,title,image_url,category,duration,created_at")
      .eq("enabled", true)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setFeaturedLabs((data ?? []) as DbLab[]));
  }, []);
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative gradient-hero min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 right-10 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-20 left-10 w-96 h-96 rounded-full bg-[#23B33A]/10 blur-3xl" />
          <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm font-medium mb-6">
                <span className="w-2 h-2 rounded-full bg-[#23B33A] animate-pulse" />
                10+ Years of Training Excellence
              </span>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Advance Your IT Career with{" "}
              <span className="text-[#23B33A]">Expert-Led</span>{" "}
              Certification Training
            </motion.h1>

            <motion.p
              className="text-lg text-white/75 mb-8 max-w-xl leading-relaxed"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              From AWS and DevOps to Generative AI and Nutanix — hands-on training that actually gets you certified and hired.
            </motion.p>

            <motion.form
              onSubmit={handleSearch}
              className="flex gap-2 mb-8 max-w-xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search courses..."
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/12 border border-white/25 text-white placeholder-white/50 focus:outline-none focus:border-white/50 focus:bg-white/18 transition-all text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 bg-[#23B33A] hover:bg-[#1ca033] text-white font-semibold rounded-xl transition-colors text-sm whitespace-nowrap"
              >
                Search
              </button>
            </motion.form>

            <motion.div
              className="flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#005B99] font-semibold rounded-xl hover:bg-white/90 transition-colors text-sm"
              >
                Browse All Courses
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Contact Us
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="flex flex-col items-center text-center py-4"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center mb-3">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-3xl font-extrabold text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-20 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-[#23B33A] font-semibold text-sm uppercase tracking-wider">Our Courses</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mt-2 mb-4">
              Industry-Recognized Training
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base">
              Hands-on, instructor-led courses aligned with real certifications. Built for professionals who want results, not just certificates.
            </p>
          </motion.div>

          {coursesLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm">Loading courses…</span>
            </div>
          ) : featuredCourses.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {featuredCourses.map((course, i) => (
                  <CourseCard key={course.id} course={course} index={i} />
                ))}
              </div>
              <div className="text-center">
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
                >
                  View All Courses
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
              >
                Browse Courses
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Featured Lab Rentals */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="text-[#23B33A] font-semibold text-sm uppercase tracking-wider">Hands-On Labs</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mt-2 mb-4">Practice with Real Lab Environments</h2>
            <p className="text-muted-foreground max-w-3xl mx-auto text-base leading-relaxed">Build practical skills with hands-on access to real IT lab environments. Practice VMware, NetApp, Nutanix, Cloud, Backup &amp; Recovery and more without setting up the infrastructure yourself.</p>
          </motion.div>

          {featuredLabs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {featuredLabs.map((lab, index) => (
                <motion.div key={lab.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: index * 0.08 }}>
                  <Link href={`/labs/${lab.id}`} className="group block h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                    <div className="relative h-44 overflow-hidden" style={{ background: LAB_GRADIENTS[index % LAB_GRADIENTS.length] }}>
                      {lab.image_url ? <img src={lab.image_url} alt={lab.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 flex items-center justify-center"><Server className="h-12 w-12 text-white/25" /></div>}
                      {lab.duration && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm"><Clock className="h-3 w-3" />{lab.duration}</span>}
                    </div>
                    <div className="p-5">
                      {lab.category && <span className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary"><Tag className="h-3 w-3" />{lab.category}</span>}
                      <h3 className="text-base font-bold leading-snug text-foreground transition-colors group-hover:text-primary">{lab.title}</h3>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          <div className="text-center">
            <Link href="/labs" className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 font-semibold text-white transition-colors hover:bg-primary/90">Browse All Labs <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/[0.05] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><Building2 className="h-5 w-5" /></span>
              <div>
                <h3 className="font-bold text-foreground">Need labs for your team or institution?</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Corporate and bulk lab access is available for companies, training institutes, colleges and larger groups.</p>
              </div>
            </div>
            <Link href="/contact?type=bulk-lab" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-primary px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white">Request Bulk Access <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
      {/* How it works */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-[#23B33A] font-semibold text-sm uppercase tracking-wider">The Process</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mt-2 mb-4">
              How InfoKB Works
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                className="relative"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
              >
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-border to-transparent z-0" style={{ width: "calc(100% - 4rem)", left: "calc(100% - 2rem)" }} />
                )}
                <div className="relative bg-card rounded-2xl p-8 border border-border">
                  <div className="text-5xl font-extrabold text-primary/12 mb-4">{step.number}</div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-[#001f3d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-[#23B33A] font-semibold text-sm uppercase tracking-wider">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 mb-4">
              What Our Students Say
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                className="glass rounded-2xl p-6"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-[#23B33A] text-[#23B33A]" />
                  ))}
                </div>
                <p className="text-white/75 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div>
                  <div className="font-semibold text-white text-sm">{t.name}</div>
                  <div className="text-white/50 text-xs mt-0.5">{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-[#005B99] to-[#0077cc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-2xl mx-auto text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-extrabold text-white mb-4">
              Ready to Level Up Your Career?
            </h2>
            <p className="text-white/75 mb-8 text-base">
              Talk to our training advisors and find the right certification path for your goals.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="tel:+919652429090"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#23B33A] text-white font-semibold rounded-xl hover:bg-[#1ca033] transition-colors"
              >
                Call +91-9652429090
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold rounded-xl transition-colors"
              >
                Send a Message
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}