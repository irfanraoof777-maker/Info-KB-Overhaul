import { useState, useEffect } from "react";
import { Search, X, Loader2, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CourseCard from "@/components/CourseCard";
import type { Course, Category } from "@/data/courses";
import { supabase } from "@/lib/supabase";

// ── DB row shape from Supabase ────────────────────────────────────────────────
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
  full_video_url: string;
  thumbnail_url: string;
  created_at: string;
}

const DB_GRADIENTS = [
  { gradient: "linear-gradient(135deg, #0a192f 0%, #1a3a5c 50%, #0d2137 100%)", accent: "#0ea5e9" },
  { gradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", accent: "#7c3aed" },
  { gradient: "linear-gradient(135deg, #001219 0%, #005f73 50%, #0a9396 100%)", accent: "#0d9488" },
  { gradient: "linear-gradient(135deg, #03045e 0%, #0077b6 50%, #00b4d8 100%)", accent: "#06b6d4" },
  { gradient: "linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #14b8a6 100%)", accent: "#14b8a6" },
  { gradient: "linear-gradient(135deg, #042f2e 0%, #065f46 50%, #047857 100%)", accent: "#34d399" },
  { gradient: "linear-gradient(135deg, #1b1b2f 0%, #e84393 40%, #f72585 100%)", accent: "#f72585" },
  { gradient: "linear-gradient(135deg, #0c0a09 0%, #78350f 50%, #b45309 100%)", accent: "#f59e0b" },
];

function mapDbCourse(c: DbCourse, index: number): Course {
  const { gradient, accent } = DB_GRADIENTS[index % DB_GRADIENTS.length];
  const level = (["Beginner", "Intermediate", "Advanced", "Expert"].includes(c.difficulty_level)
    ? c.difficulty_level
    : "Intermediate") as Course["level"];
  const category = (c.category || "Cloud") as Exclude<Category, "All">;
  return {
    id: c.id,
    slug: c.id,
    title: c.name,
    category,
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

export default function Courses() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initialQuery = params.get("q") ?? "";

  const [search, setSearch] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>(["All"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Courses | InfoKB";
  }, []);

  useEffect(() => {
    async function fetchCourses() {
      setLoading(true);
      setError("");

      if (!supabase) {
        setError("Database connection is not configured.");
        setLoading(false);
        return;
      }

      const { data, error: dbError } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbError) {
        setError("Failed to load courses. Please try again later.");
        setLoading(false);
        return;
      }

      const mapped = ((data ?? []) as DbCourse[]).map(mapDbCourse);
      setCourses(mapped);

      const uniqueCats = Array.from(
        new Set((data ?? []).map((c: DbCourse) => c.category).filter(Boolean))
      ) as Exclude<Category, "All">[];
      setCategories(["All", ...uniqueCats]);

      setLoading(false);
    }

    fetchCourses();
  }, []);

  const filtered = courses.filter((c) => {
    const matchesCategory = activeCategory === "All" || c.category === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f4f8fb] pt-20">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            className="text-4xl sm:text-5xl font-extrabold text-white mb-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Our Courses
          </motion.h1>
          <motion.p
            className="text-white/70 text-base max-w-xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Industry-recognized courses across Cloud, DevOps, AI, and more. Find the right certification for your career.
          </motion.p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading courses…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
            <BookOpen className="h-14 w-14 text-muted-foreground/30" />
            <h3 className="text-xl font-semibold text-foreground">No courses available yet</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Check back soon — new courses will appear here once they're published.
            </p>
          </div>
        ) : (
          <>
            {/* Search + Filter */}
            <div className="mb-8 space-y-4">
              <div className="relative max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search courses..."
                  className="w-full pl-11 pr-10 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              {categories.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        activeCategory === cat
                          ? "bg-primary text-white shadow-sm"
                          : "bg-background text-muted-foreground border border-border hover:border-primary hover:text-primary"
                      }`}
                    >
                      {cat}
                      {cat === "All" && (
                        <span className="ml-1.5 text-xs opacity-70">({courses.length})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground text-sm">
                {filtered.length === courses.length
                  ? `Showing all ${filtered.length} course${filtered.length !== 1 ? "s" : ""}`
                  : `Showing ${filtered.length} of ${courses.length} courses`}
              </p>
              {(search || activeCategory !== "All") && (
                <button
                  onClick={() => { setSearch(""); setActiveCategory("All"); }}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              )}
            </div>

            {/* Course Grid */}
            <AnimatePresence mode="wait">
              {filtered.length > 0 ? (
                <motion.div
                  key={`${activeCategory}-${search}`}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {filtered.map((course, i) => (
                    <CourseCard key={course.id} course={course} index={i} />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  className="text-center py-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Search className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No courses found</h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Try a different search term or category.
                  </p>
                  <button
                    onClick={() => { setSearch(""); setActiveCategory("All"); }}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    View All Courses
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
