import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { cursorWhere, type PaginationQuery } from '../../common/pagination';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { cardProgress, cards, subjects } from '../../db/schema';
import { Sm2Service } from '../learning/sm2.service';
import type {
  CreateSubjectDto,
  SubjectResponse,
  SubjectStats,
  UpdateSubjectDto,
} from './dto/subject.dto';

const cardCountSql = sql<number>`(select count(*) from ${cards} where ${cards.subjectId} = ${subjects.id})`;

@Injectable()
export class SubjectsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly sm2: Sm2Service
  ) {}

  /** Lists the user's subjects (newest first) with on-demand card counts. */
  list(userId: string, query: PaginationQuery): { rows: SubjectResponse[]; limit: number } {
    const rows = this.db
      .select({ ...getTableColumns(subjects), cardCount: cardCountSql })
      .from(subjects)
      .where(and(eq(subjects.userId, userId), cursorWhere(subjects.id, query)))
      .orderBy(desc(subjects.id))
      .limit(query.limit + 1)
      .all();
    return { rows, limit: query.limit };
  }

  create(userId: string, dto: CreateSubjectDto): SubjectResponse {
    const subject = this.db
      .insert(subjects)
      .values({ userId, ...dto })
      .returning()
      .get();
    return { ...subject, cardCount: 0 };
  }

  get(userId: string, id: string): SubjectResponse {
    const subject = this.db
      .select({ ...getTableColumns(subjects), cardCount: cardCountSql })
      .from(subjects)
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
      .get();
    if (!subject) throw ApiError.notFound('subjects.notFound');
    return subject;
  }

  update(userId: string, id: string, dto: UpdateSubjectDto): SubjectResponse {
    this.assertOwned(userId, id);
    this.db
      .update(subjects)
      .set({ ...dto, updatedAt: new Date().toISOString() })
      .where(eq(subjects.id, id))
      .run();
    return this.get(userId, id);
  }

  remove(userId: string, id: string): void {
    this.assertOwned(userId, id);
    // Cascades to cards, cardProgress, and reviewHistory via FK constraints.
    this.db.delete(subjects).where(eq(subjects.id, id)).run();
  }

  stats(userId: string, id: string): SubjectStats {
    this.assertOwned(userId, id);

    const totalCards = this.db
      .select({ value: sql<number>`count(*)` })
      .from(cards)
      .where(eq(cards.subjectId, id))
      .get();

    const progressRows = this.db
      .select({
        interval: cardProgress.interval,
        repetitions: cardProgress.repetitions,
        easeFactor: cardProgress.easeFactor,
        nextReviewDate: cardProgress.nextReviewDate,
      })
      .from(cardProgress)
      .innerJoin(cards, eq(cardProgress.cardId, cards.id))
      .where(and(eq(cards.subjectId, id), eq(cardProgress.userId, userId)))
      .all();

    const now = new Date().toISOString();
    const counts = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
    let due = 0;
    for (const p of progressRows) {
      counts[this.sm2.deriveStatus(p.repetitions, p.interval, p.easeFactor)] += 1;
      if (p.nextReviewDate <= now) due += 1;
    }

    // Cards the user has never reviewed are new and immediately available to study.
    const neverReviewed = (totalCards?.value ?? 0) - progressRows.length;
    counts.new += neverReviewed;
    due += neverReviewed;

    return { totalCards: totalCards?.value ?? 0, ...counts, due };
  }

  private assertOwned(userId: string, id: string): void {
    const owned = this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
      .get();
    if (!owned) throw ApiError.notFound('subjects.notFound');
  }
}
