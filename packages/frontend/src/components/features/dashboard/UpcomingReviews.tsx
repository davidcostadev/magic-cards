import { Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UpcomingReviewsProps {
  today: number;
  tomorrow: number;
  thisWeek: number;
}

export function UpcomingReviews({ today, tomorrow, thisWeek }: UpcomingReviewsProps) {
  const { t } = useTranslation();

  const items = [
    { label: t('dashboard.today'), count: today },
    { label: t('dashboard.tomorrow'), count: tomorrow },
    { label: t('dashboard.thisWeek'), count: thisWeek },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-lg">
          <Calendar className="h-6 w-6 text-primary" />
          {t('dashboard.upcomingReviews')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-5 text-center">
          {items.map(({ label, count }) => (
            <div key={label}>
              <p className="text-3xl font-bold">{count}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
