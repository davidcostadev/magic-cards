import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Grade } from '@/api/queries/reviews';
import { Kbd } from '@/components/common/Kbd';
import { Button } from '@/components/ui/button';
import { useLearningSessions } from '@/context/LearningContext';
import { cn } from '@/utils/cn';
import { isInteractiveTarget, isTypingTarget } from '@/utils/keyboard';
import { MarkdownContent } from './MarkdownContent';
import type { CardReviewProps } from './reviewTypes';
import { useReviewSession } from './useReviewSession';

const TIMER_SECONDS = 60;

/** Associate left↔right pairs, then submit once; graded all-or-nothing on the server. */
export function MatchReview({
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
  const lefts = card.matchItems?.lefts ?? [];
  const rights = card.matchItems?.rights ?? [];

  // left → right assignment chosen by the learner.
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const answered = grade !== null;
  const allAssigned = lefts.length > 0 && lefts.every((l) => assignments[l]);

  // After grading, the correct right for each left (to colour tiles green/red).
  const correctRight = (left: string) => grade?.correctPairs?.find((p) => p.left === left)?.right;

  const { elapsedMs } = useReviewSession({
    currentIndex,
    totalCards,
    dailyGoalProgress,
    dailyGoal,
    seconds: TIMER_SECONDS,
    active: !answered && !submitting,
    onTimeout: () => void submit(),
  });

  async function submit() {
    if (answered || submitting) return;
    setSubmitting(true);
    const pairs = lefts
      .filter((l) => assignments[l])
      .map((l) => ({ left: l, right: assignments[l] }));
    const result = await onSubmit({
      response: { type: 'match', pairs },
      wasHintUsed: false,
      timeSpentMs: Math.round(elapsedMs()),
    });
    setGrade(result ?? { correct: false, explanation: '' });
    setSubmitting(false);
  }

  // Keyboard shortcuts: left items use numbers (1–9), right items use letters (A, B, C…).
  const leftKey = (i: number) => (i < 9 ? String(i + 1) : null);
  const rightKey = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : null);

  const rightOwner = (right: string) =>
    Object.keys(assignments).find((l) => assignments[l] === right) ?? null;

  const pickLeft = (left: string) => {
    if (answered) return;
    setSelectedLeft((prev) => (prev === left ? null : left));
  };

  const pickRight = (right: string) => {
    if (answered || !selectedLeft) return;
    setAssignments((prev) => {
      const next = { ...prev };
      // a right can map to only one left — release any prior owner.
      const owner = Object.keys(next).find((l) => next[l] === right);
      if (owner) delete next[owner];
      next[selectedLeft] = right;
      return next;
    });
    setSelectedLeft(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exitRequested || isTypingTarget(e.target)) return;

      // Enter/Space advances when graded, or submits once everything is paired.
      if (e.key === 'Enter' || e.key === ' ') {
        if (isInteractiveTarget(document.activeElement)) return;
        if (answered) {
          e.preventDefault();
          onAdvance(grade.correct);
        } else if (allAssigned && !submitting) {
          e.preventDefault();
          void submit();
        }
        return;
      }
      if (answered || submitting) return;

      // A number picks a left item; a letter assigns a right to the selected left.
      if (/^[1-9]$/.test(e.key)) {
        const left = lefts[Number(e.key) - 1];
        if (left) {
          e.preventDefault();
          pickLeft(left);
        }
        return;
      }
      const letter = e.key.toLowerCase();
      if (/^[a-z]$/.test(letter) && selectedLeft) {
        const right = rights[letter.charCodeAt(0) - 97];
        if (right) {
          e.preventDefault();
          pickRight(right);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    answered,
    allAssigned,
    submitting,
    grade,
    exitRequested,
    onAdvance,
    selectedLeft,
    lefts,
    rights,
  ]);

  const matchedCount = lefts.filter((l) => assignments[l]).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <MarkdownContent text={card.question} />

      {!answered && (
        <p className="text-sm text-muted-foreground">
          {matchedCount}/{lefts.length} {t('learn.matchPairsFound')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2.5">
          {lefts.map((left, index) => {
            const assigned = assignments[left];
            const key = leftKey(index);
            return (
              <button
                key={left}
                type="button"
                onClick={() => pickLeft(left)}
                disabled={answered}
                aria-pressed={selectedLeft === left}
                aria-keyshortcuts={!answered && key ? key : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left text-sm font-semibold transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:active:scale-100 disabled:cursor-not-allowed',
                  answered
                    ? assigned === correctRight(left)
                      ? 'border-success bg-success text-white'
                      : 'border-destructive bg-destructive text-white'
                    : selectedLeft === left
                      ? 'border-primary bg-primary text-primary-foreground cursor-pointer'
                      : 'border-border bg-secondary hover:border-primary cursor-pointer'
                )}
              >
                {!answered && key && (
                  <span aria-hidden="true">
                    <Kbd className="h-7 w-7 shrink-0 text-xs">{key}</Kbd>
                  </span>
                )}
                <span className="flex flex-col items-start gap-0.5">
                  <span>{left}</span>
                  {assigned && <span className="text-xs font-normal opacity-80">→ {assigned}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2.5">
          {rights.map((right, index) => {
            const used = rightOwner(right) !== null;
            const key = rightKey(index);
            return (
              <button
                key={right}
                type="button"
                onClick={() => pickRight(right)}
                disabled={answered || !selectedLeft}
                aria-keyshortcuts={!answered && key ? key : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left text-sm font-semibold transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:active:scale-100 disabled:cursor-not-allowed',
                  used ? 'border-primary/40 bg-accent opacity-60' : 'border-border bg-secondary',
                  !answered && selectedLeft ? 'hover:border-primary cursor-pointer' : ''
                )}
              >
                {!answered && key && (
                  <span aria-hidden="true">
                    <Kbd className="h-7 w-7 shrink-0 text-xs">{key}</Kbd>
                  </span>
                )}
                <span>{right}</span>
              </button>
            );
          })}
        </div>
      </div>

      {answered ? (
        <div className="space-y-3 animate-[fadeIn_200ms_ease-in]">
          <p
            className={cn(
              'text-center text-base font-semibold',
              grade.correct ? 'text-success' : 'text-destructive'
            )}
          >
            {grade.correct ? t('learn.allMatched') : t('learn.incorrect')}
          </p>
          {!grade.correct && grade.correctPairs && (
            <div className="rounded-2xl border-2 border-success/40 bg-success/10 p-4 space-y-1">
              <p className="text-sm font-medium">{t('learn.correctAnswer')}</p>
              {grade.correctPairs.map((p) => (
                <p key={p.left} className="text-sm">
                  <span className="font-semibold">{p.left}</span> → {p.right}
                </p>
              ))}
            </div>
          )}
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
      ) : (
        <Button
          onClick={() => void submit()}
          className="w-full"
          size="lg"
          disabled={!allAssigned || submitting}
          aria-keyshortcuts="Enter"
        >
          {t('learn.checkAnswer')}
          <Kbd className="ml-2">{t('learn.keyEnter')}</Kbd>
        </Button>
      )}
    </div>
  );
}
