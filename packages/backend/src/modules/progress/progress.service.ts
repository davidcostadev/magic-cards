import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { canSeeSubject } from '../../common/visibility';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { cardProgress, cards, reviewHistory, subjects } from '../../db/schema';
import type { ResetProgressInput, ResetProgressResult } from './dto/progress.dto';

@Injectable()
export class ProgressService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Sends the matching cards back to "never studied" for this learner: drops their SM-2 scheduling
   * (`card_progress`) and the review log behind their statistics (`review_history`). Both go in one
   * transaction — leaving history without progress would keep the old accuracy in the aggregates
   * while the card claims to be new.
   *
   * Scoped to the caller's own rows, so a shared catalog card resets for them and nobody else.
   * Requires a filter: an empty body is a 400 rather than a silent full wipe.
   */
  async reset(userId: string, dto: ResetProgressInput): Promise<ResetProgressResult> {
    const hasFilter = Boolean(dto.all || dto.subject || dto.type || dto.cards?.length);
    if (!hasFilter) throw ApiError.badRequest('progress.resetFilterRequired');

    const targetIds = await this.matchingCardIds(userId, dto);
    if (targetIds.length === 0) return { cardsReset: 0, reviewsDeleted: 0 };

    return this.db.transaction(async (tx) => {
      const history = await tx
        .delete(reviewHistory)
        .where(and(eq(reviewHistory.userId, userId), inArray(reviewHistory.cardId, targetIds)))
        .returning({ id: reviewHistory.id });
      const progress = await tx
        .delete(cardProgress)
        .where(and(eq(cardProgress.userId, userId), inArray(cardProgress.cardId, targetIds)))
        .returning({ id: cardProgress.id });
      return { cardsReset: progress.length, reviewsDeleted: history.length };
    });
  }

  /**
   * The cards the filters select, restricted to what the user can actually see (own + public).
   * Resolved to explicit ids rather than a subquery so the two deletes below target the same set.
   */
  private async matchingCardIds(userId: string, dto: ResetProgressInput): Promise<string[]> {
    const rows = await this.db
      .select({ id: cards.id })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(
        and(
          canSeeSubject(userId),
          dto.subject ? eq(cards.subjectId, dto.subject) : undefined,
          dto.type ? eq(cards.type, dto.type) : undefined,
          dto.cards?.length ? inArray(cards.id, dto.cards) : undefined
        )
      );
    return rows.map((row) => row.id);
  }
}
