import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface WeakCard {
  id: string;
  question: string;
  easeFactor: number;
  subjectTitle: string;
}

interface WeakCardsWidgetProps {
  cards: WeakCard[];
}

export function WeakCardsWidget({ cards }: WeakCardsWidgetProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-lg">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          {t('dashboard.weakCards')}
        </CardTitle>
        <CardDescription>{t('dashboard.weakCardsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <p className="text-base text-muted-foreground">{t('dashboard.noWeakCards')}</p>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => (
              <div key={card.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-base">
                  <span className="truncate font-medium">
                    {card.question.split('\n')[0].replace(/[#`*]/g, '').slice(0, 50)}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {card.easeFactor.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Progress
                    value={((card.easeFactor - 1.3) / (2.5 - 1.3)) * 100}
                    className="h-2.5"
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {card.subjectTitle}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
