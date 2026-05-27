import { Outlet, useLocation } from "@tanstack/react-router";
import { Header } from "@/components/common/Header";
import { Sidebar } from "@/components/common/Sidebar";
import { BottomBar } from "@/components/common/BottomBar";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/utils/cn";

const PUBLIC_PATHS = ["/login", "/signup"];

export function AppLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isPublicPage = PUBLIC_PATHS.includes(location.pathname);
  const showNav = isAuthenticated && !isPublicPage;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {showNav && <Sidebar />}
      {showNav && <BottomBar />}
      <main
        className={cn(
          "min-h-[calc(100vh-4rem)] transition-[margin] duration-200",
          showNav && "lg:ml-72",
          showNav && "pb-20 lg:pb-0"
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
