import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { HintReveal } from "./HintReveal";
import { AnswerReveal } from "./AnswerReveal";
import { MarkdownContent } from "./MarkdownContent";
import { calculateQuality } from "./Timer";
import { useLearningSessions } from "@/context/LearningContext";
import type { Card as CardType } from "@/mocks/types";

type Quality = 1 | 3 | 4 | 5;

interface CardReviewProps {
  card: CardType;
  currentIndex: number;
  totalCards: number;
  dailyGoalProgress: number;
  dailyGoal: number;
  onRate: (quality: Quality) => void;
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
  const { updateSessionInfo } = useLearningSessions();
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
    const elapsed = (Date.now() - startTime.current) / 1000;
    const quality = calculateQuality(correct, elapsed, usedHint, timedOut);
    setRevealedHints(0);
    setAnswerRevealed(false);
    setTimedOut(false);
    startTime.current = Date.now();
    onRate(quality);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <MarkdownContent text={card.question} />

      <HintReveal
        hints={card.hints}
        revealedCount={revealedHints}
        onRevealNext={() => setRevealedHints((prev) => prev + 1)}
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
              {t("learn.timeUp")}
            </p>
          )}
          {timedOut ? (
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => handleAnswer(false)}
            >
              {t("learn.nextCard")}
            </Button>
          ) : (
            <div className="flex gap-4">
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                size="lg"
                onClick={() => handleAnswer(false)}
              >
                {t("learn.qualityWrong")}
              </Button>
              <Button
                className="flex-1 bg-success text-white hover:bg-success/90"
                size="lg"
                onClick={() => handleAnswer(true)}
              >
                {t("learn.qualityRight")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
