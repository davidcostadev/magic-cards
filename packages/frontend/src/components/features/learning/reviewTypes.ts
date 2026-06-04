import type { Card } from '@/api/queries/cards';
import type { Grade, ReviewResponse } from '@/api/queries/reviews';

/**
 * What a review component sends up when the learner answers. `open` cards are self-assessed
 * (they supply `quality`); the auto-graded types supply their `response` and the page returns
 * the server `Grade` so the component can render correctness + the correct answer.
 */
export interface ReviewSubmission {
  quality?: number;
  response?: ReviewResponse;
  timeSpentMs: number;
  wasHintUsed: boolean;
}

export interface CardReviewProps {
  card: Card;
  currentIndex: number;
  totalCards: number;
  dailyGoalProgress: number;
  dailyGoal: number;
  /** Performs the review mutation and resolves with the grade (undefined for open cards). */
  onSubmit: (input: ReviewSubmission) => Promise<Grade | undefined>;
  /** Advance to the next card (or finish), recording whether this answer was correct. */
  onAdvance: (correct: boolean) => void;
  /**
   * Quiz only: asks the server to eliminate one more wrong choice, given the ids already
   * eliminated. Resolves with the choice id to disable, or `null` when only two remain.
   */
  onEliminate?: (eliminatedChoiceIds: string[]) => Promise<string | null>;
}
