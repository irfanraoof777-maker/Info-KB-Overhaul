import { Link } from "wouter";
import { Star, BookOpen, Users, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import type { Course } from "@/data/courses";

const levelColors: Record<string, string> = {
  Beginner: "bg-emerald-500 text-white",
  Intermediate: "bg-amber-500 text-white",
  Advanced: "bg-rose-500 text-white",
};

const categoryColors: Record<string, string> = {
  "Cloud": "text-blue-600",
  "DevOps": "text-violet-600",
  "AI & ML": "text-purple-600",
  "Agile": "text-pink-600",
  "Management": "text-teal-600",
  "Data & AI": "text-amber-600",
  "Database": "text-orange-600",
  "Infrastructure": "text-indigo-600",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground"}`}
        />
      ))}
      <span className="text-sm font-semibold text-foreground ml-0.5">{rating.toFixed(1)}</span>
    </div>
  );
}

interface CourseCardProps {
  course: Course;
  index?: number;
}

export default function CourseCard({ course, index = 0 }: CourseCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 border border-border flex flex-col"
    >
      {/* Hero image panel */}
      <div
        className="relative h-44 w-full overflow-hidden"
        style={{ background: course.imageGradient }}
      >
        {/* Tech pattern overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id={`grid-${course.id}`} width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#grid-${course.id})`} />
          {/* decorative circles */}
          <circle cx="320" cy="30" r="60" fill="white" fillOpacity="0.04" />
          <circle cx="60" cy="150" r="80" fill="white" fillOpacity="0.04" />
        </svg>

        {/* Floating code-like text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center opacity-20">
            <div className="font-mono text-white text-xs leading-relaxed">
              <div>$ kubectl apply -f deploy.yaml</div>
              <div>$ aws configure --profile prod</div>
              <div>$ docker build -t app:latest .</div>
              <div>$ terraform plan -out=tfplan</div>
            </div>
          </div>
        </div>

        {/* Glow accent */}
        <div
          className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full blur-2xl opacity-40"
          style={{ backgroundColor: course.imageAccent }}
        />

        {/* Badges */}
        {course.onSale && (
          <span className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm tracking-wide uppercase">
            SALE
          </span>
        )}
        <span className={`absolute top-3 right-3 text-white text-xs font-semibold px-2.5 py-1 rounded-lg shadow-sm ${levelColors[course.level]}`}>
          {course.level}
        </span>

        {/* Duration pill */}
        <span className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-lg">
          {course.duration}
        </span>
      </div>

      {/* Card body */}
      <div className="p-5 flex flex-col flex-1">
        {/* Category */}
        <span className={`text-xs font-bold uppercase tracking-widest mb-2 ${categoryColors[course.category] ?? "text-primary"}`}>
          {course.category}
        </span>

        {/* Title */}
        <h3 className="font-bold text-foreground text-base leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {course.title}
        </h3>

        {/* Description */}
        <p className="text-muted-foreground text-sm leading-relaxed mb-3 line-clamp-2 flex-1">
          {course.description}
        </p>

        {/* Instructor */}
        <p className="text-xs text-muted-foreground mb-3">
          by <span className="font-semibold text-foreground">{course.instructor}</span>
        </p>

        {/* Rating */}
        <div className="mb-4">
          <StarRating rating={course.rating} />
          <span className="text-xs text-muted-foreground mt-0.5">({course.reviewCount.toLocaleString()} reviews)</span>
        </div>

        <div className="border-t border-border pt-4">
          {/* Price row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-foreground">{formatPrice(course.price)}</span>
              {course.onSale && (
                <span className="text-sm text-muted-foreground line-through">{formatPrice(course.originalPrice)}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {course.modules}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {course.students.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href="tel:+919652429090"
              className="flex-1 py-2.5 bg-[#23B33A] hover:bg-[#1ca033] text-white text-sm font-semibold rounded-xl text-center transition-colors"
            >
              Enquire Now
            </a>
            <Link
              href={`/courses/${course.slug}`}
              className="px-3 py-2.5 border border-border hover:border-primary hover:text-primary text-muted-foreground rounded-xl transition-colors flex items-center"
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
