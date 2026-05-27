import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, BookOpen, GraduationCap, Settings } from "lucide-react";
import { cn } from "@/utils/cn";
import { useLearningSessions } from "@/context/LearningContext";

const navItems = [
  { path: "/dashboard" as const, icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { path: "/subjects" as const, icon: BookOpen, labelKey: "nav.subjects" },
  { path: "/learn" as const, icon: GraduationCap, labelKey: "nav.learn" },
  { path: "/settings" as const, icon: Settings, labelKey: "nav.settings" },
];

export function BottomBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { inSession } = useLearningSessions();

  if (inSession) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
      <div className="flex h-16 items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {navItems.map(({ path, icon: Icon, labelKey }) => {
          const isActive = location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-6 w-6", isActive && "scale-110")} />
              <span>{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
