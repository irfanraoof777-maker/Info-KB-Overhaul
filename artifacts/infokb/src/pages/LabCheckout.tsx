import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Tag, ShoppingCart, CheckCircle, Loader2, MessageCircle } from "lucide-react";
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
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
}

export default function LabCheckout() {
  const params = useParams<{ id: string }>();

  const [lab, setLab] = useState<Lab | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        if (!supabase) { setNotFound(true); return; }
        const { data, error } = await supabase
          .from("labs")
          .select("*")
          .eq("id", params.id)
          .eq("enabled", true)
          .single();
        if (error || !data) { setNotFound(true); return; }
        setLab(data as Lab);
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
    if (lab) document.title = `Checkout — ${lab.title} | InfoKB`;
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
  const waMessage = `Hi, I'd like to purchase the lab: ${lab.title} (${lab.duration_days} ${lab.duration_days === 1 ? "Day" : "Days"} Access) for ${formatPrice(finalPrice)}.`;

  return (
    <div className="min-h-screen bg-background pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href={`/lab-rentals/${lab.id}`} className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Lab Details
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Checkout</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Order summary */}
          <motion.div
            className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          >
            {/* Lab image */}
            {lab.image_url && (
              <div className="w-full h-40 overflow-hidden">
                <img src={lab.image_url} alt={lab.title} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Order Summary</p>
              <h2 className="text-lg font-bold text-foreground mb-4 leading-snug">{lab.title}</h2>

              <div className="space-y-3 text-sm">
                {/* Duration */}
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Duration
                  </span>
                  <span className="font-medium text-foreground">
                    {lab.duration_days} {lab.duration_days === 1 ? "Day" : "Days"} Access
                  </span>
                </div>

                {/* Original price */}
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Tag className="h-4 w-4" />
                    Original Price
                  </span>
                  <span className={`font-medium ${hasDiscount ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {formatPrice(lab.price)}
                  </span>
                </div>

                {/* Discount price */}
                {hasDiscount && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="flex items-center gap-2 text-[#23B33A] font-medium">
                      <Tag className="h-4 w-4" />
                      Discount Price
                    </span>
                    <span className="font-medium text-[#23B33A]">{formatPrice(lab.discount_price!)}</span>
                  </div>
                )}

                {/* Final price */}
                <div className="flex items-center justify-between pt-3">
                  <span className="font-bold text-foreground text-base">Final Price</span>
                  <span className="font-extrabold text-foreground text-xl">{formatPrice(finalPrice)}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CTA panel */}
          <motion.div
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-5">
              <div>
                <p className="text-base font-bold text-foreground mb-1">Ready to get started?</p>
                <p className="text-sm text-muted-foreground">
                  Click the button below to contact us on WhatsApp and we'll set up your lab access right away.
                </p>
              </div>

              <a
                href={`https://wa.me/919652429090?text=${encodeURIComponent(waMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 bg-[#23B33A] hover:bg-[#1ca033] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
              >
                <MessageCircle className="h-5 w-5" />
                Buy Now via WhatsApp
              </a>

              <a
                href={`tel:+919652429090`}
                className="w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <ShoppingCart className="h-4 w-4" />
                Call to Purchase: +91-9652429090
              </a>
            </div>

            {/* Trust signals */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">What you get</p>
              <ul className="space-y-2">
                {[
                  `${lab.duration_days} ${lab.duration_days === 1 ? "day" : "days"} of full lab access`,
                  "Instant access after payment confirmation",
                  "Hands-on real-world environment",
                  "24/7 support during lab period",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle className="h-4 w-4 text-[#23B33A] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
