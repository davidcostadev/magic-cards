import { Injectable } from '@nestjs/common';
import type { CardChoice, MatchPair } from '../../db/schema';
import { MATCH_DISPLAY_LIMIT } from '../cards/card-mapper';

/** SM-2 quality assigned to auto-graded cards. Correct = passing/neutral ease; */
/** incorrect = a lapse (<3 resets the interval in SM-2). Hint cap (≤3) is applied later. */
const QUALITY_CORRECT = 4;
const QUALITY_INCORRECT = 2;

export interface QuizGrade {
  correct: boolean;
  correctChoiceId: string;
}
export interface TypeAnswerGrade {
  correct: boolean;
  correctText: string;
}
export interface MatchGrade {
  correct: boolean;
  correctPairs: MatchPair[];
}

/**
 * Server-side grading for the auto-correctable card types (quiz, type-answer, match).
 * Pure, framework-agnostic logic developed test-first (ADR 0005). The grading data
 * (which choice is correct, the expected text, the pairing) never leaves the server
 * until the answer is submitted, so it can't be read off the study payload.
 */
@Injectable()
export class GradingService {
  gradeQuiz(choices: CardChoice[], choiceId: string): QuizGrade {
    const correctChoice = choices.find((c) => c.isCorrect);
    return {
      correct: !!correctChoice && correctChoice.id === choiceId,
      correctChoiceId: correctChoice?.id ?? '',
    };
  }

  gradeTypeAnswer(shortAnswer: string, text: string): TypeAnswerGrade {
    return {
      correct: this.normalize(shortAnswer) === this.normalize(text),
      correctText: shortAnswer,
    };
  }

  /**
   * All-or-nothing over the same first-N pairs the learner was shown (see MATCH_DISPLAY_LIMIT):
   * every shown pair must match (order-independent), with no missing/extra pairs.
   */
  gradeMatch(pairs: MatchPair[], submitted: MatchPair[]): MatchGrade {
    const shown = pairs.slice(0, MATCH_DISPLAY_LIMIT);
    const answer = new Map(submitted.map((p) => [p.left, p.right]));
    const correct =
      submitted.length === shown.length && shown.every((p) => answer.get(p.left) === p.right);
    return { correct, correctPairs: shown };
  }

  qualityForCorrectness(correct: boolean): number {
    return correct ? QUALITY_CORRECT : QUALITY_INCORRECT;
  }

  /** Lenient comparison: case-, accent-, whitespace- and trailing-punctuation-insensitive. */
  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,;:!?'"()]/g, '');
  }
}
