import {
  BookOpen,
  Keyboard,
  Layers,
  Link2,
  ListChecks,
  type LucideIcon,
  Target,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardType, CardTypeCounts } from '@/api/queries/reviews';
import { Kbd } from '@/components/common/Kbd';
import { cn } from '@/utils/cn';
import { isTypingTarget } from '@/utils/keyboard';

/** What the learner chose to study: every type, one specific card type, or their past mistakes. */
export type StudyMode = 'all' | 'mistakes' | CardType;

interface StudyModeOption {
  mode: StudyMode;
  icon: LucideIcon;
  labelKey: string;
  /** Cards of this type studyable right now (new or overdue). */
  due: number;
  /** Every card of this type in the pool — what review-ahead can draw from. */
  pool: number;
  bgColor: string;
  cardBg: string;
  borderColor: string;
}

interface StudyModeModalProps {
  /** Per-type counts studyable right now (`byType` from the counts endpoint). */
  counts: CardTypeCounts['byType'];
  total: number;
  /** Per-type counts of the entire pool (`reviewableByType`), regardless of schedule. */
  reviewable: CardTypeCounts['reviewableByType'];
  reviewableTotal: number;
  /** Distinct non-mastered cards the learner has gotten wrong — the "practice mistakes" tile. */
  mistakes: number;
  onSelect: (mode: StudyMode) => void;
}

/**
 * The "How do you want to study?" screen shown when entering a learning session before a
 * mode is chosen. Each mode shows a "due / total" fraction: how many are studyable now out of
 * the whole pool. A mode is only disabled when its pool is empty — when nothing is due but
 * cards exist, it stays enabled as a review-ahead session. Press 1–6 to choose without the mouse.
 */
export function StudyModeModal({
  counts,
  total,
  reviewable,
  reviewableTotal,
  mistakes,
  onSelect,
}: StudyModeModalProps) {
  const { t } = useTranslation();
  const firstEnabledRef = useRef<HTMLButtonElement>(null);

  const options: StudyModeOption[] = [
    {
      mode: 'open',
      icon: BookOpen,
      labelKey: 'learn.modeFlashcards',
      due: counts.open,
      pool: reviewable.open,
      bgColor: 'bg-blue-500',
      cardBg: 'bg-blue-500/15 hover:bg-blue-500/25',
      borderColor: 'border-blue-500/30 hover:border-blue-500',
    },
    {
      mode: 'quiz',
      icon: ListChecks,
      labelKey: 'learn.modeQuizzes',
      due: counts.quiz,
      pool: reviewable.quiz,
      bgColor: 'bg-purple-500',
      cardBg: 'bg-purple-500/15 hover:bg-purple-500/25',
      borderColor: 'border-purple-500/30 hover:border-purple-500',
    },
    {
      mode: 'type-answer',
      icon: Keyboard,
      labelKey: 'learn.modeTypeAnswer',
      due: counts['type-answer'],
      pool: reviewable['type-answer'],
      bgColor: 'bg-emerald-500',
      cardBg: 'bg-emerald-500/15 hover:bg-emerald-500/25',
      borderColor: 'border-emerald-500/30 hover:border-emerald-500',
    },
    {
      mode: 'match',
      icon: Link2,
      labelKey: 'learn.modeMatch',
      due: counts.match,
      pool: reviewable.match,
      bgColor: 'bg-amber-500',
      cardBg: 'bg-amber-500/15 hover:bg-amber-500/25',
      borderColor: 'border-amber-500/30 hover:border-amber-500',
    },
    {
      mode: 'all',
      icon: Layers,
      labelKey: 'learn.modeAll',
      due: total,
      pool: reviewableTotal,
      bgColor: 'bg-primary',
      cardBg: 'bg-primary/15 hover:bg-primary/25',
      borderColor: 'border-primary/30 hover:border-primary',
    },
    {
      mode: 'mistakes',
      icon: Target,
      labelKey: 'learn.modeMistakes',
      // Always studyable now (it ignores the schedule), so due and pool are the same count.
      due: mistakes,
      pool: mistakes,
      bgColor: 'bg-rose-500',
      cardBg: 'bg-rose-500/15 hover:bg-rose-500/25',
      borderColor: 'border-rose-500/30 hover:border-rose-500',
    },
  ];

  // Press 1–6 to pick a study mode without reaching for the mouse.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = options[Number(e.key) - 1];
      if (target && target.pool > 0) {
        e.preventDefault();
        onSelect(target.mode);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Move focus to the first available mode so keyboard users land inside the list.
  useEffect(() => {
    firstEnabledRef.current?.focus();
  }, []);

  const firstEnabledIndex = options.findIndex((o) => o.pool > 0);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <h2 className="mb-2 text-center text-3xl font-bold">{t('learn.chooseMode')}</h2>
      <p className="mb-6 text-center text-lg text-muted-foreground">
        {t('learn.modeCardCount', { count: reviewableTotal })}
      </p>

      <div className="grid w-full max-w-md gap-4">
        {options.map(
          ({ mode, icon: Icon, labelKey, due, pool, bgColor, cardBg, borderColor }, index) => (
            <button
              type="button"
              key={mode}
              ref={index === firstEnabledIndex ? firstEnabledRef : undefined}
              onClick={() => onSelect(mode)}
              disabled={pool === 0}
              aria-keyshortcuts={pool > 0 ? String(index + 1) : undefined}
              className={cn(
                'flex cursor-pointer items-center gap-5 rounded-2xl border-2 p-6 text-left transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
                cardBg,
                borderColor
              )}
            >
              <div
                className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white',
                  bgColor
                )}
              >
                <Icon className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <span className="text-lg font-bold">
                  {mode === 'all' ? t('learn.modeAll', { count: pool }) : t(labelKey)}
                </span>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {mode === 'mistakes' ? (
                    // Mistakes are always studyable, so a "due / total" fraction would be redundant
                    // (N / N) — show just how many there are to drill.
                    <span className="font-medium text-rose-500">
                      {t('learn.mistakesToPractice', { count: due })}
                    </span>
                  ) : (
                    <>
                      <span className="font-semibold tabular-nums text-foreground/80">
                        {due} / {pool}
                      </span>
                      {' · '}
                      {due > 0 ? (
                        <span>{t('learn.modeToReview', { count: due })}</span>
                      ) : (
                        <span className="font-medium text-primary/80">
                          {t('learn.reviewAhead')}
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
              {pool > 0 && <Kbd className="text-foreground/70">{index + 1}</Kbd>}
            </button>
          )
        )}
      </div>
    </div>
  );
}
