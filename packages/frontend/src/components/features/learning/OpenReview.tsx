import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeCard } from '@/api/queries/cards';
import { Kbd } from '@/components/common/Kbd';
import { Button } from '@/components/ui/button';
import { useLearningSessions } from '@/context/LearningContext';
import { isInteractiveTarget, isTypingTarget } from '@/utils/keyboard';
import { AnswerReveal } from './AnswerReveal';
import { CardPart } from './CardPart';
import { HintReveal } from './HintReveal';
import { MarkdownContent } from './MarkdownContent';
import type { CardReviewProps } from './reviewTypes';
import { calculateQuality } from './Timer';
import { useReviewSession } from './useReviewSession';

const TIMER_SECONDS = 30;

/** The original open Q&A flow: reveal → self-assess Wrong/Right (architecture §7, FRD-003). */
export function OpenReview({
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
  const { question, answer } = localizeCard(card, cardLanguage);
  const { exitRequested, overlayOpen } = useLearningSessions();
  const [revealedHints, setRevealedHints] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const usedHint = revealedHints > 0;

  const { elapsedMs } = useReviewSession({
    currentIndex,
    totalCards,
    dailyGoalProgress,
    dailyGoal,
    seconds: TIMER_SECONDS,
    active: !answerRevealed,
    onTimeout: () => {
      setTimedOut(true);
      setAnswerRevealed(true);
    },
  });

  const handleAnswer = (correct: boolean) => {
    const ms = elapsedMs();
    const quality = calculateQuality(correct, ms / 1000, usedHint, timedOut);
    void onSubmit({ quality, wasHintUsed: usedHint, timeSpentMs: Math.round(ms) });
    onAdvance(quality >= 3);
  };

  // Keyboard flow: Space/Enter reveals, H shows a hint, then 1 = wrong, 2/Enter = right.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exitRequested || overlayOpen || isTypingTarget(e.target)) return;
      const key = e.key;
      const enterOrSpace = key === 'Enter' || key === ' ';

      if (!answerRevealed) {
        if (enterOrSpace && !isInteractiveTarget(document.activeElement)) {
          e.preventDefault();
          setAnswerRevealed(true);
        } else if (key.toLowerCase() === 'h' && revealedHints < card.hints.length) {
          e.preventDefault();
          setRevealedHints((prev) => prev + 1);
        }
        return;
      }

      if (timedOut) {
        if (enterOrSpace && !isInteractiveTarget(document.activeElement)) {
          e.preventDefault();
          handleAnswer(false);
        }
        return;
      }

      if (key === '1' || key === 'ArrowLeft') {
        e.preventDefault();
        handleAnswer(false);
      } else if (
        key === '2' ||
        key === 'ArrowRight' ||
        (key === 'Enter' && !isInteractiveTarget(document.activeElement))
      ) {
        e.preventDefault();
        handleAnswer(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    answerRevealed,
    timedOut,
    revealedHints,
    card.hints.length,
    exitRequested,
    overlayOpen,
    handleAnswer,
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <CardPart part="question">
        <MarkdownContent text={question} />
      </CardPart>

      <HintReveal
        hints={card.hints}
        revealedCount={revealedHints}
        onRevealNext={() => setRevealedHints((prev) => prev + 1)}
        shortcutKey="H"
      />

      <AnswerReveal
        answer={answer}
        revealed={answerRevealed}
        onReveal={() => setAnswerRevealed(true)}
      />

      {answerRevealed && (
        <div className="space-y-3 animate-[fadeIn_200ms_ease-in]">
          {timedOut && (
            <p className="text-center text-base font-semibold text-destructive">
              {t('learn.timeUp')}
            </p>
          )}
          {timedOut ? (
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              aria-keyshortcuts="Enter"
              onClick={() => handleAnswer(false)}
            >
              {t('learn.nextCard')}
              <Kbd className="ml-2">{t('learn.keyEnter')}</Kbd>
            </Button>
          ) : (
            <div className="flex gap-4">
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                size="lg"
                aria-keyshortcuts="1"
                onClick={() => handleAnswer(false)}
              >
                <Kbd className="mr-2">1</Kbd>
                {t('learn.qualityWrong')}
              </Button>
              <Button
                className="flex-1 bg-success text-white hover:bg-success/90"
                size="lg"
                aria-keyshortcuts="2 Enter"
                onClick={() => handleAnswer(true)}
              >
                <Kbd className="mr-2">2</Kbd>
                {t('learn.qualityRight')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
