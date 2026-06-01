import { Link } from '@tanstack/react-router';
import { GraduationCap, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDashboardStats, useUpcoming, useWeakCards } from '@/api/queries/dashboard';
import { StatsCard } from '@/components/features/dashboard/StatsCard';
import { StreakWidget } from '@/components/features/dashboard/StreakWidget';
import { UpcomingReviews } from '@/components/features/dashboard/UpcomingReviews';
import { WeakCardsWidget } from '@/components/features/dashboard/WeakCardsWidget';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: stats } = useDashboardStats();
  const { data: weakCards = [] } = useWeakCards(5);
  const { data: upcoming } = useUpcoming();

  const dailyGoal = stats?.dailyGoal ?? user?.dailyGoal ?? 20;
  const reviewedToday = stats?.reviewedToday ?? 0;
  const statusCounts = stats?.cardsByStatus ?? { new: 0, learning: 0, reviewing: 0, mastered: 0 };

  return (
    <div className="p-5 md:p-7 space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {t('dashboard.greeting', { name: user?.username ?? '' })}
          </h1>
        </div>
        <Link to="/learn" className={cn(buttonVariants(), 'hidden sm:inline-flex')}>
          <GraduationCap className="mr-2 h-5 w-5" />
          {t('dashboard.startStudying')}
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('dashboard.dailyGoal')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-base">
            <span className="text-muted-foreground">
              {t('dashboard.cardsReviewed', { count: reviewedToday, goal: dailyGoal })}
            </span>
            <span className="font-semibold">{Math.round((reviewedToday / dailyGoal) * 100)}%</span>
          </div>
          <Progress value={reviewedToday} max={dailyGoal} />
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StreakWidget streakDays={stats?.streak ?? 0} />
        <StatsCard
          icon={<Target className="h-6 w-6" />}
          label={t('dashboard.accuracy')}
          value={`${stats?.accuracy7d ?? 0}%`}
          subtext={`${t('dashboard.accuracy7d')} · ${stats?.accuracy30d ?? 0}% ${t('dashboard.accuracy30d')}`}
        />
        <UpcomingReviews
          today={upcoming?.today ?? 0}
          tomorrow={upcoming?.tomorrow ?? 0}
          thisWeek={upcoming?.thisWeek ?? 0}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('dashboard.cardsByStatus')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {(
              [
                { key: 'new' as const, label: t('dashboard.new'), color: 'bg-blue-500' },
                { key: 'learning' as const, label: t('dashboard.learning'), color: 'bg-warning' },
                { key: 'reviewing' as const, label: t('dashboard.reviewing'), color: 'bg-primary' },
                { key: 'mastered' as const, label: t('dashboard.mastered'), color: 'bg-success' },
              ] as const
            ).map(({ key, label, color }) => (
              <div key={key} className="text-center">
                <div className={`mx-auto mb-2.5 h-3 w-16 rounded-full ${color}`} />
                <p className="text-3xl font-bold">{statusCounts[key]}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <WeakCardsWidget cards={weakCards} />

      <Link
        to="/learn"
        className={cn(
          buttonVariants({ size: 'sm' }),
          'fixed bottom-20 right-5 z-40 shadow-lg sm:hidden'
        )}
      >
        <GraduationCap className="mr-2 h-5 w-5" />
        {t('dashboard.startStudying')}
      </Link>
    </div>
  );
}
