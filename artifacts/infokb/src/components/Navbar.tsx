import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Phone, LogIn, UserPlus, LayoutDashboard, LogOut, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Courses", href: "/courses" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location, navigate] = useLocation();
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location]);

  const isHome = location === "/";
  const solidBg = scrolled || !isHome;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  // Nav link classes — active on transparent hero should be white, not blue
  function navLinkClass(active: boolean) {
    if (active && solidBg) return "text-primary bg-primary/8";
    if (active && !solidBg) return "text-white font-semibold bg-white/10";
    if (!active && solidBg) return "text-foreground/70 hover:text-foreground hover:bg-muted";
    return "text-white/90 hover:text-white hover:bg-white/10";
  }

  // Theme toggle button classes
  const themeToggleClass = solidBg
    ? "text-foreground/70 hover:text-foreground hover:bg-muted"
    : "text-white/90 hover:text-white hover:bg-white/10";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        solidBg
          ? "bg-white/95 dark:bg-card/95 backdrop-blur-md shadow-md border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img
              src="http://infokb.com/wp-content/uploads/2024/05/logo.png"
              alt="InfoKB"
              className="h-8 w-auto"
              onError={(e) => {
                const t = e.currentTarget;
                t.style.display = "none";
                const span = document.createElement("span");
                span.className = "text-xl font-bold text-primary";
                span.textContent = "infoKB";
                t.parentNode?.appendChild(span);
              }}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active =
                location === link.href ||
                (link.href !== "/" && location.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${navLinkClass(active)}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="tel:+919652429090"
              className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                solidBg
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-white/15 text-white hover:bg-white/25 border border-white/30"
              }`}
            >
              <Phone className="h-4 w-4" />
              +91-9652429090
            </a>

            {/* Dark / light mode toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className={`p-2 rounded-lg transition-colors ${themeToggleClass}`}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {!loading && (
              <>
                {user ? (
                  <div className="hidden md:flex items-center gap-2">
                    <Button
                      variant={solidBg ? "outline" : "ghost"}
                      size="sm"
                      className={!solidBg ? "text-white border-white/30 hover:bg-white/10" : ""}
                      onClick={() => navigate("/dashboard")}
                    >
                      <LayoutDashboard className="h-4 w-4 mr-1.5" />
                      Dashboard
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={!solidBg ? "text-white/90 hover:text-white hover:bg-white/10" : ""}
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-1.5" />
                      Logout
                    </Button>
                  </div>
                ) : (
                  <div className="hidden md:flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={!solidBg ? "text-white/90 hover:text-white hover:bg-white/10" : ""}
                      onClick={() => navigate("/login")}
                    >
                      <LogIn className="h-4 w-4 mr-1.5" />
                      Login
                    </Button>
                    <Button
                      size="sm"
                      className={!solidBg ? "bg-white text-primary hover:bg-white/90" : ""}
                      onClick={() => navigate("/signup")}
                    >
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      Sign Up
                    </Button>
                  </div>
                )}
              </>
            )}

            <button
              className={`md:hidden p-2 rounded-lg transition-colors ${
                solidBg
                  ? "text-foreground hover:bg-muted"
                  : "text-white hover:bg-white/10"
              }`}
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-white dark:bg-card border-b border-border overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => {
                const active =
                  location === link.href ||
                  (link.href !== "/" && location.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "text-primary bg-primary/8 font-semibold"
                        : "text-foreground/70 hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {!loading && (
                <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1">
                  {user ? (
                    <>
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-muted"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 w-full text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-muted"
                      >
                        <LogIn className="h-4 w-4" />
                        Login
                      </Link>
                      <Link
                        href="/signup"
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl text-sm font-semibold"
                      >
                        <UserPlus className="h-4 w-4" />
                        Sign Up
                      </Link>
                    </>
                  )}
                </div>
              )}

              {/* Dark mode toggle in mobile menu */}
              <button
                onClick={toggleTheme}
                className="mt-1 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-muted w-full text-left"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4 w-4" /> Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" /> Dark Mode
                  </>
                )}
              </button>

              <a
                href="tel:+919652429090"
                className="mt-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 text-primary rounded-xl text-sm font-semibold"
              >
                <Phone className="h-4 w-4" />
                Call Us: +91-9652429090
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
