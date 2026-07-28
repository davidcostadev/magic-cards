import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { cursorWhere, type PaginationQuery } from '../../common/pagination';
import { canSeeSubject } from '../../common/visibility';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { cardProgress, cards, reviewHistory, subjects, userSubjects } from '../../db/schema';
import { Sm2Service } from '../learning/sm2.service';
import type {
  CreateSubjectDto,
  SubjectCardStats,
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

// Whether the current user has the subject in their list. A correlated EXISTS (rather than a
// second LEFT JOIN) so it can't fan out the `cards` join and inflate cardCount. The aliased
// `us.*` columns and the qualified `${subjects.id}` interpolation keep every ref unambiguous,
// sidestepping the unqualified-subquery-column pitfall noted above for `cardCount`.
const selectedSql = (userId: string) =>
  sql<boolean>`exists(select 1 from ${userSubjects} us where us.subject_id = ${subjects.id} and us.user_id = ${userId})`;

// count(*)/sum(...) are bigint (string over the wire) — cast to int for JS numbers.
const countInt = sql<number>`count(*)::int`;
/** Reviews graded 3+ ("got it right") — the numerator of every accuracy figure. */
const passedInt = sql<number>`coalesce(sum(case when ${reviewHistory.quality} >= 3 then 1 else 0 end), 0)::int`;

/** Whole-percent accuracy, 0 when nothing has been reviewed yet. */
function toAccuracy(passed: number, total: number): number {
  return total > 0 ? Math.round((passed / total) * 100) : 0;
}

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
      .select({
        ...getTableColumns(subjects),
        cardCount: cardCountSql,
        selected: selectedSql(userId),
      })
      .from(subjects)
      .leftJoin(cards, eq(cards.subjectId, subjects.id))
      .where(and(canSeeSubject(userId), cursorWhere(subjects.id, query)))
      .groupBy(subjects.id)
      .orderBy(desc(subjects.id))
      .limit(query.limit + 1);
    return { rows, limit: query.limit };
  }

  async create(userId: string, dto: CreateSubjectDto): Promise<SubjectResponse> {
    // Auto-add the new subject to the creator's list so it shows up in their grid immediately.
    const subject = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(subjects)
        .values({ userId, ...dto })
        .returning();
      await tx.insert(userSubjects).values({ userId, subjectId: created.id }).onConflictDoNothing();
      return created;
    });
    return { ...subject, cardCount: 0, selected: true };
  }

  async get(userId: string, id: string): Promise<SubjectResponse> {
    const [subject] = await this.db
      .select({
        ...getTableColumns(subjects),
        cardCount: cardCountSql,
        selected: selectedSql(userId),
      })
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

    const [reviews] = await this.db
      .select({ total: countInt, passed: passedInt })
      .from(reviewHistory)
      .innerJoin(cards, eq(reviewHistory.cardId, cards.id))
      .where(and(eq(reviewHistory.userId, userId), eq(cards.subjectId, id)));

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

    // Average ease across the cards the user has actually studied — the subject's "difficulty".
    const easeSum = progressRows.reduce((sum, p) => sum + p.easeFactor, 0);
    const avgEaseFactor = progressRows.length > 0 ? easeSum / progressRows.length : null;

    return {
      totalCards: total,
      ...counts,
      due,
      totalReviews: reviews?.total ?? 0,
      accuracy: toAccuracy(reviews?.passed ?? 0, reviews?.total ?? 0),
      avgEaseFactor,
    };
  }

  /**
   * The current user's performance on every card of a subject they have studied, in two queries:
   * review-history aggregates plus the SM-2 scheduler state. Powers the per-card score chips and
   * the "hardest first" ordering on the subject page without an N+1 of `/cards/:id/stats` calls.
   * Cards with neither reviews nor progress are omitted — the caller treats a missing row as new.
   */
  async cardStats(userId: string, id: string): Promise<SubjectCardStats[]> {
    await this.assertVisible(userId, id);

    const [reviewRows, progressRows] = await Promise.all([
      this.db
        .select({
          cardId: reviewHistory.cardId,
          total: countInt,
          correct: passedInt,
          avgTime: sql<number>`coalesce(round(avg(${reviewHistory.timeSpent})), 0)::int`,
          hinted: sql<number>`coalesce(sum(case when ${reviewHistory.wasHintUsed} then 1 else 0 end), 0)::int`,
        })
        .from(reviewHistory)
        .innerJoin(cards, eq(reviewHistory.cardId, cards.id))
        .where(and(eq(reviewHistory.userId, userId), eq(cards.subjectId, id)))
        .groupBy(reviewHistory.cardId),
      this.db
        .select({
          cardId: cardProgress.cardId,
          easeFactor: cardProgress.easeFactor,
          interval: cardProgress.interval,
          repetitions: cardProgress.repetitions,
          status: cardProgress.status,
          lastReviewDate: cardProgress.lastReviewDate,
          nextReviewDate: cardProgress.nextReviewDate,
        })
        .from(cardProgress)
        .innerJoin(cards, eq(cardProgress.cardId, cards.id))
        .where(and(eq(cardProgress.userId, userId), eq(cards.subjectId, id))),
    ]);

    const progressById = new Map(progressRows.map((p) => [p.cardId, p]));
    const reviewsById = new Map(reviewRows.map((r) => [r.cardId, r]));
    const cardIds = [...new Set([...reviewsById.keys(), ...progressById.keys()])].sort();

    return cardIds.map((cardId) => {
      const agg = reviewsById.get(cardId);
      const progress = progressById.get(cardId);
      const total = agg?.total ?? 0;
      const correct = agg?.correct ?? 0;
      return {
        cardId,
        totalReviews: total,
        correctCount: correct,
        incorrectCount: total - correct,
        accuracy: toAccuracy(correct, total),
        avgTimeMs: agg?.avgTime ?? 0,
        hintedCount: agg?.hinted ?? 0,
        easeFactor: progress?.easeFactor ?? null,
        interval: progress?.interval ?? null,
        repetitions: progress?.repetitions ?? null,
        status: progress?.status ?? null,
        lastReviewDate: progress?.lastReviewDate ?? null,
        nextReviewDate: progress?.nextReviewDate ?? null,
      };
    });
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
        mastered: sql<number>`coalesce(sum(case when ${cardProgress.status} = 'mastered' then 1 else 0 end), 0)::int`,
      })
      .from(cardProgress)
      .innerJoin(cards, eq(cardProgress.cardId, cards.id))
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cardProgress.userId, userId), canSeeSubject(userId)))
      .groupBy(cards.subjectId);

    // Review accuracy per subject, so the list can be scored and sorted by how well it's going.
    const graded = await this.db
      .select({ subjectId: cards.subjectId, total: countInt, passed: passedInt })
      .from(reviewHistory)
      .innerJoin(cards, eq(reviewHistory.cardId, cards.id))
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(reviewHistory.userId, userId), canSeeSubject(userId)))
      .groupBy(cards.subjectId);

    const seenById = new Map(seen.map((s) => [s.subjectId, s]));
    const gradedById = new Map(graded.map((g) => [g.subjectId, g]));
    return totals.map((t) => {
      const s = seenById.get(t.subjectId);
      const g = gradedById.get(t.subjectId);
      const reviewed = s?.reviewed ?? 0;
      const dueSeen = s?.dueSeen ?? 0;
      // Never-reviewed cards are immediately studyable, so they count as due too.
      return {
        subjectId: t.subjectId,
        total: t.total,
        reviewed,
        due: dueSeen + (t.total - reviewed),
        mastered: s?.mastered ?? 0,
        totalReviews: g?.total ?? 0,
        accuracy: toAccuracy(g?.passed ?? 0, g?.total ?? 0),
      };
    });
  }

  /** Adds a (visible) subject to the user's list. Idempotent. */
  async selectSubject(userId: string, id: string): Promise<void> {
    await this.assertVisible(userId, id);
    await this.db.insert(userSubjects).values({ userId, subjectId: id }).onConflictDoNothing();
  }

  /** Removes a subject from the user's list. Idempotent (no-op if it wasn't selected). */
  async unselectSubject(userId: string, id: string): Promise<void> {
    await this.assertVisible(userId, id);
    await this.db
      .delete(userSubjects)
      .where(and(eq(userSubjects.userId, userId), eq(userSubjects.subjectId, id)));
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
