import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, getTableColumns, isNull, lte } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { canSeeSubject } from '../../common/visibility';
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
  async getSessionCards(userId: string, subjectId?: string): Promise<SessionCards> {
    if (subjectId) await this.assertSubjectVisible(userId, subjectId);

    const now = new Date().toISOString();
    const [user] = await this.db
      .select({ goal: users.dailyGoal })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const dailyGoal = user?.goal ?? DEFAULT_DAILY_GOAL;
    const maxNew = Math.floor(NEW_CARD_RATIO * dailyGoal);
    const subjectFilter = subjectId ? eq(cards.subjectId, subjectId) : undefined;

    const due = await this.db
      .select(getTableColumns(cards))
      .from(cardProgress)
      .innerJoin(cards, eq(cardProgress.cardId, cards.id))
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(
        and(
          eq(cardProgress.userId, userId),
          canSeeSubject(userId),
          lte(cardProgress.nextReviewDate, now),
          subjectFilter
        )
      )
      .orderBy(asc(cardProgress.nextReviewDate));

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
            .where(and(canSeeSubject(userId), isNull(cardProgress.id), subjectFilter))
            .orderBy(asc(cards.id))
            .limit(maxNew)
        : [];

    return { due, new: newCards };
  }

  /** The single next card to study: most overdue, else the next new card, else null. */
  async getNextCard(userId: string, subjectId?: string): Promise<CardResponse | null> {
    const { due, new: newCards } = await this.getSessionCards(userId, subjectId);
    return due[0] ?? newCards[0] ?? null;
  }

  /** Applies SM-2, upserts the card's progress, and logs an immutable review. */
  async submitReview(
    userId: string,
    cardId: string,
    quality: number,
    timeSpent: number,
    wasHintUsed: boolean
  ): Promise<CardProgressResponse> {
    const [card] = await this.db
      .select({ subjectId: cards.subjectId })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cards.id, cardId), canSeeSubject(userId)))
      .limit(1);
    if (!card) throw ApiError.notFound('cards.notFound');

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

    return progress;
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
