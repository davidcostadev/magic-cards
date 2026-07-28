import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCardStats } from '@/api/queries/cards';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';

interface CardStatsPanelProps {
  cardId: string;
  /** `panel` is the full chip grid; `inline` is a one-line summary for dense lists (card tiles). */
  variant?: 'panel' | 'inline';
  className?: string;
}

/** Milliseconds → a short human duration ("1.4s" / "820ms"); em dash when there's nothing yet. */
function formatMs(ms: number): string {
  if (ms <= 0) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

/** The SM-2 starting ease factor — shown as a reference anchor (e.g. "2.18 / 2.5"). */
const EASE_FACTOR_START = 2.5;

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md bg-muted/60 px-2 py-1">
      <span className="font-semibold text-foreground/80">{value}</span>
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
    </span>
  );
}

/**
 * "Nerd stats": the current user's own performance on a card — never the answer. Self-gates on the
 * user's `nerdStats` preference (and only fetches when it's on), so callers just drop it in. Card
 * difficulty is per-user: these counts and the SM-2 ease factor are yours alone, unaffected by how
 * anyone else does on the same card.
 */
export function CardStatsPanel({ cardId, variant = 'panel', className }: CardStatsPanelProps) {
  const { t } = useTranslation();
  const nerdStats = useAuth().user?.nerdStats ?? false;
  const { data, isLoading } = useCardStats(cardId, nerdStats);

  if (!nerdStats || isLoading || !data) return null;

  if (variant === 'inline') {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        {data.totalReviews === 0
          ? t('cardStats.noData')
          : t('cardStats.inlineSummary', { accuracy: data.accuracy, count: data.totalReviews })}
      </p>
    );
  }

  return (
    <section
      className={cn(
        'rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground',
        className
      )}
      aria-label={t('cardStats.title')}
    >
      <h4 className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] font-semibold uppercase tracking-wide">
        <span aria-hidden>🤓</span>
        {t('cardStats.title')}
        {/* The card id is the handle you need to find this card in the catalog API or the
            content JSON, so it shows even for a card with no review history yet. */}
        <span className="sr-only">{t('cardStats.cardId')}</span>
        <code
          title={cardId}
          className="select-all rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-foreground/70"
        >
          {cardId}
        </code>
      </h4>
      {data.totalReviews === 0 ? (
        <p>{t('cardStats.noData')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Stat label={t('cardStats.correct')} value={data.correctCount} />
          <Stat label={t('cardStats.incorrect')} value={data.incorrectCount} />
          <Stat label={t('cardStats.accuracy')} value={`${data.accuracy}%`} />
          <Stat label={t('cardStats.avgTime')} value={formatMs(data.avgTimeMs)} />
          <Stat label={t('cardStats.hinted')} value={data.hintedCount} />
          <Stat
            label={t('cardStats.ease')}
            value={
              data.easeFactor != null ? `${data.easeFactor.toFixed(2)} / ${EASE_FACTOR_START}` : '—'
            }
          />
          <Stat
            label={t('cardStats.interval')}
            value={data.interval != null ? `${data.interval}d` : '—'}
          />
          <Stat label={t('cardStats.repetitions')} value={data.repetitions ?? '—'} />
          <Stat
            label={t('cardStats.status')}
            value={data.status ? t(`dashboard.${data.status}`) : '—'}
          />
          <Stat label={t('cardStats.nextReview')} value={formatDate(data.nextReviewDate)} />
        </div>
      )}
    </section>
  );
}
