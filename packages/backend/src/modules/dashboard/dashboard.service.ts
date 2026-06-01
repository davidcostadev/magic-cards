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

/** `YYYY-MM-DD` (UTC) — matches `substr(reviewed_at, 1, 10)` on ISO 'Z' timestamps. */
function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// count(*)/sum(...) are bigint (string over the wire) — cast to int for JS numbers.
const countInt = sql<number>`count(*)::int`;

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getStats(userId: string): Promise<DashboardStats> {
    const [user] = await this.db
      .select({ goal: users.dailyGoal })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const dailyGoal = user?.goal ?? DEFAULT_DAILY_GOAL;

    const [today] = await this.db
      .select({ count: countInt })
      .from(reviewHistory)
      .where(
        and(
          eq(reviewHistory.userId, userId),
          gte(reviewHistory.reviewedAt, utcMidnight(0).toISOString())
        )
      );

    const [streak, accuracy7d, accuracy30d, cardsByStatus] = await Promise.all([
      this.streak(userId, dailyGoal),
      this.accuracy(userId, 7),
      this.accuracy(userId, 30),
      this.cardsByStatus(userId),
    ]);

    return {
      reviewedToday: today?.count ?? 0,
      dailyGoal,
      streak,
      accuracy7d,
      accuracy30d,
      cardsByStatus,
    };
  }

  getWeakCards(userId: string, limit: number): Promise<WeakCard[]> {
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
      .limit(limit);
  }

  async getUpcoming(userId: string): Promise<Upcoming> {
    const startTomorrow = utcMidnight(1).toISOString();
    const endTomorrow = utcMidnight(2).toISOString();
    const endWeek = utcMidnight(7).toISOString();
    const dueCount = async (...conditions: SQL[]) => {
      const [row] = await this.db
        .select({ count: countInt })
        .from(cardProgress)
        .where(and(eq(cardProgress.userId, userId), ...conditions));
      return row?.count ?? 0;
    };

    const [today, tomorrow, thisWeek] = await Promise.all([
      dueCount(lt(cardProgress.nextReviewDate, startTomorrow)),
      dueCount(
        gte(cardProgress.nextReviewDate, startTomorrow),
        lt(cardProgress.nextReviewDate, endTomorrow)
      ),
      dueCount(lt(cardProgress.nextReviewDate, endWeek)),
    ]);
    return { today, tomorrow, thisWeek };
  }

  /** Accuracy = % of reviews with quality ≥ 3 in the last `days` days. */
  private async accuracy(userId: string, days: number): Promise<number> {
    const sinceIso = new Date(Date.now() - days * DAY_MS).toISOString();
    const [row] = await this.db
      .select({
        total: countInt,
        passed: sql<number>`coalesce(sum(case when ${reviewHistory.quality} >= 3 then 1 else 0 end), 0)::int`,
      })
      .from(reviewHistory)
      .where(and(eq(reviewHistory.userId, userId), gte(reviewHistory.reviewedAt, sinceIso)));
    const total = row?.total ?? 0;
    return total > 0 ? Math.round(((row?.passed ?? 0) / total) * 100) : 0;
  }

  /**
   * Consecutive days (UTC) whose review count met the daily goal. Today counts only
   * if its goal is already met; otherwise the streak ends yesterday (FRD-005).
   */
  private async streak(userId: string, dailyGoal: number): Promise<number> {
    const dayExpr = sql<string>`substr(${reviewHistory.reviewedAt}, 1, 10)`;
    const rows = await this.db
      .select({ day: dayExpr, count: countInt })
      .from(reviewHistory)
      .where(eq(reviewHistory.userId, userId))
      .groupBy(dayExpr);
    const counts = new Map(rows.map((r) => [r.day, r.count]));
    const met = (offset: number) => (counts.get(dateKey(utcMidnight(offset))) ?? 0) >= dailyGoal;

    let streak = met(0) ? 1 : 0;
    for (let i = 1; i <= STREAK_LOOKBACK_DAYS; i++) {
      if (!met(-i)) break;
      streak += 1;
    }
    return streak;
  }

  private async cardsByStatus(userId: string): Promise<DashboardStats['cardsByStatus']> {
    const [rows, totalCards, withProgress] = await Promise.all([
      this.db
        .select({ status: cardProgress.status, count: countInt })
        .from(cardProgress)
        .where(eq(cardProgress.userId, userId))
        .groupBy(cardProgress.status),
      this.db
        .select({ count: countInt })
        .from(cards)
        .innerJoin(subjects, eq(cards.subjectId, subjects.id))
        .where(eq(subjects.userId, userId)),
      this.db.select({ count: countInt }).from(cardProgress).where(eq(cardProgress.userId, userId)),
    ]);

    const result = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
    for (const row of rows) result[row.status] += row.count;

    // Never-reviewed cards (no progress row) are new.
    result.new += (totalCards[0]?.count ?? 0) - (withProgress[0]?.count ?? 0);
    return result;
  }
}
