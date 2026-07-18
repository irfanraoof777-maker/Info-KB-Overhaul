import { useState, useEffect } from "react";
import { Search, X, Loader2, FlaskConical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

interface Lab {
  id: string;
  title: string;
  description: string;
  image_url: string;
  duration_days: number;
  price: number;
  discount_price: number | null;
  enabled: boolean;
  created_at: string;
}

const DB_GRADIENTS = [
  { gradient: "linear-gradient(135deg, #0a192f 0%, #1a3a5c 50%, #0d2137 100%)", accent: "#0ea5e9" },
  { gradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", accent: "#7c3aed" },
  { gradient: "linear-gradient(135deg, #001219 0%, #005f73 50%, #0a9396 100%)", accent: "#0d9488" },
  { gradient: "linear-gradient(135deg, #03045e 0%, #0077b6 50%, #00b4d8 100%)", accent: "#06b6d4" },
  { gradient: "linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #14b8a6 100%)", accent: "#14b8a6" },
  { gradient: "linear-gradient(135deg, #042f2e 0%, #065f46 50%, #047857 100%)", accent: "#34d399" },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
}

function LabCard({ lab, index }: { lab: Lab; index: number }) {
  const [, navigate] = useLocation();
  const { gradient, accent } = DB_GRADIENTS[index % DB_GRADIENTS.length];
  const finalPrice = lab.discount_price != null ? lab.discount_price : lab.price;
  const hasDiscount = lab.discount_price != null && lab.discount_price < lab.price;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 border border-border flex flex-col cursor-pointer"
      onClick={() => navigate(`/lab-rentals/${lab.id}`)}
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
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <FlaskConical className="h-16 w-16 text-white" />
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full blur-2xl opacity-40" style={{ backgroundColor: accent }} />
          </>
        )}
        {hasDiscount && (
          <span className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm tracking-wide uppercase">SALE</span>
        )}
        <span className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-lg">
          {lab.duration_days} {lab.duration_days === 1 ? "Day" : "Days"} Access
        </span>
      </div>

      {/* Card body */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-foreground text-base leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {lab.title}
        </h3>
        {lab.description && (
          <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-2 flex-1">
            {lab.description}
          </p>
        )}

        <div className="border-t border-border pt-4 mt-auto">
          {/* Pricing */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-bold text-foreground">{formatPrice(finalPrice)}</span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">{formatPrice(lab.price)}</span>
            )}
          </div>
          <button
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl text-center transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/lab-rentals/${lab.id}`); }}
          >
            View Details
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function LabRentals() {
  const [search, setSearch] = useState("");
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Lab Rentals | InfoKB";
  }, []);

  useEffect(() => {
    async function fetchLabs() {
      setLoading(true);
      setError("");
      try {
        if (!supabase) throw new Error("Supabase is not configured (missing environment variables).");
        const { data, error } = await supabase
          .from("labs")
          .select("*")
          .eq("enabled", true)
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message || JSON.stringify(error));
        setLabs(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load labs. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchLabs();
  }, []);

  const filtered = labs.filter((lab) => {
    const q = search.toLowerCase();
    return !q || lab.title.toLowerCase().includes(q) || lab.description.toLowerCase().includes(q);
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
            Hands-on lab environments for real-world practice. Rent a lab and start learning today.
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
            <FlaskConical className="h-14 w-14 text-muted-foreground/30" />
            <h3 className="text-xl font-semibold text-foreground">No labs available yet</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Check back soon — lab environments will appear here once they're published.
            </p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="mb-8">
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
            </div>

            {/* Count */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground text-sm">
                {filtered.length === labs.length
                  ? `Showing all ${filtered.length} lab${filtered.length !== 1 ? "s" : ""}`
                  : `Showing ${filtered.length} of ${labs.length} labs`}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Clear search
                </button>
              )}
            </div>

            {/* Grid */}
            <AnimatePresence mode="wait">
              {filtered.length > 0 ? (
                <motion.div
                  key={search}
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
                  <p className="text-muted-foreground text-sm mb-6">Try a different search term.</p>
                  <button
                    onClick={() => setSearch("")}
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
