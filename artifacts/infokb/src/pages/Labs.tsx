import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, X, Loader2, Server, Clock, Tag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { formatUSDPrice } from "@/lib/currency";

// ── DB row shape from Supabase ────────────────────────────────────────────────
interface DbLab {
  id: string;
  title: string;
  description: string;
  image_url: string;
  category: string;
  duration: string;
  price: number;
  discounted_price: number | null;
  enabled: boolean;
  created_at: string;
}

const categoryColors: Record<string, string> = {
  "Cloud": "text-blue-600",
  "DevOps": "text-violet-600",
  "AI/ML": "text-purple-600",
  "Cybersecurity": "text-red-600",
  "Networking": "text-cyan-600",
  "Database": "text-orange-600",
  "Programming": "text-green-600",
  "Infrastructure": "text-indigo-600",
  "Agile": "text-pink-600",
  "Management": "text-teal-600",
  "Other": "text-gray-600",
};

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #0a192f 0%, #1a3a5c 50%, #0d2137 100%)",
  "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  "linear-gradient(135deg, #001219 0%, #005f73 50%, #0a9396 100%)",
  "linear-gradient(135deg, #03045e 0%, #0077b6 50%, #00b4d8 100%)",
  "linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #14b8a6 100%)",
  "linear-gradient(135deg, #042f2e 0%, #065f46 50%, #047857 100%)",
  "linear-gradient(135deg, #1b1b2f 0%, #e84393 40%, #f72585 100%)",
  "linear-gradient(135deg, #0c0a09 0%, #78350f 50%, #b45309 100%)",
];

// ── Lab Card ──────────────────────────────────────────────────────────────────

interface LabCardProps {
  lab: DbLab;
  index: number;
}

function LabCard({ lab, index }: LabCardProps) {
  const [, navigate] = useLocation();
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const hasDiscount = lab.discounted_price != null && lab.discounted_price < lab.price;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 border border-border flex flex-col cursor-pointer"
      onClick={() => navigate(`/labs/${lab.id}`)}
    >
      {/* Hero image */}
      <div className="relative h-44 w-full overflow-hidden">
        {lab.image_url ? (
          <img
            src={lab.image_url}
            alt={lab.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const parent = e.currentTarget.parentElement;
              if (parent) parent.style.background = gradient;
            }}
          />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: gradient }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Server className="h-12 w-12 text-white/20" />
            </div>
          </>
        )}
        {lab.duration && (
          <span className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <Clock className="h-3 w-3" />{lab.duration}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-5 flex flex-col flex-1">
        {lab.category && (
          <span className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1 ${categoryColors[lab.category] ?? "text-primary"}`}>
            <Tag className="h-3 w-3" />{lab.category}
          </span>
        )}

        <h3 className="font-bold text-foreground text-base leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {lab.title}
        </h3>

        {lab.description && (
          <p className="text-muted-foreground text-sm leading-relaxed mb-3 line-clamp-2 flex-1">
            {lab.description}
          </p>
        )}

        <div className="border-t border-border pt-4 mt-auto">
          <div className="flex items-center justify-between mb-3">
            {hasDiscount ? (
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-extrabold text-foreground">{formatUSDPrice(lab.discounted_price!)}</span>
                <span className="text-sm text-muted-foreground line-through">{formatUSDPrice(lab.price)}</span>
              </div>
            ) : (
              <span className="text-lg font-extrabold text-foreground">{formatUSDPrice(lab.price)}</span>
            )}
          </div>
          <button
            className="w-full py-2.5 bg-[#23B33A] hover:bg-[#1ca033] text-white text-sm font-semibold rounded-xl text-center transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/labs/${lab.id}`); }}
          >
            View Lab
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Labs() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [labs, setLabs] = useState<DbLab[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Lab Rentals | InfoKB";
  }, []);

  useEffect(() => {
    async function fetchLabs() {
      setLoading(true);
      setError("");

      if (!supabase) {
        setError("Database connection is not configured.");
        setLoading(false);
        return;
      }

      const { data, error: dbError } = await supabase
        .from("labs")
        .select("*")
        .eq("enabled", true)
        .order("created_at", { ascending: false });

      if (dbError) {
        console.error("[Labs] Supabase error:", dbError);
        setError("Failed to load labs. Please try again later.");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as DbLab[];
      setLabs(rows);

      const uniqueCats = Array.from(
        new Set(rows.map((l) => l.category).filter(Boolean))
      );
      setCategories(["All", ...uniqueCats]);

      setLoading(false);
    }

    fetchLabs();
  }, []);

  const filtered = labs.filter((lab) => {
    const matchesCategory = activeCategory === "All" || lab.category === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      lab.title.toLowerCase().includes(q) ||
      (lab.description ?? "").toLowerCase().includes(q) ||
      (lab.category ?? "").toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background pt-20">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            className="text-4xl sm:text-5xl font-extrabold text-white mb-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Lab Rentals
          </motion.h1>
          <motion.p
            className="text-white/70 text-base max-w-xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Hands-on virtual lab environments for Cloud, DevOps, Cybersecurity, and more. Practice in real infrastructure without any setup.
          </motion.p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading labs…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        ) : labs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
            <Server className="h-14 w-14 text-muted-foreground/30" />
            <h3 className="text-xl font-semibold text-foreground">No labs available yet</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Check back soon — new lab environments will appear here once they're published.
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
                  placeholder="Search labs..."
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
                        <span className="ml-1.5 text-xs opacity-70">({labs.length})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground text-sm">
                {filtered.length === labs.length
                  ? `Showing all ${filtered.length} lab${filtered.length !== 1 ? "s" : ""}`
                  : `Showing ${filtered.length} of ${labs.length} labs`}
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

            {/* Lab Grid */}
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
                  {filtered.map((lab, i) => (
                    <LabCard key={lab.id} lab={lab} index={i} />
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
                  <h3 className="text-lg font-semibold text-foreground mb-2">No labs found</h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Try a different search term or category.
                  </p>
                  <button
                    onClick={() => { setSearch(""); setActiveCategory("All"); }}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    View All Labs
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
