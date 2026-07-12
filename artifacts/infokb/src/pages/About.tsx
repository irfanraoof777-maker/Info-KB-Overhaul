import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, Award, Users, BookOpen, TrendingUp, ArrowRight } from "lucide-react";

const values = [
  { icon: Award, title: "Certified Expertise", description: "Our trainers hold the very certifications they teach. No theory from textbooks — real-world knowledge from practitioners." },
  { icon: Users, title: "Small Batch Sizes", description: "We keep class sizes small so every student gets personal attention, hands-on lab time, and instructor support." },
  { icon: BookOpen, title: "Practical Learning", description: "Every course is built around hands-on labs and real-world scenarios. We don't just prepare you to pass exams — we prepare you to do the work." },
  { icon: TrendingUp, title: "Career Outcomes", description: "95% of our students report career advancement within 6 months of completing their certification training at InfoKB." },
];

interface Trainer {
  id: string;
  name: string;
  title: string;
  certs: string;
  experience: string;
  photo_url: string;
  sort_order: number;
}

const milestones = [
  { year: "2013", event: "InfoKB founded in Hyderabad with a focus on enterprise IT training" },
  { year: "2015", event: "Expanded to AWS and cloud certifications as demand surged" },
  { year: "2018", event: "Partnered with Nutanix and VMware as an authorized training center" },
  { year: "2020", event: "Launched virtual instructor-led training (VILT) to serve students nationwide" },
  { year: "2022", event: "Crossed 500+ certified professionals across 50+ companies" },
  { year: "2024", event: "Launched Generative AI and advanced ML certification programs" },
];

export default function About() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  useEffect(() => {
    document.title = "About Us | InfoKB";
    fetch("/api/trainers")
      .then((r) => r.json())
      .then((d: { trainers?: Trainer[] }) => { if (d.trainers) setTrainers(d.trainers); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f8fb] pt-20">
      {/* Hero */}
      <div className="bg-gradient-to-r from-[#003d6b] to-[#005B99] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            className="text-4xl sm:text-5xl font-extrabold text-white mb-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            About InfoKB
          </motion.h1>
          <motion.p
            className="text-white/70 text-base max-w-xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            A decade of transforming IT careers through expert training and industry-recognized certifications.
          </motion.p>
        </div>
      </div>

      {/* Mission */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-[#23B33A] font-semibold text-sm uppercase tracking-wider">Our Story</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mt-2 mb-6">
                Training IT Professionals Since 2013
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  InfoKB was founded in Hyderabad with a single mission: deliver training that actually translates to real-world skills and career advancement. We were tired of courses that taught theory without practice.
                </p>
                <p>
                  Over 10 years, we've trained professionals from some of India's largest IT companies — TCS, Infosys, Wipro, HCL, Cognizant, and hundreds of fast-growing startups. Our trainers don't just teach — they practice what they teach.
                </p>
                <p>
                  Today, InfoKB is a trusted name across cloud, DevOps, infrastructure, and emerging technology certifications. We stay ahead of the curve so our students always do too.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                {[
                  { label: "Years in Business", value: "10+" },
                  { label: "Certified Graduates", value: "500+" },
                  { label: "Corporate Clients", value: "50+" },
                  { label: "Course Success Rate", value: "95%" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#f4f8fb] rounded-xl p-4">
                    <div className="text-2xl font-extrabold text-primary">{stat.value}</div>
                    <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="bg-gradient-to-br from-[#003d6b] to-[#005B99] rounded-2xl p-8 text-white">
                <h3 className="text-lg font-bold mb-6">Our Journey</h3>
                <div className="space-y-5">
                  {milestones.map((m, i) => (
                    <div key={m.year} className="flex gap-4">
                      <div className="text-[#23B33A] font-bold text-sm shrink-0 w-10">{m.year}</div>
                      <div className="relative pl-4 border-l border-white/20">
                        <p className="text-white/70 text-sm">{m.event}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-[#f4f8fb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-[#23B33A] font-semibold text-sm uppercase tracking-wider">Why Choose Us</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mt-2">
              The InfoKB Difference
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                className="bg-card rounded-2xl border border-card-border p-7 flex gap-5"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <v.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-2">{v.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{v.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 bg-gradient-to-r from-[#005B99] to-[#0077cc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">Ready to Get Certified?</h2>
          <p className="text-white/70 mb-8">Explore our course catalog and take the next step in your IT career.</p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#23B33A] text-white font-semibold rounded-xl hover:bg-[#1ca033] transition-colors"
          >
            Browse Courses
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
