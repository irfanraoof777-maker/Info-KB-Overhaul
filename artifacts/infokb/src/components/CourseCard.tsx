import { Link } from "wouter";
import { Clock, BarChart2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import type { Course } from "@/data/courses";

const categoryColors: Record<string, string> = {
  "Cloud": "bg-blue-50 text-blue-700 border-blue-100",
  "DevOps": "bg-purple-50 text-purple-700 border-purple-100",
  "AI & ML": "bg-green-50 text-green-700 border-green-100",
  "Agile": "bg-orange-50 text-orange-700 border-orange-100",
  "Management": "bg-yellow-50 text-yellow-700 border-yellow-100",
  "Data & AI": "bg-teal-50 text-teal-700 border-teal-100",
  "Database": "bg-red-50 text-red-700 border-red-100",
  "Infrastructure": "bg-indigo-50 text-indigo-700 border-indigo-100",
};

const levelColors: Record<string, string> = {
  Beginner: "text-green-600",
  Intermediate: "text-blue-600",
  Advanced: "text-orange-600",
};

interface CourseCardProps {
  course: Course;
  index?: number;
}

export default function CourseCard({ course, index = 0 }: CourseCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group bg-card border border-card-border rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col"
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-[#005B99] to-[#23B33A]" />

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-3 gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryColors[course.category] ?? "bg-muted text-muted-foreground border-border"}`}
          >
            {course.category}
          </span>
          <span className={`text-xs font-semibold ${levelColors[course.level]}`}>
            {course.level}
          </span>
        </div>

        <h3 className="font-bold text-foreground text-base leading-snug mb-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>

        <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-1">
          {course.description}
        </p>

        <div className="flex items-center gap-4 mb-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#23B33A]" />
            <span>{course.duration}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BarChart2 className="h-3.5 w-3.5 text-[#005B99]" />
            <span>{course.level}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href="tel:+919652429090"
            className="flex-1 py-2.5 bg-[#23B33A] hover:bg-[#1ca033] text-white text-sm font-semibold rounded-xl text-center transition-colors"
          >
            Enquire Now
          </a>
          <Link
            href={`/courses/${course.slug}`}
            className="px-4 py-2.5 border border-border hover:border-primary hover:text-primary text-sm font-medium rounded-xl flex items-center gap-1 text-muted-foreground transition-colors"
          >
            Details
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
