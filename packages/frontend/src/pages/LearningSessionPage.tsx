import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Flag, GraduationCap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/api/queries/cards';
import {
  type CardType,
  type ReviewQueue,
  useCheckReview,
  useEliminateChoice,
  useReviewQueue,
  useSubmitReview,
  useTypeCounts,
} from '@/api/queries/reviews';
import { Kbd } from '@/components/common/Kbd';
import { CardReview, type ReviewSubmission } from '@/components/features/learning/CardReview';
import { CardStatsPanel } from '@/components/features/learning/CardStatsPanel';
import { ReportCardSheet } from '@/components/features/learning/ReportCardSheet';
import { SessionSummary } from '@/components/features/learning/SessionSummary';
import { type StudyMode, StudyModeModal } from '@/components/features/learning/StudyModeModal';
import {
  advance,
  clearedCount,
  initSession,
  isRelearning,
  type SessionState,
} from '@/components/features/learning/sessionQueue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useLearningSessions } from '@/context/LearningContext';
import { isInteractiveTarget } from '@/utils/keyboard';

const DEFAULT_DAILY_GOAL = 20;

function orderedSession(queue: ReviewQueue): Card[] {
  return [...queue.due, ...queue.new];
}

/**
 * Shows the "How do you want to study?" chooser until a mode is picked, then mounts a fresh
 * session for it. The session is keyed by (subject, mode) so switching modes remounts it
 * instead of reusing the previous mode's snapshotted deck.
 */
export function LearningSessionPage() {
  const params = useParams({ strict: false });
  const subjectId = (params as { subjectId?: string }).subjectId;
  const { mode, ahead } = useSearch({ strict: false }) as { mode?: StudyMode; ahead?: boolean };
  const navigate = useNavigate();
  const { t } = useTranslation();
  const counts = useTypeCounts(subjectId, !mode);

  const chooseMode = useCallback(
    (picked: StudyMode) => {
      // Nothing due for this mode → start a review-ahead session (study cards before they're due).
      const data = counts.data;
      const due = !data ? 0 : picked === 'all' ? data.total : data.byType[picked];
      const search = due === 0 ? { mode: picked, ahead: true } : { mode: picked };
      navigate({
        to: subjectId ? '/learn/$subjectId' : '/learn',
        params: subjectId ? { subjectId } : {},
        search,
      });
    },
    [navigate, subjectId, counts.data]
  );

  if (!mode) {
    if (counts.isLoading || !counts.data) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-5">
          <p className="text-lg text-muted-foreground">{t('common.loading')}</p>
        </div>
      );
    }
    // Only a subject with no cards at all is a dead end; if cards exist but none are due,
    // the chooser stays open and offers review-ahead.
    if (counts.data.reviewableTotal === 0) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center p-5">
          <GraduationCap className="h-16 w-16 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">{t('learn.noCardsToReview')}</p>
          <Button variant="outline" onClick={() => navigate({ to: '/dashboard' })}>
            {t('common.back')}
          </Button>
        </div>
      );
    }
    return (
      <StudyModeModal
        counts={counts.data.byType}
        total={counts.data.total}
        reviewable={counts.data.reviewableByType}
        reviewableTotal={counts.data.reviewableTotal}
        onSelect={chooseMode}
      />
    );
  }

  const type: CardType | undefined = mode === 'all' ? undefined : mode;
  return (
    <LearningSession
      key={`${subjectId ?? 'all'}:${mode}:${ahead ? 'ahead' : 'due'}`}
      subjectId={subjectId}
      type={type}
      ahead={!!ahead}
    />
  );
}

interface LearningSessionProps {
  subjectId?: string;
  type?: CardType;
  /** Review-ahead: pull already-seen cards that aren't due yet (used when nothing is due). */
  ahead?: boolean;
}

/** Runs one study session: snapshots the deck, tracks progress, and handles the exit dialog. */
function LearningSession({ subjectId, type, ahead = false }: LearningSessionProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setInSession, exitRequested, requestExit, cancelExit, overlayOpen, setOverlayOpen } =
    useLearningSessions();
  const { user } = useAuth();
  const dailyGoal = user?.dailyGoal ?? DEFAULT_DAILY_GOAL;

  const { data: queue, isLoading } = useReviewQueue(subjectId, type, ahead);
  const submitReview = useSubmitReview();
  const checkReview = useCheckReview();
  const eliminateChoice = useEliminateChoice();

  // Snapshot the queue once so mid-session invalidations don't reshuffle the deck. The session
  // queue then grows as wrong cards are requeued for re-practice (the short loop).
  const [session, setSession] = useState<SessionState | null>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (queue && session === null) {
      setSession(initSession(orderedSession(queue)));
      startTime.current = Date.now();
    }
  }, [queue, session]);

  const activeSession = !!session && session.deck.length > 0 && !session.completed;
  const cardIndex = session?.index;

  useEffect(() => {
    setInSession(activeSession);
    return () => setInSession(false);
  }, [activeSession, setInSession]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [cardIndex]);

  const confirmExit = useCallback(() => {
    setInSession(false);
    cancelExit();
    navigate({ to: '/dashboard' });
  }, [setInSession, cancelExit, navigate]);

  // Esc requests exit; the confirm dialog handles its own Esc-to-cancel. While the report sheet
  // is open, Esc belongs to the sheet (close it), so the session ignores it.
  useEffect(() => {
    if (!activeSession || overlayOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exitRequested) {
        e.preventDefault();
        requestExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSession, overlayOpen, exitRequested, requestExit]);

  // Close the report sheet when the card advances, and clear the overlay lock on unmount.
  useEffect(() => {
    setOverlayOpen(false);
  }, [cardIndex, setOverlayOpen]);
  useEffect(() => () => setOverlayOpen(false), [setOverlayOpen]);

  useEffect(() => {
    if (!exitRequested) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isInteractiveTarget(document.activeElement)) {
        e.preventDefault();
        confirmExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exitRequested, confirmExit]);

  if (isLoading || session === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-5">
        <p className="text-lg text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (session.deck.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center p-5">
        <GraduationCap className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">{t('learn.noCardsToReview')}</p>
        <Button variant="outline" onClick={() => navigate({ to: '/dashboard' })}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  if (session.completed) {
    return (
      <SessionSummary
        cardsReviewed={session.firstPassLength}
        correctCount={session.firstPassCorrect}
        timeSpentMs={Date.now() - startTime.current}
      />
    );
  }

  const currentCard = session.deck[session.index];
  const relearning = isRelearning(session);

  // Runs the review for the current answer. On the first pass it submits (server schedules via
  // SM-2 + records it). While re-practising a requeued mistake (`relearning`) it only CHECKS:
  // auto-graded cards are re-graded server-side for feedback without rescheduling/recounting,
  // and open cards are self-assessed on the client (no server call needed).
  const handleSubmit = async (input: ReviewSubmission) => {
    if (relearning) {
      if (!input.response) return undefined;
      try {
        return await checkReview.mutateAsync({ cardId: currentCard.id, response: input.response });
      } catch {
        return undefined;
      }
    }
    try {
      const data = await submitReview.mutateAsync({
        cardId: currentCard.id,
        quality: input.quality,
        response: input.response,
        timeSpent: Math.round(input.timeSpentMs),
        wasHintUsed: input.wasHintUsed,
      });
      return data.grade;
    } catch {
      return undefined;
    }
  };

  // Quiz "eliminate" hint: the server picks one wrong choice to grey out (it never ships which
  // choice is correct), returning the id to disable — or null once only two choices remain.
  const handleEliminate = async (eliminatedChoiceIds: string[]) => {
    try {
      return await eliminateChoice.mutateAsync({ cardId: currentCard.id, eliminatedChoiceIds });
    } catch {
      return null;
    }
  };

  const handleAdvance = (correct: boolean) => {
    setSession((prev) => (prev ? advance(prev, correct) : prev));
  };

  return (
    <>
      {relearning && (
        <div className="mx-auto mb-3 flex max-w-2xl justify-center px-4">
          <span
            role="status"
            className="rounded-full bg-warning/15 px-3 py-1 text-sm font-medium text-warning"
          >
            {t('learn.reviewingMistakes')}
          </span>
        </div>
      )}

      <CardReview
        // Keyed by deck position (not card id) so a requeued card remounts and resets its state.
        key={session.index}
        card={currentCard}
        cardLanguage={user?.cardLanguage ?? 'all'}
        // Header progress counts cards CLEARED (answered correctly), not deck position, so a
        // card requeued for re-practice keeps the counter climbing toward the goal instead of
        // freezing at "N of N" while mistakes are re-practised.
        currentIndex={clearedCount(session)}
        totalCards={session.firstPassLength}
        dailyGoalProgress={session.index}
        dailyGoal={dailyGoal}
        onSubmit={handleSubmit}
        onAdvance={handleAdvance}
        onEliminate={handleEliminate}
      />

      {/* Subtle, always-available way to flag the current card as wrong or improvable. */}
      <div className="mx-auto mt-3 flex max-w-2xl justify-center px-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setOverlayOpen(true)}
        >
          <Flag className="mr-2 h-4 w-4" />
          {t('reports.button')}
        </Button>
      </div>

      {/* "Nerd stats": opt-in per-card performance, gated on the user's preference. Never the answer. */}
      <div className="mx-auto mt-2 max-w-2xl px-4 pb-8">
        <CardStatsPanel cardId={currentCard.id} />
      </div>

      <ReportCardSheet open={overlayOpen} onOpenChange={setOverlayOpen} card={currentCard} />

      <Dialog
        open={exitRequested}
        onOpenChange={(open) => {
          if (!open) cancelExit();
        }}
        autoFocus={false}
      >
        <DialogContent className="max-w-sm text-center justify-center">
          <DialogHeader>
            <DialogTitle>{t('learn.exitTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground py-2">{t('learn.exitMessage')}</p>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={cancelExit} aria-keyshortcuts="Escape">
              {t('learn.exitCancel')}
              <Kbd className="ml-2">{t('learn.keyEsc')}</Kbd>
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmExit}
              aria-keyshortcuts="Enter"
            >
              {t('learn.exitConfirm')}
              <Kbd className="ml-2">{t('learn.keyEnter')}</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
