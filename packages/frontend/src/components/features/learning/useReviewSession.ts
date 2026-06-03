import { useEffect, useRef } from 'react';
import { useLearningSessions } from '@/context/LearningContext';

interface ReviewSessionOptions {
  currentIndex: number;
  totalCards: number;
  dailyGoalProgress: number;
  dailyGoal: number;
  /** Countdown length in seconds. */
  seconds: number;
  /** While true the timer runs; set false once the card is answered/timed-out. */
  active: boolean;
  onTimeout: () => void;
}

/**
 * Shared review chrome for every card type: publishes the session progress (card x/y,
 * daily-goal) to the header and runs the per-card countdown, firing `onTimeout` once.
 * Components are keyed by card id, so the start time resets on each card.
 */
export function useReviewSession(opts: ReviewSessionOptions): { elapsedMs: () => number } {
  const { updateSessionInfo } = useLearningSessions();
  const startRef = useRef(Date.now());
  const onTimeoutRef = useRef(opts.onTimeout);
  onTimeoutRef.current = opts.onTimeout;

  useEffect(() => {
    updateSessionInfo({
      currentCard: opts.currentIndex + 1,
      totalCards: opts.totalCards,
      dailyGoalProgress: opts.dailyGoalProgress,
      dailyGoal: opts.dailyGoal,
    });
  }, [
    opts.currentIndex,
    opts.totalCards,
    opts.dailyGoalProgress,
    opts.dailyGoal,
    updateSessionInfo,
  ]);

  useEffect(() => {
    // Once answered/timed-out the countdown stops; flag it so the header drops the timer
    // entirely instead of freezing at a misleading red "0s".
    if (!opts.active) {
      updateSessionInfo({ timerRunning: false });
      return;
    }
    updateSessionInfo({
      timerRunning: true,
      timerTotalSeconds: opts.seconds,
      timerSeconds: opts.seconds,
    });
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, opts.seconds - elapsed);
      updateSessionInfo({ timerSeconds: left });
      if (left <= 0) {
        clearInterval(interval);
        onTimeoutRef.current();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [opts.active, opts.seconds, updateSessionInfo]);

  return { elapsedMs: () => Date.now() - startRef.current };
}
