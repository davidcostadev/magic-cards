import { Outlet, useLocation } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';
import { BottomBar } from '@/components/common/BottomBar';
import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/common/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { useLearningSessions } from '@/context/LearningContext';
import { cn } from '@/utils/cn';

const PUBLIC_PATHS = ['/login', '/signup'];

function PageFallback() {
  return <div className="min-h-[60vh]" role="status" aria-label="Loading" />;
}

export function AppLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const { setInSession, inSession } = useLearningSessions();
  const isPublicPage = PUBLIC_PATHS.includes(location.pathname);
  const isOnboardingPage = location.pathname === '/onboarding';
  const showNav = isAuthenticated && !isPublicPage && !isOnboardingPage && !inSession;

  useEffect(() => {
    if (!location.pathname.startsWith('/learn')) {
      setInSession(false);
    }
  }, [location.pathname, setInSession]);

  if (isOnboardingPage) {
    return (
      <div className="min-h-dvh bg-background">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
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
          'min-h-[calc(100dvh-4rem)] transition-[margin] duration-200',
          showNav && 'lg:ml-72',
          showNav && 'pb-20 lg:pb-0'
        )}
      >
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
