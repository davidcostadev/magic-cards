import { Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StreakWidgetProps {
  streakDays: number;
}

export function StreakWidget({ streakDays }: StreakWidgetProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-lg">
          <Flame className="h-6 w-6 text-warning" />
          {t('dashboard.streak')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold">{t('dashboard.streakDays', { count: streakDays })}</p>
      </CardContent>
    </Card>
  );
}
