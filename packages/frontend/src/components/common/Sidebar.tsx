import { Link, useLocation } from '@tanstack/react-router';
import { BookOpen, GraduationCap, LayoutDashboard, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLearningSessions } from '@/context/LearningContext';
import { cn } from '@/utils/cn';

const navItems = [
  { path: '/dashboard' as const, icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/subjects' as const, icon: BookOpen, labelKey: 'nav.subjects' },
  { path: '/learn' as const, icon: GraduationCap, labelKey: 'nav.learn' },
  { path: '/settings' as const, icon: Settings, labelKey: 'nav.settings' },
];

export function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const { inSession } = useLearningSessions();

  if (inSession) return null;

  return (
    <aside className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-72 border-r bg-background lg:block">
      <nav className="space-y-1.5 px-4 py-4">
        {navItems.map(({ path, icon: Icon, labelKey }) => {
          const isActive = location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3.5 rounded-xl px-4 py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-6 w-6" />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
