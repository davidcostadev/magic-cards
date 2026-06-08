import { CheckCircle2, Flag, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Card as CardType } from '@/api/queries/cards';
import { CardStatsPanel } from '@/components/features/learning/CardStatsPanel';
import { LanguageBadge } from '@/components/features/subjects/LanguageBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface CardListProps {
  cards: CardType[];
  /** Open the read-only view modal (works for shared/public content too). */
  onView: (card: CardType) => void;
  onEdit: (card: CardType) => void;
  onDelete: (id: string) => void;
  /** Hide edit/delete affordances (e.g. for shared/public content). */
  readOnly?: boolean;
  /** Ids of cards the current user has reported — shown with a flag badge. */
  reportedIds?: Set<string>;
  /** Subset of reported ids whose report has been resolved — shown with a "resolved" badge instead. */
  resolvedIds?: Set<string>;
}

const TYPE_LABEL_KEY: Record<CardType['type'], string> = {
  open: 'cards.typeOpen',
  quiz: 'cards.typeQuiz',
  'type-answer': 'cards.typeTypeAnswer',
  match: 'cards.typeMatch',
};

export function CardList({
  cards,
  onView,
  onEdit,
  onDelete,
  readOnly,
  reportedIds,
  resolvedIds,
}: CardListProps) {
  const { t } = useTranslation();

  if (cards.length === 0) {
    return <p className="py-10 text-center text-lg text-muted-foreground">{t('cards.noCards')}</p>;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {cards.map((card) => {
        const title = card.question.split('\n')[0].replace(/[#`*]/g, '');
        // Every language the card is available in: its primary plus any translations present.
        const cardLangs = [
          card.language,
          ...Object.entries(card.translations ?? {})
            .filter(([code, value]) => value && code !== card.language)
            .map(([code]) => code),
        ];
        return (
          <Card
            key={card.id}
            className="group relative transition-colors hover:border-primary/50 hover:bg-accent/30 focus-within:border-primary/50"
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                    {card.type !== 'open' && (
                      <Badge variant="secondary" className="shrink-0">
                        {t(TYPE_LABEL_KEY[card.type])}
                      </Badge>
                    )}
                    {reportedIds?.has(card.id) &&
                      (resolvedIds?.has(card.id) ? (
                        <Badge
                          variant="secondary"
                          className="shrink-0 gap-1 border border-success/30 bg-success/10 text-success"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t('reports.resolvedBadge')}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="shrink-0 gap-1 border border-destructive/30 bg-destructive/10 text-destructive"
                        >
                          <Flag className="h-3 w-3" />
                          {t('reports.reportedBadge')}
                        </Badge>
                      ))}
                    {cardLangs.map((l) => (
                      <LanguageBadge key={l} language={l} className="shrink-0" />
                    ))}
                    <p className="w-full text-base font-semibold line-clamp-2 sm:w-auto">{title}</p>
                  </div>
                  {card.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {card.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {card.hints.length > 0 && (
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {t('cards.hintCount', { count: card.hints.length })}
                    </p>
                  )}
                  {/* Opt-in "nerd stats": self-hides unless the preference is on. */}
                  <CardStatsPanel cardId={card.id} variant="inline" className="mt-1.5" />
                </div>
                {!readOnly && (
                  // Raised above the stretched overlay so the actions stay clickable.
                  <div className="relative z-10 flex shrink-0 gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('common.edit')}
                      className="h-10 w-10"
                      onClick={() => onEdit(card)}
                    >
                      <Pencil className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('common.delete')}
                      className="h-10 w-10 text-destructive"
                      onClick={() => onDelete(card.id)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>
              {/* Stretched overlay — a real (empty) button so it stays valid HTML and
                  keyboard-accessible; the raised action buttons sit above it. */}
              <button
                type="button"
                onClick={() => onView(card)}
                aria-label={`${t('cards.preview')}: ${title}`}
                className="absolute inset-0 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
