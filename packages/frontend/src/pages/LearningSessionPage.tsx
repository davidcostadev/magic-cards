import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/common/Kbd";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { isInteractiveTarget } from "@/utils/keyboard";
import { CardReview, type ReviewResult } from "@/components/features/learning/CardReview";
import { SessionSummary } from "@/components/features/learning/SessionSummary";
import { useLearningSessions } from "@/context/LearningContext";
import { useAuth } from "@/context/AuthContext";
import type { Card } from "@/api/queries/cards";
import { type ReviewQueue, useReviewQueue, useSubmitReview } from "@/api/queries/reviews";

const DEFAULT_DAILY_GOAL = 20;

function orderedSession(queue: ReviewQueue): Card[] {
  return [...queue.due, ...queue.new];
}

export function LearningSessionPage() {
  const params = useParams({ strict: false });
  const subjectId = (params as { subjectId?: string }).subjectId;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setInSession, exitRequested, requestExit, cancelExit } = useLearningSessions();
  const { user } = useAuth();
  const dailyGoal = user?.dailyGoal ?? DEFAULT_DAILY_GOAL;

  const { data: queue, isLoading } = useReviewQueue(subjectId);
  const submitReview = useSubmitReview();

  // Snapshot the queue once so mid-session invalidations don't reshuffle the deck.
  const [sessionCards, setSessionCards] = useState<Card[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (queue && sessionCards === null) {
      setSessionCards(orderedSession(queue));
      startTime.current = Date.now();
    }
  }, [queue, sessionCards]);

  const activeSession = !!sessionCards && sessionCards.length > 0 && !completed;

  useEffect(() => {
    setInSession(activeSession);
    return () => setInSession(false);
  }, [activeSession, setInSession]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentIndex]);

  const confirmExit = useCallback(() => {
    setInSession(false);
    cancelExit();
    navigate({ to: "/dashboard" });
  }, [setInSession, cancelExit, navigate]);

  // Esc requests exit; the confirm dialog handles its own Esc-to-cancel.
  useEffect(() => {
    if (!activeSession) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !exitRequested) {
        e.preventDefault();
        requestExit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSession, exitRequested, requestExit]);

  useEffect(() => {
    if (!exitRequested) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !isInteractiveTarget(document.activeElement)) {
        e.preventDefault();
        confirmExit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exitRequested, confirmExit]);

  if (isLoading || sessionCards === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-5">
        <p className="text-lg text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (sessionCards.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center p-5">
        <GraduationCap className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">{t("learn.noCardsToReview")}</p>
        <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  if (completed) {
    return (
      <SessionSummary
        cardsReviewed={sessionCards.length}
        correctCount={correctCount}
        timeSpentMs={Date.now() - startTime.current}
      />
    );
  }

  const currentCard = sessionCards[currentIndex];

  const handleRate = ({ quality, wasHintUsed, timeSpentMs }: ReviewResult) => {
    submitReview.mutate({ cardId: currentCard.id, quality, timeSpent: timeSpentMs, wasHintUsed });
    if (quality >= 3) setCorrectCount((prev) => prev + 1);
    if (currentIndex + 1 >= sessionCards.length) {
      setCompleted(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  return (
    <>
      <CardReview
        key={currentCard.id}
        card={currentCard}
        currentIndex={currentIndex}
        totalCards={sessionCards.length}
        dailyGoalProgress={currentIndex}
        dailyGoal={dailyGoal}
        onRate={handleRate}
      />

      <Dialog
        open={exitRequested}
        onOpenChange={(open) => { if (!open) cancelExit(); }}
        autoFocus={false}
      >
        <DialogContent className="max-w-sm text-center justify-center">
          <DialogHeader>
            <DialogTitle>{t("learn.exitTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground py-2">{t("learn.exitMessage")}</p>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={cancelExit} aria-keyshortcuts="Escape">
              {t("learn.exitCancel")}
              <Kbd className="ml-2">{t("learn.keyEsc")}</Kbd>
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmExit}
              aria-keyshortcuts="Enter"
            >
              {t("learn.exitConfirm")}
              <Kbd className="ml-2">{t("learn.keyEnter")}</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
