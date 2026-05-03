import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { Clock, BarChart2, CheckCircle, ArrowLeft, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { courses } from "@/data/courses";

export default function CourseDetail() {
  const params = useParams<{ slug: string }>();
  const course = courses.find((c) => c.slug === params.slug);
  const [openModule, setOpenModule] = useState<number | null>(0);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (course) document.title = `${course.title} | InfoKB`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [course]);

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-20 text-center px-4">
        <h1 className="text-2xl font-bold text-foreground mb-4">Course Not Found</h1>
        <p className="text-muted-foreground mb-6">The course you're looking for doesn't exist.</p>
        <Link href="/courses" className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors">
          Browse All Courses
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const relatedCourses = courses.filter((c) => c.category === course.category && c.id !== course.id).slice(0, 3);

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
            <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">{course.category}</span>
            <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">{course.level}</span>
          </div>
          <motion.h1
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 max-w-3xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {course.title}
          </motion.h1>
          <p className="text-white/70 text-base max-w-2xl mb-6">{course.description}</p>
          <div className="flex flex-wrap gap-5">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Clock className="h-4 w-4 text-[#23B33A]" />
              {course.duration}
            </div>
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <BarChart2 className="h-4 w-4 text-[#23B33A]" />
              {course.level} Level
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            <motion.div
              className="bg-white rounded-2xl border border-card-border p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="text-xl font-bold text-foreground mb-4">About This Course</h2>
              <p className="text-muted-foreground leading-relaxed">{course.longDescription}</p>
            </motion.div>

            {/* Highlights */}
            <motion.div
              className="bg-white rounded-2xl border border-card-border p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <h2 className="text-xl font-bold text-foreground mb-5">What You'll Learn</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {course.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-[#23B33A] shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{h}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Curriculum */}
            <motion.div
              className="bg-white rounded-2xl border border-card-border p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <h2 className="text-xl font-bold text-foreground mb-5">Course Curriculum</h2>
              <div className="space-y-3">
                {course.curriculum.map((mod, i) => (
                  <div key={i} className="border border-border rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => setOpenModule(openModule === i ? null : i)}
                    >
                      <span className="font-semibold text-foreground text-sm">{mod.module}</span>
                      {openModule === i ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {openModule === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-border px-5 py-4"
                      >
                        <ul className="space-y-2">
                          {mod.topics.map((topic) => (
                            <li key={topic} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              {topic}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Who is it for */}
            <motion.div
              className="bg-white rounded-2xl border border-card-border p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <h2 className="text-xl font-bold text-foreground mb-5">Who Is This For</h2>
              <div className="flex flex-wrap gap-2">
                {course.whoIsItFor.map((w) => (
                  <span key={w} className="px-3 py-1.5 bg-primary/8 text-primary rounded-full text-sm font-medium">
                    {w}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Enquiry form */}
            <motion.div
              className="bg-white rounded-2xl border border-card-border p-6 sticky top-24"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <h3 className="font-bold text-foreground text-lg mb-5">Enquire About This Course</h3>
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-[#23B33A] mx-auto mb-4" />
                  <p className="font-semibold text-foreground mb-2">Thank you!</p>
                  <p className="text-muted-foreground text-sm">Our team will reach out to you within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      placeholder="you@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      placeholder="+91 ..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Message (optional)</label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                      placeholder="Any questions..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#23B33A] hover:bg-[#1ca033] text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    Submit Enquiry
                  </button>
                  <a
                    href="tel:+919652429090"
                    className="flex items-center justify-center gap-2 w-full py-3 border border-primary text-primary font-semibold rounded-xl hover:bg-primary/5 transition-colors text-sm"
                  >
                    <Phone className="h-4 w-4" />
                    Call +91-9652429090
                  </a>
                </form>
              )}
            </motion.div>

            {/* Related courses */}
            {relatedCourses.length > 0 && (
              <div>
                <h4 className="font-bold text-foreground text-sm mb-3">Related Courses</h4>
                <div className="space-y-3">
                  {relatedCourses.map((rc) => (
                    <Link
                      key={rc.id}
                      href={`/courses/${rc.slug}`}
                      className="block bg-white rounded-xl border border-card-border p-4 hover:border-primary hover:shadow-sm transition-all"
                    >
                      <div className="font-semibold text-sm text-foreground mb-1">{rc.title}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{rc.duration}</span>
                        <span>{rc.level}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
