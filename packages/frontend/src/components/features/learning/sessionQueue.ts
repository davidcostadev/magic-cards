import type { Card } from '@/api/queries/cards';

/**
 * State for one learn session's working queue. The deck starts as the snapshot of cards to study
 * and GROWS: a card answered wrong is appended to the end so the learner re-practises it before
 * the session can finish — a Duolingo-style "short loop". `firstPassLength` marks the original
 * snapshot, so the first pass (which schedules cards server-side and counts toward accuracy) is
 * told apart from the re-practice tail (which only reinforces).
 */
export interface SessionState {
  deck: Card[];
  index: number;
  firstPassLength: number;
  firstPassCorrect: number;
  completed: boolean;
}

export function initSession(cards: Card[]): SessionState {
  return {
    deck: cards,
    index: 0,
    firstPassLength: cards.length,
    firstPassCorrect: 0,
    completed: cards.length === 0,
  };
}

/**
 * Records the outcome of the current card and moves on. A wrong answer requeues the card to the
 * end of the deck; the session only completes once every requeued card has been cleared. Accuracy
 * (`firstPassCorrect`) counts a card only on its first pass — re-practice never inflates it.
 */
export function advance(state: SessionState, correct: boolean): SessionState {
  if (state.completed) return state;
  const inFirstPass = state.index < state.firstPassLength;
  const firstPassCorrect = state.firstPassCorrect + (correct && inFirstPass ? 1 : 0);
  const deck = correct ? state.deck : [...state.deck, state.deck[state.index]];
  const index = state.index + 1;
  return { ...state, deck, index, firstPassCorrect, completed: index >= deck.length };
}

/** The card currently being studied (undefined once the session is complete). */
export function currentCard(state: SessionState): Card | undefined {
  return state.deck[state.index];
}

/** True while re-practising requeued mistakes (i.e. past the original snapshot). */
export function isRelearning(state: SessionState): boolean {
  return state.index >= state.firstPassLength;
}

/**
 * How many distinct cards have been CLEARED (answered correctly) so far. Since a correct answer
 * is never requeued, this equals the number of correct answers given. It drives the header's
 * "card x of y": counting cleared cards rather than deck position means a card requeued for
 * re-practice keeps the counter climbing toward the goal instead of freezing at "y of y" — every
 * still-queued card (`deck.length - index`) is one that hasn't been cleared yet.
 */
export function clearedCount(state: SessionState): number {
  return state.firstPassLength - (state.deck.length - state.index);
}
