import { Check, Lightbulb, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Grade } from '@/api/queries/reviews';
import { Kbd } from '@/components/common/Kbd';
import { Button } from '@/components/ui/button';
import { useLearningSessions } from '@/context/LearningContext';
import { cn } from '@/utils/cn';
import { isInteractiveTarget, isTypingTarget } from '@/utils/keyboard';
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
  onEliminate,
}: CardReviewProps) {
  const { t } = useTranslation();
  const { exitRequested, overlayOpen } = useLearningSessions();
  const choices = useMemo(() => shuffle(card.choices ?? []), [card.choices]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The quiz "hint" eliminates wrong choices instead of showing text — each H disables one more,
  // down to two (the answer plus one decoy). Which choice is wrong is decided server-side.
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
  const [eliminating, setEliminating] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set when a submit fails (network / expired token / server error). We never fabricate a grade
  // in that case — the correct choice is known only to the server, so there is nothing to reveal.
  const [submitError, setSubmitError] = useState(false);
  const usedHint = eliminatedIds.length > 0;
  const answered = grade !== null;
  // Always leave two choices standing, so the most you can remove is everything-but-two.
  const maxEliminations = Math.max(0, choices.length - 2);
  const canEliminate =
    !answered && !!onEliminate && !eliminating && eliminatedIds.length < maxEliminations;

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
    setSubmitError(false);
    setSelectedId(choiceId || null);
    const result = await onSubmit({
      response: { type: 'quiz', choiceId },
      wasHintUsed: usedHint,
      timeSpentMs: Math.round(elapsedMs()),
    });
    setSubmitting(false);
    // No grade means the submission failed. Don't pretend the learner was wrong (which would hide
    // the answer the server never sent) — flag the error and leave the card answerable to retry.
    if (!result) {
      setSelectedId(null);
      setSubmitError(true);
      return;
    }
    setGrade(result);
  }

  // Hint: have the server grey out one more wrong choice (it knows which are wrong; the payload
  // never tells the client). Counts as a used hint, so SM-2 caps this card's quality.
  async function eliminate() {
    if (!onEliminate || !canEliminate) return;
    setEliminating(true);
    const id = await onEliminate(eliminatedIds);
    if (id) setEliminatedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setEliminating(false);
  }

  // Keyboard: 1–9 picks a choice (eliminated ones are skipped); H eliminates a wrong choice;
  // Enter reveals the answer (gives up) while unanswered, then advances once answered.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exitRequested || overlayOpen || isTypingTarget(e.target)) return;
      const key = e.key;
      if (answered) {
        if ((key === 'Enter' || key === ' ') && !isInteractiveTarget(document.activeElement)) {
          e.preventDefault();
          onAdvance(grade.correct);
        }
        return;
      }
      if (submitting) return;
      if (key.toLowerCase() === 'h' && canEliminate) {
        e.preventDefault();
        void eliminate();
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
        if (choice && !eliminatedIds.includes(choice.id)) {
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
    overlayOpen,
    onAdvance,
    canEliminate,
    eliminatedIds,
  ]);

  const choiceStyle = (id: string) => {
    if (!answered) {
      if (eliminatedIds.includes(id))
        return 'border-border bg-muted opacity-40 line-through cursor-not-allowed';
      return 'border-border bg-secondary hover:border-primary hover:bg-accent cursor-pointer';
    }
    if (id === grade.correctChoiceId) return 'border-success bg-success text-white';
    if (id === selectedId) return 'border-destructive bg-destructive text-white';
    return 'border-border bg-muted opacity-50';
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <MarkdownContent text={card.question} />

      {/* Keep the hint button mounted for the whole unanswered phase and toggle `disabled`
          instead of unmounting it: unmounting while the request is in flight (or once every
          hint is spent) shifted the choices up and down under the cursor. */}
      {!answered && !!onEliminate && maxEliminations > 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void eliminate()}
          disabled={!canEliminate}
          aria-keyshortcuts="H"
        >
          <Lightbulb className="mr-2 h-5 w-5" />
          {t('learn.eliminateChoice')} ({Math.min(eliminatedIds.length + 1, maxEliminations)}/
          {maxEliminations})<Kbd className="ml-2">H</Kbd>
        </Button>
      )}

      <div className="space-y-3">
        {choices.map((choice, index) => {
          const showCorrect = answered && choice.id === grade.correctChoiceId;
          const showWrong =
            answered && choice.id === selectedId && choice.id !== grade.correctChoiceId;
          const eliminated = !answered && eliminatedIds.includes(choice.id);
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => void submitChoice(choice.id)}
              disabled={answered || submitting || eliminated}
              aria-keyshortcuts={!answered && !eliminated ? String(index + 1) : undefined}
              className={cn(
                'flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left text-base font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:active:scale-100 disabled:cursor-not-allowed',
                choiceStyle(choice.id)
              )}
            >
              {showCorrect ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                  <Check className="h-6 w-6" />
                </span>
              ) : showWrong || eliminated ? (
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

      {submitError && !answered && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {t('learn.submitError')}
        </p>
      )}

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
