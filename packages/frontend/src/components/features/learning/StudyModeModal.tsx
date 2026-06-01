import { BookOpen, Keyboard, Layers, Link2, ListChecks, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardType, CardTypeCounts } from '@/api/queries/reviews';
import { Kbd } from '@/components/common/Kbd';
import { cn } from '@/utils/cn';
import { isTypingTarget } from '@/utils/keyboard';

/** What the learner chose to study: every type, or one specific card type. */
export type StudyMode = 'all' | CardType;

interface StudyModeOption {
  mode: StudyMode;
  icon: LucideIcon;
  labelKey: string;
  count: number;
  bgColor: string;
  cardBg: string;
  borderColor: string;
}

interface StudyModeModalProps {
  /** Per-type counts (`byType` from the counts endpoint). */
  counts: CardTypeCounts['byType'];
  total: number;
  onSelect: (mode: StudyMode) => void;
}

/**
 * The "How do you want to study?" screen shown when entering a learning session before a
 * mode is chosen. Pick all cards or narrow to a single type; empty types are disabled.
 * Press 1–5 to choose without the mouse.
 */
export function StudyModeModal({ counts, total, onSelect }: StudyModeModalProps) {
  const { t } = useTranslation();
  const firstEnabledRef = useRef<HTMLButtonElement>(null);

  const options: StudyModeOption[] = [
    {
      mode: 'open',
      icon: BookOpen,
      labelKey: 'learn.modeFlashcards',
      count: counts.open,
      bgColor: 'bg-blue-500',
      cardBg: 'bg-blue-500/15 hover:bg-blue-500/25',
      borderColor: 'border-blue-500/30 hover:border-blue-500',
    },
    {
      mode: 'quiz',
      icon: ListChecks,
      labelKey: 'learn.modeQuizzes',
      count: counts.quiz,
      bgColor: 'bg-purple-500',
      cardBg: 'bg-purple-500/15 hover:bg-purple-500/25',
      borderColor: 'border-purple-500/30 hover:border-purple-500',
    },
    {
      mode: 'type-answer',
      icon: Keyboard,
      labelKey: 'learn.modeTypeAnswer',
      count: counts['type-answer'],
      bgColor: 'bg-emerald-500',
      cardBg: 'bg-emerald-500/15 hover:bg-emerald-500/25',
      borderColor: 'border-emerald-500/30 hover:border-emerald-500',
    },
    {
      mode: 'match',
      icon: Link2,
      labelKey: 'learn.modeMatch',
      count: counts.match,
      bgColor: 'bg-amber-500',
      cardBg: 'bg-amber-500/15 hover:bg-amber-500/25',
      borderColor: 'border-amber-500/30 hover:border-amber-500',
    },
    {
      mode: 'all',
      icon: Layers,
      labelKey: 'learn.modeAll',
      count: total,
      bgColor: 'bg-primary',
      cardBg: 'bg-primary/15 hover:bg-primary/25',
      borderColor: 'border-primary/30 hover:border-primary',
    },
  ];

  // Press 1–5 to pick a study mode without reaching for the mouse.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = options[Number(e.key) - 1];
      if (target && target.count > 0) {
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

  const firstEnabledIndex = options.findIndex((o) => o.count > 0);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <h2 className="mb-2 text-center text-3xl font-bold">{t('learn.chooseMode')}</h2>
      <p className="mb-6 text-center text-lg text-muted-foreground">
        {t('learn.modeCardCount', { count: total })}
      </p>

      <div className="grid w-full max-w-md gap-4">
        {options.map(
          ({ mode, icon: Icon, labelKey, count, bgColor, cardBg, borderColor }, index) => (
            <button
              type="button"
              key={mode}
              ref={index === firstEnabledIndex ? firstEnabledRef : undefined}
              onClick={() => onSelect(mode)}
              disabled={count === 0}
              aria-keyshortcuts={count > 0 ? String(index + 1) : undefined}
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
                  {mode === 'all' ? t('learn.modeAll', { count }) : t(labelKey)}
                </span>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t('learn.modeCardCount', { count })}
                </p>
              </div>
              {count > 0 && <Kbd className="text-foreground/70">{index + 1}</Kbd>}
            </button>
          )
        )}
      </div>
    </div>
  );
}
