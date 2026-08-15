import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { Clock, Tag, ArrowLeft, Loader2, Server, X } from "lucide-react";
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
}

export default function LabDetail() {
  const params = useParams<{ id: string }>();

  const [lab, setLab] = useState<DbLab | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPaymentNotice, setShowPaymentNotice] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");

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
        .from("labs")
        .select("*")
        .eq("id", params.id)
        .eq("enabled", true)
        .single();

      if (error || !data) {
        console.error("[LabDetail] Supabase error:", error);
        setNotFound(true);
      } else {
        setLab(data as DbLab);
      }
      setLoading(false);
    }

    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [params.id]);

  useEffect(() => {
    if (lab) document.title = `${lab.title} | InfoKB`;
  }, [lab]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !lab) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-20 text-center px-4">
        <Server className="h-14 w-14 text-muted-foreground/30 mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-4">Lab Not Found</h1>
        <p className="text-muted-foreground mb-6">This lab environment doesn't exist or is currently unavailable.</p>
        <Link href="/labs" className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors">
          Browse All Labs
        </Link>
      </div>
    );
  }

  const hasDiscount = lab.discounted_price != null && lab.discounted_price < lab.price;
  const effectivePrice = hasDiscount ? lab.discounted_price! : lab.price;
  const isFree = Number(effectivePrice) === 0;

  const claimFreeLab = async () => {
    if (!supabase || claiming) return;
    setClaiming(true); setClaimError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.assign(`/login?redirect=${encodeURIComponent(`/labs/${lab.id}`)}`);
        return;
      }
      const response = await fetch("/api/lab-rentals/free-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ labId: lab.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to claim this Lab.");
      window.location.assign("/dashboard");
    } catch (cause) {
      setClaimError(cause instanceof Error ? cause.message : "Unable to claim this Lab.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/labs" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Lab Rentals
          </Link>

          {lab.category && (
            <div className="mb-4">
              <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">{lab.category}</span>
            </div>
          )}

          <motion.h1
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 max-w-3xl"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          >
            {lab.title}
          </motion.h1>

          {lab.description && (
            <p className="text-white/70 text-base max-w-2xl mb-6">{lab.description}</p>
          )}

          <div className="flex flex-wrap gap-5">
            {lab.duration && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Clock className="h-4 w-4 text-[#23B33A]" />{lab.duration}
              </div>
            )}
            {lab.category && (
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Tag className="h-4 w-4 text-[#23B33A]" />{lab.category}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {lab.description && (
              <motion.div
                className="bg-card rounded-2xl border border-border p-8"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              >
                <h2 className="text-xl font-bold text-foreground mb-4">About This Lab</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{lab.description}</p>
              </motion.div>
            )}

            <motion.div
              className="bg-card rounded-2xl border border-border p-8"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
            >
              <h2 className="text-xl font-bold text-foreground mb-5">Lab Details</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {lab.category && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Category</dt>
                    <dd className="text-foreground font-medium">{lab.category}</dd>
                  </div>
                )}
                {lab.duration && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Duration</dt>
                    <dd className="text-foreground font-medium flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />{lab.duration}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Price</dt>
                  <dd className="flex items-baseline gap-2">
                    <span className="text-foreground font-bold text-lg">{isFree ? "Free" : formatUSDPrice(effectivePrice)}</span>
                  </dd>
                </div>
              </dl>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div>
            <motion.div
              className="bg-card rounded-2xl border border-border overflow-hidden sticky top-24 shadow-lg"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            >
              {/* Image */}
              <div className="border-b border-border">
                {lab.image_url ? (
                  <div className="w-full aspect-video overflow-hidden">
                    <img
                      src={lab.image_url}
                      alt={lab.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.style.background = "linear-gradient(135deg, #0a192f 0%, #1a3a5c 50%, #0d2137 100%)";
                          parent.style.minHeight = "180px";
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="w-full aspect-video flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #0a192f 0%, #1a3a5c 50%, #0d2137 100%)" }}
                  >
                    <Server className="h-12 w-12 text-white/20" />
                  </div>
                )}
              </div>

              {/* Pricing + CTA */}
              <div className="p-6 space-y-4">
                <div>
                  <span className="text-2xl font-extrabold text-foreground">{isFree ? "Free" : formatUSDPrice(effectivePrice)}</span>
                  {hasDiscount && !isFree && <span className="ml-2 text-base text-muted-foreground line-through">{formatUSDPrice(lab.price)}</span>}
                </div>

                <button
                  type="button"
                  onClick={() => isFree ? void claimFreeLab() : setShowPaymentNotice(true)}
                  className="w-full py-3.5 bg-[#23B33A] hover:bg-[#1ca033] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
                  disabled={claiming}
                >
                  {claiming ? <><Loader2 className="h-4 w-4 animate-spin" />Claiming…</> : isFree ? "Get Free Lab" : "Purchase Lab"}
                </button>

                {claimError && <p role="alert" className="text-sm text-destructive">{claimError}</p>}
                {showPaymentNotice && !isFree && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="relative rounded-xl border border-primary/30 bg-primary/5 p-4 pr-10 text-foreground dark:bg-primary/10"
                  >
                    <button
                      type="button"
                      onClick={() => setShowPaymentNotice(false)}
                      className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Dismiss payment availability notice"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <h2 className="font-bold">Online Payments Coming Soon</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Secure online checkout for lab rentals will be available shortly.
                    </p>
                  </div>
                )}

                <div className="pt-2 space-y-2 text-sm text-muted-foreground border-t border-border">
                  {lab.duration && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0" />{lab.duration}
                    </div>
                  )}
                  {lab.category && (
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 shrink-0" />{lab.category}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
