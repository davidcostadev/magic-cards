import { useEffect } from "react";
import { Outlet, useLocation } from "@tanstack/react-router";
import { Header } from "@/components/common/Header";
import { Sidebar } from "@/components/common/Sidebar";
import { BottomBar } from "@/components/common/BottomBar";
import { useAuth } from "@/context/AuthContext";
import { useLearningSessions } from "@/context/LearningContext";
import { cn } from "@/utils/cn";

const PUBLIC_PATHS = ["/login", "/signup"];

export function AppLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const { setInSession, inSession } = useLearningSessions();
  const isPublicPage = PUBLIC_PATHS.includes(location.pathname);
  const isOnboardingPage = location.pathname === "/onboarding";
  const showNav = isAuthenticated && !isPublicPage && !isOnboardingPage && !inSession;

  useEffect(() => {
    if (!location.pathname.startsWith("/learn")) {
      setInSession(false);
    }
  }, [location.pathname, setInSession]);

  if (isOnboardingPage) {
    return (
      <div className="min-h-dvh bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <Header />
      {showNav && <Sidebar />}
      {showNav && <BottomBar />}
      <main
        className={cn(
          "min-h-[calc(100dvh-4rem)] transition-[margin] duration-200",
          showNav && "lg:ml-72",
          showNav && "pb-20 lg:pb-0"
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
