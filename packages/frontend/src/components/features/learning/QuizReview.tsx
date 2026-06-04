import { Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Grade } from '@/api/queries/reviews';
import { Kbd } from '@/components/common/Kbd';
import { Button } from '@/components/ui/button';
import { useLearningSessions } from '@/context/LearningContext';
import { cn } from '@/utils/cn';
import { isInteractiveTarget, isTypingTarget } from '@/utils/keyboard';
import { HintReveal } from './HintReveal';
import { InlineMarkdown } from './InlineMarkdown';
import { MarkdownContent } from './MarkdownContent';
import type { CardReviewProps } from './reviewTypes';
import { useReviewSession } from './useReviewSession';

const TIMER_SECONDS = 30;

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Multiple-choice: picking a choice submits it; the server returns which choice was correct. */
export function QuizReview({
  card,
  currentIndex,
  totalCards,
  dailyGoalProgress,
  dailyGoal,
  onSubmit,
  onAdvance,
}: CardReviewProps) {
  const { t } = useTranslation();
  const { exitRequested } = useLearningSessions();
  const choices = useMemo(() => shuffle(card.choices ?? []), [card.choices]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealedHints, setRevealedHints] = useState(0);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const usedHint = revealedHints > 0;
  const answered = grade !== null;

  const { elapsedMs } = useReviewSession({
    currentIndex,
    totalCards,
    dailyGoalProgress,
    dailyGoal,
    seconds: TIMER_SECONDS,
    active: !answered && !submitting,
    onTimeout: () => void submitChoice(''),
  });

  async function submitChoice(choiceId: string) {
    if (answered || submitting) return;
    setSubmitting(true);
    setSelectedId(choiceId || null);
    const result = await onSubmit({
      response: { type: 'quiz', choiceId },
      wasHintUsed: usedHint,
      timeSpentMs: Math.round(elapsedMs()),
    });
    setGrade(result ?? { correct: false, explanation: '' });
    setSubmitting(false);
  }

  // Keyboard: 1–9 picks a choice; H reveals the next hint; Enter reveals the answer (gives up)
  // while unanswered, then advances once answered.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exitRequested || isTypingTarget(e.target)) return;
      const key = e.key;
      if (answered) {
        if ((key === 'Enter' || key === ' ') && !isInteractiveTarget(document.activeElement)) {
          e.preventDefault();
          onAdvance(grade.correct);
        }
        return;
      }
      if (submitting) return;
      if (key.toLowerCase() === 'h' && revealedHints < card.hints.length) {
        e.preventDefault();
        setRevealedHints((prev) => prev + 1);
        return;
      }
      // Enter (when no choice is focused) gives up the card: reveal the answer without a pick,
      // graded as not-correct — so "I don't know" never rides on a lucky guess.
      if (key === 'Enter' && !isInteractiveTarget(document.activeElement)) {
        e.preventDefault();
        void submitChoice('');
        return;
      }
      if (/^[1-9]$/.test(key)) {
        const choice = choices[Number(key) - 1];
        if (choice) {
          e.preventDefault();
          void submitChoice(choice.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    answered,
    submitting,
    choices,
    grade,
    exitRequested,
    onAdvance,
    revealedHints,
    card.hints.length,
  ]);

  const choiceStyle = (id: string) => {
    if (!answered)
      return 'border-border bg-secondary hover:border-primary hover:bg-accent cursor-pointer';
    if (id === grade.correctChoiceId) return 'border-success bg-success text-white';
    if (id === selectedId) return 'border-destructive bg-destructive text-white';
    return 'border-border bg-muted opacity-50';
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <MarkdownContent text={card.question} />

      {!answered && (
        <HintReveal
          hints={card.hints}
          revealedCount={revealedHints}
          onRevealNext={() => setRevealedHints((prev) => prev + 1)}
          shortcutKey="H"
        />
      )}

      <div className="space-y-3">
        {choices.map((choice, index) => {
          const showCorrect = answered && choice.id === grade.correctChoiceId;
          const showWrong =
            answered && choice.id === selectedId && choice.id !== grade.correctChoiceId;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => void submitChoice(choice.id)}
              disabled={answered || submitting}
              aria-keyshortcuts={!answered ? String(index + 1) : undefined}
              className={cn(
                'flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left text-base font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:active:scale-100 disabled:cursor-not-allowed',
                choiceStyle(choice.id)
              )}
            >
              {showCorrect ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                  <Check className="h-6 w-6" />
                </span>
              ) : showWrong ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                  <X className="h-6 w-6" />
                </span>
              ) : (
                <Kbd className="h-8 w-8 shrink-0 text-sm">{index + 1}</Kbd>
              )}
              <InlineMarkdown text={choice.text} />
            </button>
          );
        })}
      </div>

      {!answered && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => void submitChoice('')}
          disabled={submitting}
          className="w-full text-muted-foreground"
          aria-keyshortcuts="Enter"
        >
          {t('learn.revealAnswer')}
          <Kbd className="ml-2">{t('learn.keyEnter')}</Kbd>
        </Button>
      )}

      {answered && (
        <div className="space-y-3 animate-[fadeIn_200ms_ease-in]">
          <p
            className={cn(
              'text-center text-base font-semibold',
              grade.correct ? 'text-success' : 'text-destructive'
            )}
          >
            {grade.correct ? t('learn.correct') : t('learn.incorrect')}
          </p>
          {grade.explanation && <MarkdownContent text={grade.explanation} />}
          <Button
            onClick={() => onAdvance(grade.correct)}
            className="w-full"
            size="lg"
            aria-keyshortcuts="Enter"
          >
            {t('learn.nextCard')}
            <Kbd className="ml-2">{t('learn.keyEnter')}</Kbd>
          </Button>
        </div>
      )}
    </div>
  );
}
