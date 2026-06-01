import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lt, type SQL, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { cardProgress, cards, reviewHistory, subjects, users } from '../../db/schema';
import type { DashboardStats, Upcoming, WeakCard } from './dto/dashboard.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAILY_GOAL = 20;
const STREAK_LOOKBACK_DAYS = 1000;

/** UTC midnight `offsetDays` from today (negative = past). */
function utcMidnight(offsetDays = 0): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
}

/** `YYYY-MM-DD` (UTC) — matches SQLite `date(reviewed_at)` on ISO 'Z' timestamps. */
function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  getStats(userId: string): DashboardStats {
    const dailyGoal =
      this.db.select({ goal: users.dailyGoal }).from(users).where(eq(users.id, userId)).get()
        ?.goal ?? DEFAULT_DAILY_GOAL;

    const reviewedToday =
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(reviewHistory)
        .where(
          and(
            eq(reviewHistory.userId, userId),
            gte(reviewHistory.reviewedAt, utcMidnight(0).toISOString())
          )
        )
        .get()?.count ?? 0;

    return {
      reviewedToday,
      dailyGoal,
      streak: this.streak(userId, dailyGoal),
      accuracy7d: this.accuracy(userId, 7),
      accuracy30d: this.accuracy(userId, 30),
      cardsByStatus: this.cardsByStatus(userId),
    };
  }

  getWeakCards(userId: string, limit: number): WeakCard[] {
    return this.db
      .select({
        id: cards.id,
        question: cards.question,
        easeFactor: cardProgress.easeFactor,
        subjectId: subjects.id,
        subjectTitle: subjects.title,
      })
      .from(cardProgress)
      .innerJoin(cards, eq(cardProgress.cardId, cards.id))
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(eq(cardProgress.userId, userId))
      .orderBy(asc(cardProgress.easeFactor), desc(cardProgress.lastReviewDate))
      .limit(limit)
      .all();
  }

  getUpcoming(userId: string): Upcoming {
    const startTomorrow = utcMidnight(1).toISOString();
    const endTomorrow = utcMidnight(2).toISOString();
    const endWeek = utcMidnight(7).toISOString();
    const dueCount = (...conditions: SQL[]) =>
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(cardProgress)
        .where(and(eq(cardProgress.userId, userId), ...conditions))
        .get()?.count ?? 0;

    return {
      today: dueCount(lt(cardProgress.nextReviewDate, startTomorrow)),
      tomorrow: dueCount(
        gte(cardProgress.nextReviewDate, startTomorrow),
        lt(cardProgress.nextReviewDate, endTomorrow)
      ),
      thisWeek: dueCount(lt(cardProgress.nextReviewDate, endWeek)),
    };
  }

  /** Accuracy = % of reviews with quality ≥ 3 in the last `days` days. */
  private accuracy(userId: string, days: number): number {
    const sinceIso = new Date(Date.now() - days * DAY_MS).toISOString();
    const row = this.db
      .select({
        total: sql<number>`count(*)`,
        passed: sql<number>`coalesce(sum(case when ${reviewHistory.quality} >= 3 then 1 else 0 end), 0)`,
      })
      .from(reviewHistory)
      .where(and(eq(reviewHistory.userId, userId), gte(reviewHistory.reviewedAt, sinceIso)))
      .get();
    const total = row?.total ?? 0;
    return total > 0 ? Math.round(((row?.passed ?? 0) / total) * 100) : 0;
  }

  /**
   * Consecutive days (UTC) whose review count met the daily goal. Today counts only
   * if its goal is already met; otherwise the streak ends yesterday (FRD-005).
   */
  private streak(userId: string, dailyGoal: number): number {
    const rows = this.db
      .select({ day: sql<string>`date(${reviewHistory.reviewedAt})`, count: sql<number>`count(*)` })
      .from(reviewHistory)
      .where(eq(reviewHistory.userId, userId))
      .groupBy(sql`date(${reviewHistory.reviewedAt})`)
      .all();
    const counts = new Map(rows.map((r) => [r.day, r.count]));
    const met = (offset: number) => (counts.get(dateKey(utcMidnight(offset))) ?? 0) >= dailyGoal;

    let streak = met(0) ? 1 : 0;
    for (let i = 1; i <= STREAK_LOOKBACK_DAYS; i++) {
      if (!met(-i)) break;
      streak += 1;
    }
    return streak;
  }

  private cardsByStatus(userId: string): DashboardStats['cardsByStatus'] {
    const rows = this.db
      .select({ status: cardProgress.status, count: sql<number>`count(*)` })
      .from(cardProgress)
      .where(eq(cardProgress.userId, userId))
      .groupBy(cardProgress.status)
      .all();

    const result = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
    for (const row of rows) result[row.status] += row.count;

    // Never-reviewed cards (no progress row) are new.
    const totalCards = this.db
      .select({ count: sql<number>`count(*)` })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(eq(subjects.userId, userId))
      .get();
    const withProgress = this.db
      .select({ count: sql<number>`count(*)` })
      .from(cardProgress)
      .where(eq(cardProgress.userId, userId))
      .get();
    result.new += (totalCards?.count ?? 0) - (withProgress?.count ?? 0);

    return result;
  }
}
