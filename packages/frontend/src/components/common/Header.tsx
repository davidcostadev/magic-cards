import { Link, useNavigate } from '@tanstack/react-router';
import { LogOut, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useLearningSessions } from '@/context/LearningContext';
import { cn } from '@/utils/cn';
import { LanguageSelector } from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const { inSession, requestExit, sessionInfo } = useLearningSessions();

  const handleLogout = () => {
    logout();
    navigate({ to: '/login' });
  };

  const timerColor =
    sessionInfo.timerSeconds <= 5
      ? 'text-destructive'
      : sessionInfo.timerSeconds <= 10
        ? 'text-warning'
        : 'text-muted-foreground';

  return (
    <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-5">
        {inSession ? (
          <>
            <div className="flex items-center gap-4">
              <span className="text-base font-bold">
                {t('learn.progress', {
                  current: sessionInfo.currentCard,
                  total: sessionInfo.totalCards,
                })}
              </span>
              <span className="text-sm text-muted-foreground hidden sm:block">
                {t('learn.dailyGoalProgress')}:{' '}
                {Math.min(sessionInfo.dailyGoalProgress, sessionInfo.dailyGoal)}/
                {sessionInfo.dailyGoal}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('text-lg font-mono font-bold tabular-nums', timerColor)}>
                {Math.ceil(sessionInfo.timerSeconds)}s
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={requestExit}
                aria-label={t('learn.exitShortcut')}
                aria-keyshortcuts="Escape"
                title={t('learn.exitShortcut')}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="flex items-center gap-2.5"
            >
              <Sparkles className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold">{t('common.appName')}</span>
            </Link>
            <div className="flex items-center gap-1.5">
              <LanguageSelector />
              <ThemeToggle />
              {isAuthenticated && (
                <Button
                  variant="outlinePrimary"
                  size="icon"
                  onClick={handleLogout}
                  aria-label={t('nav.logout')}
                  title={t('nav.logout')}
                >
                  <LogOut className="h-6 w-6" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
