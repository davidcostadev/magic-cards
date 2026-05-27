import { useState, useRef, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CardReview } from "@/components/features/learning/CardReview";
import { QuizReview } from "@/components/features/learning/QuizReview";
import { SessionSummary } from "@/components/features/learning/SessionSummary";
import { StudyModeModal, type StudyMode } from "@/components/features/learning/StudyModeModal";
import { useLearningSessions } from "@/context/LearningContext";
import { mockCards, mockUser } from "@/mocks/data";

type Quality = 1 | 3 | 4 | 5;

export function LearningSessionPage() {
  const params = useParams({ strict: false });
  const subjectId = (params as { subjectId?: string }).subjectId;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setInSession, exitRequested, cancelExit } = useLearningSessions();

  const allCards = useMemo(
    () => (subjectId ? mockCards.filter((c) => c.subjectId === subjectId) : mockCards),
    [subjectId]
  );

  const flashcardCount = allCards.filter((c) => c.type === "open").length;
  const quizCount = allCards.filter((c) => c.type === "quiz").length;

  const [mode, setMode] = useState<StudyMode | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const startTime = useRef(Date.now());

  const sessionCards = useMemo(() => {
    let cards;
    if (!mode) return [];
    if (mode === "flashcards") cards = allCards.filter((c) => c.type === "open");
    else if (mode === "quizzes") cards = allCards.filter((c) => c.type === "quiz");
    else cards = [...allCards];

    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }, [allCards, mode]);

  const activeSession = !!mode && !completed;

  useEffect(() => {
    setInSession(activeSession);
    return () => setInSession(false);
  }, [activeSession, setInSession]);

  if (allCards.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center p-5">
        <GraduationCap className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">{t("learn.noCardsToReview")}</p>
      </div>
    );
  }

  if (!mode) {
    return (
      <StudyModeModal
        open
        onOpenChange={() => {}}
        onSelect={(selected) => {
          setMode(selected);
          setCurrentIndex(0);
          setCorrectCount(0);
          setCompleted(false);
          startTime.current = Date.now();
        }}
        flashcardCount={flashcardCount}
        quizCount={quizCount}
      />
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

  const handleRate = (quality: Quality) => {
    if (quality >= 3) {
      setCorrectCount((prev) => prev + 1);
    }
    if (currentIndex + 1 >= sessionCards.length) {
      setCompleted(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const currentCard = sessionCards[currentIndex];
  const commonProps = {
    card: currentCard,
    currentIndex,
    totalCards: sessionCards.length,
    dailyGoalProgress: currentIndex,
    dailyGoal: mockUser.dailyGoal,
    onRate: handleRate,
  };

  return (
    <>
      {currentCard.type === "quiz" ? (
        <QuizReview key={currentCard.id} {...commonProps} />
      ) : (
        <CardReview key={currentCard.id} {...commonProps} />
      )}

      <Dialog open={exitRequested} onOpenChange={(open) => { if (!open) cancelExit(); }}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>{t("learn.exitTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground py-2">
            {t("learn.exitMessage")}
          </p>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={cancelExit}>
              {t("learn.exitCancel")}
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setInSession(false);
                cancelExit();
                navigate({ to: "/dashboard" });
              }}
            >
              {t("learn.exitConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
