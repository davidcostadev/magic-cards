import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeCard, pickTranslation } from '@/api/queries/cards';
import type { Grade } from '@/api/queries/reviews';
import { Kbd } from '@/components/common/Kbd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLearningSessions } from '@/context/LearningContext';
import { cn } from '@/utils/cn';
import { isInteractiveTarget, isTypingTarget } from '@/utils/keyboard';
import { HintReveal } from './HintReveal';
import { MarkdownContent } from './MarkdownContent';
import type { CardReviewProps } from './reviewTypes';
import { useReviewSession } from './useReviewSession';

const TIMER_SECONDS = 30;

/** Short typed answer, graded server-side (normalized: case/accent/whitespace insensitive). */
export function TypeAnswerReview({
  card,
  cardLanguage = 'all',
  currentIndex,
  totalCards,
  dailyGoalProgress,
  dailyGoal,
  onSubmit,
  onAdvance,
}: CardReviewProps) {
  const { t } = useTranslation();
  const { question } = localizeCard(card, cardLanguage);
  const { exitRequested, overlayOpen } = useLearningSessions();
  const [userAnswer, setUserAnswer] = useState('');
  const [revealedHints, setRevealedHints] = useState(0);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set when a submit fails (network / expired token / server error). The correct answer is known
  // only to the server, so on failure there is nothing to reveal — never fabricate a grade.
  const [submitError, setSubmitError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const usedHint = revealedHints > 0;
  const answered = grade !== null;
  // Explanation in the learner's card language (post-answer); falls back to the primary.
  const gradeTr = grade ? pickTranslation(grade.translations, cardLanguage) : undefined;
  const explanation = gradeTr?.answer?.trim() ? gradeTr.answer : (grade?.explanation ?? '');

  const { elapsedMs } = useReviewSession({
    currentIndex,
    totalCards,
    dailyGoalProgress,
    dailyGoal,
    seconds: TIMER_SECONDS,
    active: !answered && !submitting,
    onTimeout: () => void submitAnswer(),
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submitAnswer() {
    if (answered || submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    const result = await onSubmit({
      response: { type: 'type-answer', text: userAnswer },
      wasHintUsed: usedHint,
      timeSpentMs: Math.round(elapsedMs()),
    });
    setSubmitting(false);
    // No grade means the submission failed. Don't pretend the answer was wrong (which would hide
    // the real answer the server never sent) — flag the error and keep the input for a retry.
    if (!result) {
      setSubmitError(true);
      return;
    }
    setGrade(result);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim()) return;
    void submitAnswer();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exitRequested || overlayOpen) return;
      // Alt+H reveals a hint even while the input is focused (a bare "h" would be typed).
      if (
        e.altKey &&
        (e.code === 'KeyH' || e.key.toLowerCase() === 'h') &&
        !answered &&
        revealedHints < card.hints.length
      ) {
        e.preventDefault();
        setRevealedHints((prev) => prev + 1);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (
        answered &&
        (e.key === 'Enter' || e.key === ' ') &&
        !isInteractiveTarget(document.activeElement)
      ) {
        e.preventDefault();
        onAdvance(grade.correct);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [answered, revealedHints, card.hints.length, exitRequested, overlayOpen, grade, onAdvance]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <MarkdownContent text={question} />

      <HintReveal
        hints={card.hints}
        revealedCount={revealedHints}
        onRevealNext={() => setRevealedHints((prev) => prev + 1)}
        shortcutKey="Alt H"
      />

      {!answered ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            ref={inputRef}
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder={t('learn.typeYourAnswer')}
            className="text-lg"
            disabled={submitting}
            aria-label={t('learn.typeYourAnswer')}
          />
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={!userAnswer.trim() || submitting}
            aria-keyshortcuts="Enter"
          >
            {t('learn.checkAnswer')}
            <Kbd className="ml-2">{t('learn.keyEnter')}</Kbd>
          </Button>
          {submitError && (
            <p role="alert" className="text-center text-sm font-medium text-destructive">
              {t('learn.submitError')}
            </p>
          )}
        </form>
      ) : (
        <div className="space-y-3 animate-[fadeIn_200ms_ease-in]">
          <div
            className={cn(
              'rounded-2xl border-2 p-5 text-center',
              grade.correct
                ? 'border-success bg-success text-white'
                : 'border-destructive bg-destructive text-white'
            )}
          >
            <p className="text-sm font-medium mb-1">
              {grade.correct ? t('learn.correct') : t('learn.yourAnswer')}
            </p>
            <p className="text-xl font-bold font-mono">{userAnswer.trim() || '—'}</p>
          </div>

          {!grade.correct && (
            <div className="rounded-2xl border-2 border-success bg-success text-white p-5 text-center">
              <p className="text-sm font-medium mb-1">{t('learn.correctAnswer')}</p>
              <p className="text-xl font-bold font-mono">{grade.correctText}</p>
            </div>
          )}

          {explanation && <MarkdownContent text={explanation} />}

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
