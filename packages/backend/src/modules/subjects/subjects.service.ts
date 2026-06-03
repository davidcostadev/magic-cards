import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { cursorWhere, type PaginationQuery } from '../../common/pagination';
import { canSeeSubject } from '../../common/visibility';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { cardProgress, cards, subjects } from '../../db/schema';
import { Sm2Service } from '../learning/sm2.service';
import type {
  CreateSubjectDto,
  SubjectProgress,
  SubjectResponse,
  SubjectStats,
  UpdateSubjectDto,
} from './dto/subject.dto';

// Counted via a LEFT JOIN + GROUP BY rather than a correlated subquery: in drizzle's
// single-table .select() builder, a subquery's column refs render unqualified, so a bare
// `id` binds to cards.id inside the subquery (not subjects.id) and the count is always 0.
// count(cards.id) over the join is 0 when a subject has no cards (the LEFT side is NULL).
// count(*) is bigint (string in pg) — cast to int so it comes back as a number.
const cardCountSql = sql<number>`count(${cards.id})::int`;

@Injectable()
export class SubjectsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly sm2: Sm2Service
  ) {}

  /** Lists the user's subjects (newest first) with on-demand card counts. */
  async list(
    userId: string,
    query: PaginationQuery
  ): Promise<{ rows: SubjectResponse[]; limit: number }> {
    const rows = await this.db
      .select({ ...getTableColumns(subjects), cardCount: cardCountSql })
      .from(subjects)
      .leftJoin(cards, eq(cards.subjectId, subjects.id))
      .where(and(canSeeSubject(userId), cursorWhere(subjects.id, query)))
      .groupBy(subjects.id)
      .orderBy(desc(subjects.id))
      .limit(query.limit + 1);
    return { rows, limit: query.limit };
  }

  async create(userId: string, dto: CreateSubjectDto): Promise<SubjectResponse> {
    const [subject] = await this.db
      .insert(subjects)
      .values({ userId, ...dto })
      .returning();
    return { ...subject, cardCount: 0 };
  }

  async get(userId: string, id: string): Promise<SubjectResponse> {
    const [subject] = await this.db
      .select({ ...getTableColumns(subjects), cardCount: cardCountSql })
      .from(subjects)
      .leftJoin(cards, eq(cards.subjectId, subjects.id))
      .where(and(eq(subjects.id, id), canSeeSubject(userId)))
      .groupBy(subjects.id)
      .limit(1);
    if (!subject) throw ApiError.notFound('subjects.notFound');
    return subject;
  }

  async update(userId: string, id: string, dto: UpdateSubjectDto): Promise<SubjectResponse> {
    await this.assertOwned(userId, id);
    await this.db
      .update(subjects)
      .set({ ...dto, updatedAt: new Date().toISOString() })
      .where(eq(subjects.id, id));
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    // Cascades to cards, cardProgress, and reviewHistory via FK constraints.
    await this.db.delete(subjects).where(eq(subjects.id, id));
  }

  async stats(userId: string, id: string): Promise<SubjectStats> {
    await this.assertVisible(userId, id);

    const [totalCards] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(cards)
      .where(eq(cards.subjectId, id));

    const progressRows = await this.db
      .select({
        interval: cardProgress.interval,
        repetitions: cardProgress.repetitions,
        easeFactor: cardProgress.easeFactor,
        nextReviewDate: cardProgress.nextReviewDate,
      })
      .from(cardProgress)
      .innerJoin(cards, eq(cardProgress.cardId, cards.id))
      .where(and(eq(cards.subjectId, id), eq(cardProgress.userId, userId)));

    const now = new Date().toISOString();
    const counts = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
    let due = 0;
    for (const p of progressRows) {
      counts[this.sm2.deriveStatus(p.repetitions, p.interval, p.easeFactor)] += 1;
      if (p.nextReviewDate <= now) due += 1;
    }

    // Cards the user has never reviewed are new and immediately available to study.
    const total = totalCards?.value ?? 0;
    const neverReviewed = total - progressRows.length;
    counts.new += neverReviewed;
    due += neverReviewed;

    return { totalCards: total, ...counts, due };
  }

  /**
   * Per-subject study progress across all the user's visible subjects, in one pass:
   * `total` cards, how many are `reviewed` (have a progress row), and how many are `due`
   * right now (overdue progress + never-reviewed cards). Powers the progress bar on the
   * subjects list without an N+1 of per-subject stat calls. Subjects with no cards are omitted.
   */
  async progressBySubject(userId: string): Promise<SubjectProgress[]> {
    const now = new Date().toISOString();
    const totals = await this.db
      .select({ subjectId: cards.subjectId, total: sql<number>`count(*)::int` })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(canSeeSubject(userId))
      .groupBy(cards.subjectId);

    const seen = await this.db
      .select({
        subjectId: cards.subjectId,
        reviewed: sql<number>`count(*)::int`,
        dueSeen: sql<number>`coalesce(sum(case when ${cardProgress.nextReviewDate} <= ${now} then 1 else 0 end), 0)::int`,
      })
      .from(cardProgress)
      .innerJoin(cards, eq(cardProgress.cardId, cards.id))
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cardProgress.userId, userId), canSeeSubject(userId)))
      .groupBy(cards.subjectId);

    const seenById = new Map(seen.map((s) => [s.subjectId, s]));
    return totals.map((t) => {
      const s = seenById.get(t.subjectId);
      const reviewed = s?.reviewed ?? 0;
      const dueSeen = s?.dueSeen ?? 0;
      // Never-reviewed cards are immediately studyable, so they count as due too.
      return {
        subjectId: t.subjectId,
        total: t.total,
        reviewed,
        due: dueSeen + (t.total - reviewed),
      };
    });
  }

  /** Owner-only (mutations) — public content is read-only to users. */
  private async assertOwned(userId: string, id: string): Promise<void> {
    const [owned] = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
      .limit(1);
    if (!owned) throw ApiError.notFound('subjects.notFound');
  }

  /** Readable by the user — their own or public catalog content. */
  private async assertVisible(userId: string, id: string): Promise<void> {
    const [visible] = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, id), canSeeSubject(userId)))
      .limit(1);
    if (!visible) throw ApiError.notFound('subjects.notFound');
  }
}
