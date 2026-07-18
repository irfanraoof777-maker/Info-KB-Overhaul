import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Clock, CheckCircle, ArrowLeft, FlaskConical, Loader2, ShoppingCart } from "lucide-react";

interface Lab {
  id: string;
  title: string;
  description: string;
  image_url: string;
  duration_days: number;
  price: number;
  discount_price: number | null;
  enabled: boolean;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
}

export default function LabDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const [lab, setLab] = useState<Lab | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/labs/${params.id}`);
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json() as { lab: Lab };
        setLab(data.lab);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [params.id]);

  useEffect(() => {
    if (lab) document.title = `${lab.title} | InfoKB Lab Rentals`;
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
        <h1 className="text-2xl font-bold text-foreground mb-4">Lab Not Found</h1>
        <p className="text-muted-foreground mb-6">The lab you're looking for doesn't exist or is no longer available.</p>
        <Link href="/lab-rentals" className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors">
          Browse All Labs
        </Link>
      </div>
    );
  }

  const finalPrice = lab.discount_price != null ? lab.discount_price : lab.price;
  const hasDiscount = lab.discount_price != null && lab.discount_price < lab.price;

  return (
    <div className="min-h-screen bg-background pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/lab-rentals" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Lab Rentals
          </Link>
          <div className="flex flex-wrap gap-3 mb-4">
            <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">
              {lab.duration_days} {lab.duration_days === 1 ? "Day" : "Days"} Access
            </span>
          </div>
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
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Clock className="h-4 w-4 text-[#23B33A]" />
              {lab.duration_days} {lab.duration_days === 1 ? "Day" : "Days"} Access
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">

            {/* Lab image */}
            {lab.image_url && (
              <motion.div
                className="rounded-2xl overflow-hidden border border-border shadow-sm"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              >
                <img src={lab.image_url} alt={lab.title} className="w-full object-cover max-h-80" />
              </motion.div>
            )}

            {/* About */}
            {lab.description && (
              <motion.div className="bg-card rounded-2xl border border-border p-8"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
                <h2 className="text-xl font-bold text-foreground mb-4">About This Lab</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{lab.description}</p>
              </motion.div>
            )}

            {/* What's included */}
            <motion.div className="bg-card rounded-2xl border border-border p-8"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
              <h2 className="text-xl font-bold text-foreground mb-5">What's Included</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  `${lab.duration_days} ${lab.duration_days === 1 ? "day" : "days"} of full lab access`,
                  "Hands-on lab environment",
                  "Real-world infrastructure setup",
                  "24/7 lab availability during rental period",
                  "Technical support",
                  "Practice with industry tools",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-[#23B33A] shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div>
            <motion.div
              className="bg-card rounded-2xl border border-border overflow-hidden sticky top-24 shadow-lg"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            >
              {/* Lab thumbnail */}
              <div className="p-4 border-b border-border bg-zinc-950">
                {lab.image_url ? (
                  <div className="w-full aspect-video rounded-xl overflow-hidden">
                    <img src={lab.image_url} alt={lab.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full aspect-video rounded-xl bg-gray-800 flex flex-col items-center justify-center gap-2">
                    <FlaskConical className="h-10 w-10 text-white/30" />
                    <span className="text-white/30 text-xs">Lab Environment</span>
                  </div>
                )}
              </div>

              {/* Pricing & CTA */}
              <div className="p-6">
                {/* Pricing */}
                <div className="mb-5">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl font-extrabold text-foreground">{formatPrice(finalPrice)}</span>
                    {hasDiscount && (
                      <span className="text-base text-muted-foreground line-through">{formatPrice(lab.price)}</span>
                    )}
                  </div>
                  {hasDiscount && (
                    <span className="inline-block text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">
                      Save {formatPrice(lab.price - finalPrice)}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/lab-rentals/${lab.id}/checkout`)}
                  className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-base mb-4"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Buy Now
                </button>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {lab.duration_days} {lab.duration_days === 1 ? "day" : "days"} of access
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-[#23B33A]" />
                    Instant access after purchase
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
