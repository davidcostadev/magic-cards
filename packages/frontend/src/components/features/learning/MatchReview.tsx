import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/common/Kbd";
import { useLearningSessions } from "@/context/LearningContext";
import { isInteractiveTarget, isTypingTarget } from "@/utils/keyboard";
import { cn } from "@/utils/cn";
import type { Card as CardType } from "@/mocks/types";

type Quality = 1 | 3 | 4 | 5;

// Left column uses number keys, right column uses the QWER row above them.
const RIGHT_KEYS = ["q", "w", "e", "r"];

interface MatchReviewProps {
  card: CardType;
  currentIndex: number;
  totalCards: number;
  dailyGoalProgress: number;
  dailyGoal: number;
  onRate: (quality: Quality) => void;
}

const VISIBLE_COUNT = 4;
const TIMER_SECONDS = 60;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function MatchReview({
  card,
  currentIndex,
  totalCards,
  dailyGoalProgress,
  dailyGoal,
  onRate,
}: MatchReviewProps) {
  const { t } = useTranslation();
  const { updateSessionInfo, exitRequested } = useLearningSessions();
  const startTime = useRef(Date.now());

  const allPairs = useMemo(() => shuffle(card.matchPairs), [card.matchPairs]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<{ left: string; right: string } | null>(null);
  const [correctFlash, setCorrectFlash] = useState<{ left: string; right: string } | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [timedOut, setTimedOut] = useState(false);
  const [completed, setCompleted] = useState(false);

  const visiblePairs = useMemo(() => {
    const unmatched = allPairs.filter((p) => !matchedPairs.has(p.left));
    return unmatched.slice(0, VISIBLE_COUNT);
  }, [allPairs, matchedPairs]);

  const shuffledRights = useMemo(
    () => shuffle(visiblePairs.map((p) => p.right)),
    [visiblePairs]
  );

  useEffect(() => {
    updateSessionInfo({
      currentCard: currentIndex + 1,
      totalCards,
      dailyGoalProgress,
      dailyGoal,
    });
  }, [currentIndex, totalCards, dailyGoalProgress, dailyGoal, updateSessionInfo]);

  useEffect(() => {
    if (completed || timedOut) {
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
        setCompleted(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [completed, timedOut, updateSessionInfo]);

  const tryMatch = useCallback((left: string, right: string) => {
    const pair = allPairs.find((p) => p.left === left);
    if (pair && pair.right === right) {
      setCorrectFlash({ left, right });
      setTimeout(() => {
        setMatchedPairs((prev) => new Set([...prev, left]));
        setCorrectFlash(null);
        setSelectedLeft(null);
        setSelectedRight(null);
        const newCount = matchedCount + 1;
        setMatchedCount(newCount);
        if (newCount >= allPairs.length) {
          setCompleted(true);
        }
      }, 400);
    } else {
      setErrorCount((prev) => prev + 1);
      setWrongFlash({ left, right });
      setTimeout(() => {
        setWrongFlash(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 600);
    }
  }, [allPairs, matchedCount]);

  const handleLeftClick = (left: string) => {
    if (wrongFlash || correctFlash || completed || timedOut) return;
    setSelectedLeft(left);
    if (selectedRight) {
      tryMatch(left, selectedRight);
    }
  };

  const handleRightClick = (right: string) => {
    if (wrongFlash || correctFlash || completed || timedOut) return;
    setSelectedRight(right);
    if (selectedLeft) {
      tryMatch(selectedLeft, right);
    }
  };

  const handleNext = () => {
    const elapsed = (Date.now() - startTime.current) / 1000;
    let quality: Quality;
    if (timedOut) {
      quality = 1;
    } else if (errorCount > 0) {
      if (elapsed < 30) quality = 3;
      else quality = 3;
    } else {
      if (elapsed < 30) quality = 5;
      else if (elapsed < 45) quality = 4;
      else quality = 3;
    }
    onRate(quality);
  };

  // Keyboard flow: 1-4 selects a left term, Q/W/E/R selects a right term; a
  // left+right pair auto-attempts the match. Enter advances when finished.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exitRequested || isTypingTarget(e.target)) return;
      const key = e.key;

      if (completed || timedOut) {
        if ((key === "Enter" || key === " ") && !isInteractiveTarget(document.activeElement)) {
          e.preventDefault();
          handleNext();
        }
        return;
      }

      if (wrongFlash || correctFlash) return;

      if (/^[1-4]$/.test(key)) {
        const pair = visiblePairs[Number(key) - 1];
        if (pair) {
          e.preventDefault();
          handleLeftClick(pair.left);
        }
        return;
      }

      const rightIndex = RIGHT_KEYS.indexOf(key.toLowerCase());
      if (rightIndex >= 0 && rightIndex < shuffledRights.length) {
        e.preventDefault();
        handleRightClick(shuffledRights[rightIndex]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completed, timedOut, wrongFlash, correctFlash, visiblePairs, shuffledRights, exitRequested, handleLeftClick, handleRightClick, handleNext]);

  const getLeftStyle = (left: string) => {
    if (correctFlash?.left === left) return "border-success bg-success text-white scale-95";
    if (wrongFlash?.left === left) return "border-destructive bg-destructive text-white animate-[shake_300ms_ease-in-out]";
    if (selectedLeft === left) return "border-primary bg-primary text-primary-foreground";
    return "border-border bg-secondary hover:border-primary";
  };

  const getRightStyle = (right: string) => {
    if (correctFlash?.right === right) return "border-success bg-success text-white scale-95";
    if (wrongFlash?.right === right) return "border-destructive bg-destructive text-white animate-[shake_300ms_ease-in-out]";
    if (selectedRight === right) return "border-primary bg-primary text-primary-foreground";
    return "border-border bg-secondary hover:border-primary";
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h2 className="text-xl font-bold">{card.question}</h2>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{matchedCount}/{allPairs.length} {t("learn.matchPairsFound")}</span>
        {errorCount > 0 && (
          <span className="text-destructive">{t("learn.errorCount", { count: errorCount })}</span>
        )}
      </div>

      {!completed ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2.5">
            {visiblePairs.map((pair, index) => (
              <button
                key={pair.left}
                onClick={() => handleLeftClick(pair.left)}
                disabled={!!correctFlash || !!wrongFlash}
                aria-keyshortcuts={String(index + 1)}
                className={cn(
                  "flex w-full items-center gap-2.5 cursor-pointer rounded-xl border-2 p-4 text-left text-sm font-semibold transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:active:scale-100",
                  getLeftStyle(pair.left)
                )}
              >
                <Kbd className="shrink-0">{index + 1}</Kbd>
                <span>{pair.left}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2.5">
            {shuffledRights.map((right, index) => (
              <button
                key={right}
                onClick={() => handleRightClick(right)}
                disabled={!!correctFlash || !!wrongFlash}
                aria-keyshortcuts={RIGHT_KEYS[index]?.toUpperCase()}
                className={cn(
                  "flex w-full items-center gap-2.5 cursor-pointer rounded-xl border-2 p-4 text-left text-sm font-semibold transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:active:scale-100",
                  getRightStyle(right)
                )}
              >
                <Kbd className="shrink-0">{RIGHT_KEYS[index]?.toUpperCase()}</Kbd>
                <span>{right}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-[fadeIn_200ms_ease-in]">
          {timedOut && (
            <p className="text-center text-base font-semibold text-destructive">
              {t("learn.timeUp")}
            </p>
          )}
          <div className={cn(
            "rounded-2xl border-2 p-6 text-center",
            timedOut ? "border-destructive bg-destructive text-white" : "border-success bg-success text-white"
          )}>
            <p className="text-2xl font-bold">
              {timedOut
                ? `${matchedCount}/${allPairs.length}`
                : t("learn.allMatched")}
            </p>
            {!timedOut && errorCount === 0 && (
              <p className="text-sm mt-1">{t("learn.perfectMatch")}</p>
            )}
            {errorCount > 0 && (
              <p className="text-sm mt-1">{t("learn.errorCount", { count: errorCount })}</p>
            )}
          </div>
          <Button onClick={handleNext} className="w-full" size="lg" aria-keyshortcuts="Enter">
            {t("learn.nextCard")}
            <Kbd className="ml-2">{t("learn.keyEnter")}</Kbd>
          </Button>
        </div>
      )}
    </div>
  );
}
