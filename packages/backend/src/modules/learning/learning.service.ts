import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, getTableColumns, isNull, lte } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { cardProgress, cards, reviewHistory, subjects, users } from '../../db/schema';
import type { CardResponse } from '../cards/dto/card.dto';
import type { CardProgressResponse } from '../reviews/dto/review.dto';
import { Sm2Service } from './sm2.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_CARD_RATIO = 0.3;
const DEFAULT_DAILY_GOAL = 20;

export interface SessionCards {
  due: CardResponse[];
  new: CardResponse[];
}

@Injectable()
export class LearningService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly sm2: Sm2Service
  ) {}

  /**
   * Builds the study batch: every overdue card (most overdue first), then new
   * (never-reviewed) cards capped at 30% of the daily goal (architecture §7).
   */
  getSessionCards(userId: string, subjectId?: string): SessionCards {
    if (subjectId) this.assertSubjectOwned(userId, subjectId);

    const now = new Date().toISOString();
    const dailyGoal =
      this.db.select({ goal: users.dailyGoal }).from(users).where(eq(users.id, userId)).get()
        ?.goal ?? DEFAULT_DAILY_GOAL;
    const maxNew = Math.floor(NEW_CARD_RATIO * dailyGoal);
    const subjectFilter = subjectId ? eq(cards.subjectId, subjectId) : undefined;

    const due = this.db
      .select(getTableColumns(cards))
      .from(cardProgress)
      .innerJoin(cards, eq(cardProgress.cardId, cards.id))
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(
        and(
          eq(cardProgress.userId, userId),
          eq(subjects.userId, userId),
          lte(cardProgress.nextReviewDate, now),
          subjectFilter
        )
      )
      .orderBy(asc(cardProgress.nextReviewDate))
      .all();

    const newCards =
      maxNew > 0
        ? this.db
            .select(getTableColumns(cards))
            .from(cards)
            .innerJoin(subjects, eq(cards.subjectId, subjects.id))
            .leftJoin(
              cardProgress,
              and(eq(cardProgress.cardId, cards.id), eq(cardProgress.userId, userId))
            )
            .where(and(eq(subjects.userId, userId), isNull(cardProgress.id), subjectFilter))
            .orderBy(asc(cards.id))
            .limit(maxNew)
            .all()
        : [];

    return { due, new: newCards };
  }

  /** The single next card to study: most overdue, else the next new card, else null. */
  getNextCard(userId: string, subjectId?: string): CardResponse | null {
    const { due, new: newCards } = this.getSessionCards(userId, subjectId);
    return due[0] ?? newCards[0] ?? null;
  }

  /** Applies SM-2, upserts the card's progress, and logs an immutable review. */
  submitReview(
    userId: string,
    cardId: string,
    quality: number,
    timeSpent: number,
    wasHintUsed: boolean
  ): CardProgressResponse {
    const card = this.db
      .select({ subjectId: cards.subjectId })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cards.id, cardId), eq(subjects.userId, userId)))
      .get();
    if (!card) throw ApiError.notFound('cards.notFound');

    const effectiveQuality = this.sm2.applyHintCap(quality, wasHintUsed);
    const existing = this.db
      .select()
      .from(cardProgress)
      .where(and(eq(cardProgress.userId, userId), eq(cardProgress.cardId, cardId)))
      .get();

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

    const progress = this.db
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
      .returning()
      .get();

    this.db
      .insert(reviewHistory)
      .values({
        userId,
        cardId,
        subjectId: card.subjectId,
        quality: effectiveQuality,
        reviewedAt: nowIso,
        timeSpent,
        wasHintUsed,
      })
      .run();

    return progress;
  }

  private assertSubjectOwned(userId: string, subjectId: string): void {
    const owned = this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
      .get();
    if (!owned) throw ApiError.notFound('subjects.notFound');
  }
}
