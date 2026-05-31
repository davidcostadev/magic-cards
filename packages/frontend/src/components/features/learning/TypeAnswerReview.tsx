import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/common/Kbd";
import { MarkdownContent } from "./MarkdownContent";
import { HintReveal } from "./HintReveal";
import { calculateQuality } from "./Timer";
import { useLearningSessions } from "@/context/LearningContext";
import { isInteractiveTarget, isTypingTarget } from "@/utils/keyboard";
import { cn } from "@/utils/cn";
import type { Card as CardType } from "@/mocks/types";

type Quality = 1 | 3 | 4 | 5;

interface TypeAnswerReviewProps {
  card: CardType;
  currentIndex: number;
  totalCards: number;
  dailyGoalProgress: number;
  dailyGoal: number;
  onRate: (quality: Quality) => void;
}

const TIMER_SECONDS = 30;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?'"()]/g, "");
}

export function TypeAnswerReview({
  card,
  currentIndex,
  totalCards,
  dailyGoalProgress,
  dailyGoal,
  onRate,
}: TypeAnswerReviewProps) {
  const { t } = useTranslation();
  const { updateSessionInfo, exitRequested } = useLearningSessions();
  const [userAnswer, setUserAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const startTime = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const usedHint = revealedHints > 0;

  const isCorrect = submitted && normalize(userAnswer) === normalize(card.shortAnswer);

  useEffect(() => {
    updateSessionInfo({
      currentCard: currentIndex + 1,
      totalCards,
      dailyGoalProgress,
      dailyGoal,
    });
  }, [currentIndex, totalCards, dailyGoalProgress, dailyGoal, updateSessionInfo]);

  useEffect(() => {
    if (submitted || timedOut) {
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
        setSubmitted(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [submitted, timedOut, updateSessionInfo]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim()) return;
    setSubmitted(true);
  };

  const handleNext = () => {
    const elapsed = (Date.now() - startTime.current) / 1000;
    const correct = !timedOut && normalize(userAnswer) === normalize(card.shortAnswer);
    const quality = calculateQuality(correct, elapsed, usedHint, timedOut);
    setUserAnswer("");
    setSubmitted(false);
    setTimedOut(false);
    setRevealedHints(0);
    startTime.current = Date.now();
    onRate(quality);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exitRequested) return;

      // Alt+H reveals a hint even while the input is focused — a bare "h" would
      // just be typed into the answer. e.code stays "KeyH" regardless of layout
      // (on macOS, Option+H changes e.key to a dead-key char).
      if (
        e.altKey &&
        (e.code === "KeyH" || e.key.toLowerCase() === "h") &&
        !submitted &&
        revealedHints < card.hints.length
      ) {
        e.preventDefault();
        setRevealedHints((prev) => prev + 1);
        return;
      }

      if (isTypingTarget(e.target)) return;

      // Once the answer is checked the input is gone, so Enter/Space advances.
      if (submitted && (e.key === "Enter" || e.key === " ") && !isInteractiveTarget(document.activeElement)) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitted, revealedHints, card.hints.length, exitRequested, handleNext]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <MarkdownContent text={card.question} />

      <HintReveal
        hints={card.hints}
        revealedCount={revealedHints}
        onRevealNext={() => setRevealedHints((prev) => prev + 1)}
        shortcutKey="Alt H"
      />

      {!submitted ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            ref={inputRef}
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder={t("learn.typeYourAnswer")}
            className="text-lg"
            disabled={timedOut}
          />
          <Button type="submit" className="w-full" size="lg" disabled={!userAnswer.trim()} aria-keyshortcuts="Enter">
            {t("learn.checkAnswer")}
            <Kbd className="ml-2">{t("learn.keyEnter")}</Kbd>
          </Button>
        </form>
      ) : (
        <div className="space-y-3 animate-[fadeIn_200ms_ease-in]">
          {timedOut && (
            <p className="text-center text-base font-semibold text-destructive">
              {t("learn.timeUp")}
            </p>
          )}

          <div className={cn(
            "rounded-2xl border-2 p-5 text-center",
            isCorrect
              ? "border-success bg-success text-white"
              : "border-destructive bg-destructive text-white"
          )}>
            <p className="text-sm font-medium mb-1">
              {isCorrect ? t("learn.correct") : t("learn.yourAnswer")}
            </p>
            <p className="text-xl font-bold font-mono">
              {timedOut && !userAnswer.trim() ? "—" : userAnswer}
            </p>
          </div>

          {!isCorrect && (
            <div className="rounded-2xl border-2 border-success bg-success text-white p-5 text-center">
              <p className="text-sm font-medium mb-1">{t("learn.correctAnswer")}</p>
              <p className="text-xl font-bold font-mono">{card.shortAnswer}</p>
            </div>
          )}

          <Button onClick={handleNext} className="w-full" size="lg" aria-keyshortcuts="Enter">
            {t("learn.nextCard")}
            <Kbd className="ml-2">{t("learn.keyEnter")}</Kbd>
          </Button>
        </div>
      )}
    </div>
  );
}
