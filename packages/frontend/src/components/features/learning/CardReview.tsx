import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card as CardType } from '@/api/queries/cards';
import { Kbd } from '@/components/common/Kbd';
import { Button } from '@/components/ui/button';
import { useLearningSessions } from '@/context/LearningContext';
import { isInteractiveTarget, isTypingTarget } from '@/utils/keyboard';
import { AnswerReveal } from './AnswerReveal';
import { HintReveal } from './HintReveal';
import { MarkdownContent } from './MarkdownContent';
import { calculateQuality } from './Timer';

type Quality = 1 | 3 | 4 | 5;

export interface ReviewResult {
  quality: Quality;
  wasHintUsed: boolean;
  timeSpentMs: number;
}

interface CardReviewProps {
  card: CardType;
  currentIndex: number;
  totalCards: number;
  dailyGoalProgress: number;
  dailyGoal: number;
  onRate: (result: ReviewResult) => void;
}

const TIMER_SECONDS = 30;

export function CardReview({
  card,
  currentIndex,
  totalCards,
  dailyGoalProgress,
  dailyGoal,
  onRate,
}: CardReviewProps) {
  const { t } = useTranslation();
  const { updateSessionInfo, exitRequested } = useLearningSessions();
  const [revealedHints, setRevealedHints] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const startTime = useRef(Date.now());
  const usedHint = revealedHints > 0;

  useEffect(() => {
    updateSessionInfo({
      currentCard: currentIndex + 1,
      totalCards,
      dailyGoalProgress,
      dailyGoal,
    });
  }, [currentIndex, totalCards, dailyGoalProgress, dailyGoal, updateSessionInfo]);

  useEffect(() => {
    if (answerRevealed) {
      updateSessionInfo({ timerSeconds: 0 });
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      const left = Math.max(0, TIMER_SECONDS - elapsed);
      updateSessionInfo({ timerSeconds: left });

      if (left <= 0) {
        clearInterval(interval);
        setTimedOut(true);
        setAnswerRevealed(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [answerRevealed, updateSessionInfo]);

  const handleAnswer = (correct: boolean) => {
    const elapsedMs = Date.now() - startTime.current;
    const quality = calculateQuality(correct, elapsedMs / 1000, usedHint, timedOut);
    setRevealedHints(0);
    setAnswerRevealed(false);
    setTimedOut(false);
    startTime.current = Date.now();
    onRate({ quality, wasHintUsed: usedHint, timeSpentMs: Math.round(elapsedMs) });
  };

  // Keyboard flow: Space/Enter reveals, H shows a hint, then 1 = wrong, 2/Enter = right.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exitRequested || isTypingTarget(e.target)) return;
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
  }, [answerRevealed, timedOut, revealedHints, card.hints.length, exitRequested, handleAnswer]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <MarkdownContent text={card.question} />

      <HintReveal
        hints={card.hints}
        revealedCount={revealedHints}
        onRevealNext={() => setRevealedHints((prev) => prev + 1)}
        shortcutKey="H"
      />

      <AnswerReveal
        answer={card.answer}
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
