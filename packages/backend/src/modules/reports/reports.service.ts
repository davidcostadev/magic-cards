import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { cursorWhere } from '../../common/pagination';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { type CardReport, cardReports } from '../../db/schema';
import { CardsService } from '../cards/cards.service';
import type { CreateReportInput, ReportListQuery, ReportResponse } from './dto/report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cards: CardsService
  ) {}

  /**
   * Files a report on any card the user can see (own or public). Re-reporting the same card
   * updates the existing row (unique on user+card), so a learner has at most one open report
   * per card. `CardsService.get` enforces visibility (404 otherwise) and yields the subjectId.
   */
  async create(userId: string, dto: CreateReportInput): Promise<ReportResponse> {
    const card = await this.cards.get(userId, dto.cardId); // 404 if not visible to the user
    const now = new Date().toISOString();
    const [row] = await this.db
      .insert(cardReports)
      .values({
        userId,
        cardId: dto.cardId,
        subjectId: card.subjectId,
        reason: dto.reason,
        message: dto.message ?? null,
      })
      .onConflictDoUpdate({
        target: [cardReports.userId, cardReports.cardId],
        set: { reason: dto.reason, message: dto.message ?? null, updatedAt: now },
      })
      .returning();
    return toReportResponse(row);
  }

  /** Lists the user's own reports (newest first), optionally scoped to one subject. */
  async list(
    userId: string,
    query: ReportListQuery
  ): Promise<{ rows: ReportResponse[]; limit: number }> {
    const rows = await this.db
      .select()
      .from(cardReports)
      .where(
        and(
          eq(cardReports.userId, userId),
          query.subject ? eq(cardReports.subjectId, query.subject) : undefined,
          cursorWhere(cardReports.id, query)
        )
      )
      .orderBy(desc(cardReports.id))
      .limit(query.limit + 1);
    return { rows: rows.map(toReportResponse), limit: query.limit };
  }

  /** Withdraws one of the user's own reports. 404 if it doesn't exist or isn't theirs. */
  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(cardReports)
      .where(and(eq(cardReports.id, id), eq(cardReports.userId, userId)))
      .returning({ id: cardReports.id });
    if (deleted.length === 0) throw ApiError.notFound('reports.notFound');
  }
}

function toReportResponse(row: CardReport): ReportResponse {
  return {
    id: row.id,
    cardId: row.cardId,
    subjectId: row.subjectId,
    reason: row.reason,
    message: row.message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
