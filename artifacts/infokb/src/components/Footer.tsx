import { Link } from "wouter";
import { Phone, Mail, MapPin, Linkedin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#001f3d] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-1">
            <img
              src="/logo.png"
              alt="InfoKB"
              className="h-10 w-auto mb-4 brightness-0 invert"
            />
            <p className="text-white/60 text-sm leading-relaxed mb-5">
              10+ years of delivering world-class IT training and certifications. Your career growth is our mission.
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.linkedin.com/company/infokb/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-5 text-white/90 uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { label: "Home", href: "/" },
                { label: "Courses", href: "/courses" },
                { label: "About Us", href: "/about" },
                { label: "Contact", href: "/contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-5 text-white/90 uppercase tracking-wider">Top Courses</h4>
            <ul className="space-y-3">
              {[
                { label: "Generative AI", href: "/courses/generative-ai" },
                { label: "AWS Solution Architect", href: "/courses/aws-solution-architect-associate" },
                { label: "Docker & Kubernetes", href: "/courses/docker-kubernetes" },
                { label: "DevOps via Azure", href: "/courses/devops-via-microsoft-azure" },
                { label: "Data Science", href: "/courses/data-science" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-5 text-white/90 uppercase tracking-wider">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="h-4 w-4 mt-0.5 text-[#23B33A] shrink-0" />
                <a href="tel:+919652429090" className="text-white/60 hover:text-white text-sm transition-colors">
                  +91-9652429090
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-0.5 text-[#23B33A] shrink-0" />
                <a href="mailto:info@infokb.com" className="text-white/60 hover:text-white text-sm transition-colors">
                  info@infokb.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 text-[#23B33A] shrink-0" />
                <span className="text-white/60 text-sm">Hyderabad, Telangana, India</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/40 text-sm">
            &copy; {new Date().getFullYear()} InfoKB. All rights reserved.
          </p>
          <p className="text-white/40 text-sm">
            10+ Years of Training Excellence
          </p>
        </div>
      </div>
    </footer>
  );
}
