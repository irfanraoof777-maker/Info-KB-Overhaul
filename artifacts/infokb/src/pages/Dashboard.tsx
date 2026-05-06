import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-muted/30 pt-24 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-border p-8">
          <div className="mb-6">
            <span className="inline-block text-4xl mb-3">👋</span>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, {user.email}!
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              You're signed in to your InfoKB account.
            </p>
          </div>

          <div className="border-t border-border pt-6 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => navigate("/courses")}
            >
              Browse Courses
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
