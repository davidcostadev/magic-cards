import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Check, X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "./MarkdownContent";
import { calculateQuality } from "./Timer";
import { useLearningSessions } from "@/context/LearningContext";
import { cn } from "@/utils/cn";
import type { Card as CardType, Choice } from "@/mocks/types";

type Quality = 1 | 3 | 4 | 5;

interface QuizReviewProps {
  card: CardType;
  currentIndex: number;
  totalCards: number;
  dailyGoalProgress: number;
  dailyGoal: number;
  onRate: (quality: Quality) => void;
}

const TIMER_SECONDS = 30;

export function QuizReview({
  card,
  currentIndex,
  totalCards,
  dailyGoalProgress,
  dailyGoal,
  onRate,
}: QuizReviewProps) {
  const { t } = useTranslation();
  const { updateSessionInfo } = useLearningSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [eliminatedIds, setEliminatedIds] = useState<Set<string>>(new Set());
  const [usedHint, setUsedHint] = useState(false);
  const startTime = useRef(Date.now());

  const correctChoice = card.choices.find((c) => c.isCorrect);
  const isCorrect = selectedId === correctChoice?.id;

  const wrongChoices = useMemo(
    () => card.choices.filter((c) => !c.isCorrect),
    [card.choices]
  );

  const maxEliminations = Math.max(0, wrongChoices.length - 1);
  const canEliminate = !answered && !timedOut && eliminatedIds.size < maxEliminations;

  useEffect(() => {
    updateSessionInfo({
      currentCard: currentIndex + 1,
      totalCards,
      dailyGoalProgress,
      dailyGoal,
    });
  }, [currentIndex, totalCards, dailyGoalProgress, dailyGoal, updateSessionInfo]);

  useEffect(() => {
    if (answered || timedOut) {
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
        setAnswered(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [answered, timedOut, updateSessionInfo]);

  const handleEliminate = () => {
    const available = wrongChoices.filter((c) => !eliminatedIds.has(c.id));
    if (available.length <= 1) return;
    const target = available[Math.floor(Math.random() * available.length)];
    setEliminatedIds((prev) => new Set([...prev, target.id]));
    setUsedHint(true);
  };

  const handleSelect = (choice: Choice) => {
    if (answered || timedOut || eliminatedIds.has(choice.id)) return;
    setSelectedId(choice.id);
    setAnswered(true);
  };

  const handleNext = () => {
    const elapsed = (Date.now() - startTime.current) / 1000;
    const quality = calculateQuality(isCorrect && !timedOut, elapsed, usedHint, timedOut);
    setSelectedId(null);
    setAnswered(false);
    setTimedOut(false);
    setEliminatedIds(new Set());
    setUsedHint(false);
    startTime.current = Date.now();
    onRate(quality);
  };

  const getChoiceStyle = (choice: Choice) => {
    if (eliminatedIds.has(choice.id)) {
      return "border-border bg-muted line-through pointer-events-none opacity-40";
    }
    if (!answered && !timedOut) {
      return "border-border bg-secondary hover:border-primary hover:bg-accent";
    }
    if (choice.isCorrect) return "border-success bg-success text-white";
    if (choice.id === selectedId && !choice.isCorrect) return "border-destructive bg-destructive text-white";
    return "border-border bg-muted opacity-50";
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <MarkdownContent text={card.question} />

      {canEliminate && (
        <Button variant="outline" onClick={handleEliminate}>
          <Lightbulb className="mr-2 h-5 w-5" />
          {t("learn.eliminateChoice")} ({eliminatedIds.size}/{maxEliminations})
        </Button>
      )}

      <div className="space-y-3">
        {card.choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => handleSelect(choice)}
            disabled={answered || timedOut || eliminatedIds.has(choice.id)}
            className={cn(
              "flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left text-base font-semibold transition-all duration-200 active:scale-[0.98]",
              getChoiceStyle(choice),
              !answered && !timedOut && !eliminatedIds.has(choice.id) && "cursor-pointer"
            )}
          >
            {(answered || timedOut) && choice.isCorrect && (
              <Check className="h-6 w-6 shrink-0 text-white" />
            )}
            {answered && choice.id === selectedId && !choice.isCorrect && (
              <X className="h-6 w-6 shrink-0 text-white" />
            )}
            <span>{choice.text}</span>
          </button>
        ))}
      </div>

      {(answered || timedOut) && (
        <div className="space-y-3 animate-[fadeIn_200ms_ease-in]">
          {timedOut && (
            <p className="text-center text-base font-semibold text-destructive">
              {t("learn.timeUp")}
            </p>
          )}
          {(!isCorrect || timedOut) && card.answer && (
            <MarkdownContent text={card.answer} />
          )}
          <Button onClick={handleNext} className="w-full" size="lg">
            {t("learn.nextCard")}
          </Button>
        </div>
      )}
    </div>
  );
}
