import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, getTableColumns, isNull, lte, or, sql } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { canSeeSubject } from '../../common/visibility';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import {
  type Card,
  type CardChoice,
  cardProgress,
  cards,
  type MatchPair,
  reviewHistory,
  subjects,
} from '../../db/schema';
import { toCardResponse } from '../cards/card-mapper';
import type { CardResponse } from '../cards/dto/card.dto';
import type {
  CheckReviewInput,
  CreateReviewInput,
  EliminateChoiceInput,
  EliminateChoiceResult,
  GradeResult,
  SubmitReviewResult,
} from '../reviews/dto/review.dto';
import { GradingService } from './grading.service';
import { Sm2Service } from './sm2.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * How many cards a single learn session serves — distinct from the user's daily goal (the
 * day's target, which drives the dashboard/streak). A learner with a goal of 20 does ~2
 * sessions of this size to hit it. Kept small so a session is a short, completable batch.
 */
const SESSION_SIZE = 10;

export interface SessionCards {
  due: CardResponse[];
  new: CardResponse[];
}

@Injectable()
export class LearningService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly sm2: Sm2Service,
    private readonly grading: GradingService
  ) {}

  /**
   * Builds the study batch for one session: overdue cards first (most overdue first, capped at
   * {@link SESSION_SIZE}), then new (never-reviewed) cards to top the session up to that size.
   * So a session holds at most `SESSION_SIZE` cards — independent of the user's daily goal. An
   * optional `type` restricts the batch to a single card type (e.g. only quizzes).
   *
   * In **review-ahead** mode (`ahead`), the due gate is relaxed: already-seen cards scheduled
   * for the future are pulled in too (still soonest-due first), so a learner who is all caught
   * up can keep practising. Genuinely overdue cards still come first; new cards top up the rest.
   */
  async getSessionCards(
    userId: string,
    subjectId?: string,
    type?: Card['type'],
    ahead = false
  ): Promise<SessionCards> {
    if (subjectId) await this.assertSubjectVisible(userId, subjectId);

    const now = new Date().toISOString();
    const subjectFilter = subjectId ? eq(cards.subjectId, subjectId) : undefined;
    const typeFilter = type ? eq(cards.type, type) : undefined;

    const due = await this.db
      .select(getTableColumns(cards))
      .from(cardProgress)
      .innerJoin(cards, eq(cardProgress.cardId, cards.id))
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(
        and(
          eq(cardProgress.userId, userId),
          canSeeSubject(userId),
          // Normal sessions only serve due/overdue cards; ahead mode drops this gate.
          ahead ? undefined : lte(cardProgress.nextReviewDate, now),
          subjectFilter,
          typeFilter
        )
      )
      .orderBy(asc(cardProgress.nextReviewDate))
      .limit(SESSION_SIZE);

    // New cards top the session up to the session size after due reviews take their share.
    const maxNew = Math.max(0, SESSION_SIZE - due.length);
    const newCards =
      maxNew > 0
        ? await this.db
            .select(getTableColumns(cards))
            .from(cards)
            .innerJoin(subjects, eq(cards.subjectId, subjects.id))
            .leftJoin(
              cardProgress,
              and(eq(cardProgress.cardId, cards.id), eq(cardProgress.userId, userId))
            )
            .where(and(canSeeSubject(userId), isNull(cardProgress.id), subjectFilter, typeFilter))
            .orderBy(asc(cards.id))
            .limit(maxNew)
        : [];

    // Always sanitized: the study payload never carries grading data (server grades on submit).
    return {
      due: due.map((card) => toCardResponse(card, false)),
      new: newCards.map((card) => toCardResponse(card, false)),
    };
  }

  /**
   * Counts cards per type for the "choose what to study" screen, in two tiers:
   * - `byType` / `total`: studyable RIGHT NOW (never reviewed, or due) — the same gate as
   *   {@link getSessionCards}, so a mode with nothing due reflects today's session exactly.
   * - `reviewableByType` / `reviewableTotal`: the entire visible pool regardless of schedule,
   *   so the UI can show a "due / total" fraction and offer review-ahead once nothing is due.
   * Both are optionally scoped to one subject.
   */
  async getTypeCounts(
    userId: string,
    subjectId?: string
  ): Promise<{
    total: number;
    byType: Record<Card['type'], number>;
    reviewableTotal: number;
    reviewableByType: Record<Card['type'], number>;
  }> {
    const now = new Date().toISOString();
    const subjectFilter = subjectId ? eq(cards.subjectId, subjectId) : undefined;
    const dueRows = await this.db
      .select({ type: cards.type, count: sql<number>`count(*)::int` })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .leftJoin(
        cardProgress,
        and(eq(cardProgress.cardId, cards.id), eq(cardProgress.userId, userId))
      )
      .where(
        and(
          canSeeSubject(userId),
          subjectFilter,
          // Never reviewed (no progress row) OR overdue — the same gate as the study queue.
          or(isNull(cardProgress.id), lte(cardProgress.nextReviewDate, now))
        )
      )
      .groupBy(cards.type);

    // The whole visible pool, regardless of due date — what review-ahead can draw from.
    const allRows = await this.db
      .select({ type: cards.type, count: sql<number>`count(*)::int` })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(canSeeSubject(userId), subjectFilter))
      .groupBy(cards.type);

    const zero = (): Record<Card['type'], number> => ({
      open: 0,
      quiz: 0,
      'type-answer': 0,
      match: 0,
    });
    const byType = zero();
    const reviewableByType = zero();
    let total = 0;
    let reviewableTotal = 0;
    for (const row of dueRows) {
      byType[row.type] = row.count;
      total += row.count;
    }
    for (const row of allRows) {
      reviewableByType[row.type] = row.count;
      reviewableTotal += row.count;
    }
    return { total, byType, reviewableTotal, reviewableByType };
  }

  /** The single next card to study: most overdue, else the next new card, else null. */
  async getNextCard(
    userId: string,
    subjectId?: string,
    type?: Card['type'],
    ahead = false
  ): Promise<CardResponse | null> {
    const { due, new: newCards } = await this.getSessionCards(userId, subjectId, type, ahead);
    return due[0] ?? newCards[0] ?? null;
  }

  /**
   * Applies SM-2, upserts the card's progress, and logs an immutable review. `open` cards
   * carry a self-assessed `quality`; the auto-graded types instead carry the learner's
   * `response`, which the server grades to derive the quality (and the feedback returned).
   */
  async submitReview(userId: string, input: CreateReviewInput): Promise<SubmitReviewResult> {
    const { cardId, timeSpent, wasHintUsed } = input;
    const [card] = await this.db
      .select({
        subjectId: cards.subjectId,
        type: cards.type,
        answer: cards.answer,
        payload: cards.payload,
      })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cards.id, cardId), canSeeSubject(userId)))
      .limit(1);
    if (!card) throw ApiError.notFound('cards.notFound');

    const { quality, grade } = this.resolveQuality(card, input);
    const effectiveQuality = this.sm2.applyHintCap(quality, wasHintUsed);
    const [existing] = await this.db
      .select()
      .from(cardProgress)
      .where(and(eq(cardProgress.userId, userId), eq(cardProgress.cardId, cardId)))
      .limit(1);

    const { newInterval, newEaseFactor, newRepetitions } = this.sm2.calculateNextReview(
      effectiveQuality,
      existing?.interval ?? 1,
      existing?.easeFactor ?? 2.5,
      existing?.repetitions ?? 0
    );

    const now = new Date();
    const nowIso = now.toISOString();
    const nextReviewDate = new Date(now.getTime() + newInterval * DAY_MS).toISOString();
    const status = this.sm2.deriveStatus(newRepetitions, newInterval, newEaseFactor);

    const [progress] = await this.db
      .insert(cardProgress)
      .values({
        userId,
        cardId,
        interval: newInterval,
        easeFactor: newEaseFactor,
        repetitions: newRepetitions,
        nextReviewDate,
        lastReviewDate: nowIso,
        status,
      })
      .onConflictDoUpdate({
        target: [cardProgress.userId, cardProgress.cardId],
        set: {
          interval: newInterval,
          easeFactor: newEaseFactor,
          repetitions: newRepetitions,
          nextReviewDate,
          lastReviewDate: nowIso,
          status,
          updatedAt: nowIso,
        },
      })
      .returning();

    await this.db.insert(reviewHistory).values({
      userId,
      cardId,
      subjectId: card.subjectId,
      quality: effectiveQuality,
      reviewedAt: nowIso,
      timeSpent,
      wasHintUsed,
    });

    return grade ? { progress, grade } : { progress };
  }

  /**
   * Grades an auto-correctable answer WITHOUT persisting anything — no SM-2, no progress upsert,
   * no review-history row. Used by the in-session short loop, where a wrong card is re-practised
   * until the learner clears it: scheduling and counting already happened on the first attempt,
   * so a re-attempt only needs feedback.
   */
  async checkReview(userId: string, input: CheckReviewInput): Promise<GradeResult> {
    const [card] = await this.db
      .select({ type: cards.type, answer: cards.answer, payload: cards.payload })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cards.id, input.cardId), canSeeSubject(userId)))
      .limit(1);
    if (!card) throw ApiError.notFound('cards.notFound');
    // Only the auto-graded types are checkable (open cards are self-assessed on the client).
    if (input.response.type !== card.type) {
      throw ApiError.badRequest('errors.validation', 'response');
    }
    return this.gradeAutoResponse(card, input.response);
  }

  /**
   * Quiz "eliminate" hint: returns the next wrong choice to grey out (or `null` once two remain).
   * Decided server-side because the study payload never carries which choice is correct — so the
   * client can't pick a wrong one to disable itself. Counts toward `wasHintUsed` on the client.
   */
  async eliminateChoice(
    userId: string,
    input: EliminateChoiceInput
  ): Promise<EliminateChoiceResult> {
    const { cardId, eliminatedChoiceIds } = input;
    const [card] = await this.db
      .select({ type: cards.type, payload: cards.payload })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cards.id, cardId), canSeeSubject(userId)))
      .limit(1);
    if (!card) throw ApiError.notFound('cards.notFound');
    if (card.type !== 'quiz') throw ApiError.badRequest('errors.validation', 'cardId');

    const choices = (card.payload as { choices: CardChoice[] } | null)?.choices ?? [];
    return { choiceId: this.grading.nextEliminableChoice(choices, eliminatedChoiceIds) };
  }

  /**
   * Derives the SM-2 quality for a review. `open` cards are self-assessed (the client's
   * `quality` is trusted); the auto-graded types are corrected from the learner's `response`,
   * so the answer never has to be shipped to the client.
   */
  private resolveQuality(
    card: { type: Card['type']; answer: string; payload: Card['payload'] },
    input: CreateReviewInput
  ): { quality: number; grade?: GradeResult } {
    if (card.type === 'open') {
      if (input.quality == null) throw ApiError.badRequest('errors.validation', 'quality');
      return { quality: input.quality };
    }

    const response = input.response;
    if (!response || response.type !== card.type) {
      throw ApiError.badRequest('errors.validation', 'response');
    }

    const grade = this.gradeAutoResponse(card, response);
    return { quality: this.grading.qualityForCorrectness(grade.correct), grade };
  }

  /**
   * Grades an auto-correctable response (quiz / type-answer / match) against the card, returning
   * the feedback revealed after answering. Shared by {@link submitReview} (which also schedules)
   * and {@link checkReview} (which only grades). The grading data lives only here on the server.
   */
  private gradeAutoResponse(
    card: { answer: string; payload: Card['payload'] },
    response: NonNullable<CreateReviewInput['response']>
  ): GradeResult {
    const detail: Partial<GradeResult> = {};
    let correct: boolean;
    if (response.type === 'quiz') {
      const choices = (card.payload as { choices: CardChoice[] } | null)?.choices ?? [];
      const result = this.grading.gradeQuiz(choices, response.choiceId);
      correct = result.correct;
      detail.correctChoiceId = result.correctChoiceId;
    } else if (response.type === 'type-answer') {
      const shortAnswer = (card.payload as { shortAnswer: string } | null)?.shortAnswer ?? '';
      const result = this.grading.gradeTypeAnswer(shortAnswer, response.text);
      correct = result.correct;
      detail.correctText = result.correctText;
    } else {
      const pairs = (card.payload as { matchPairs: MatchPair[] } | null)?.matchPairs ?? [];
      const result = this.grading.gradeMatch(pairs, response.pairs);
      correct = result.correct;
      detail.correctPairs = result.correctPairs;
    }

    return { correct, explanation: card.answer, ...detail };
  }

  private async assertSubjectVisible(userId: string, subjectId: string): Promise<void> {
    const [visible] = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), canSeeSubject(userId)))
      .limit(1);
    if (!visible) throw ApiError.notFound('subjects.notFound');
  }
}
