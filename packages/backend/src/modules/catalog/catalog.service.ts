import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { SYSTEM_USER_ID } from '../../common/visibility';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import {
  type Card,
  type CardLanguage,
  type CardTranslations,
  cardReports,
  cards,
  type ReportReason,
  reviewHistory,
  subjects,
  users,
} from '../../db/schema';
import { buildPayload, mergeCardForValidation, toCardResponse } from '../cards/card-mapper';
import {
  type CardResponse,
  type CreateCardDto,
  createCardSchema,
  type UpdateCardDto,
} from '../cards/dto/card.dto';
import type { CreateSubjectDto, SubjectResponse } from '../subjects/dto/subject.dto';
import type {
  CatalogCardDetail,
  CatalogCardQuery,
  CatalogCardResponse,
  CatalogSort,
} from './dto/catalog-cards.dto';
import type { CatalogExport, CatalogImportInput, ImportResult } from './dto/catalog-io.dto';

// Per-card aggregate signals as correlated scalar subqueries — one value per card, no GROUP BY
// and no join fan-out (mirrors the `exists(...)` pattern in subjects.service). count/sum cast
// ::int (bigint comes back as a string in pg); avg casts ::float (numeric likewise). `quality >= 3`
// is the "right" threshold (CONTEXT.md). `${cards.id}` renders qualified, so it's unambiguous.
const reviewCountSql = sql<number>`(select count(*)::int from ${reviewHistory} rh where rh.card_id = ${cards.id})`;
const accuracySql = sql<number>`(select coalesce(round(100.0 * sum(case when rh.quality >= 3 then 1 else 0 end) / nullif(count(*), 0)), 0)::int from ${reviewHistory} rh where rh.card_id = ${cards.id})`;
const avgQualitySql = sql<number>`(select coalesce(round(avg(rh.quality)::numeric, 2), 0)::float from ${reviewHistory} rh where rh.card_id = ${cards.id})`;
const reportCountSql = sql<number>`(select count(*)::int from ${cardReports} cr where cr.card_id = ${cards.id})`;
const incorrectCountSql = sql<number>`(select coalesce(sum(case when cr.reason = 'incorrect' then 1 else 0 end), 0)::int from ${cardReports} cr where cr.card_id = ${cards.id})`;
const improvementCountSql = sql<number>`(select coalesce(sum(case when cr.reason = 'improvement' then 1 else 0 end), 0)::int from ${cardReports} cr where cr.card_id = ${cards.id})`;

const reasonCountSql = (reason: ReportReason): SQL<number> =>
  reason === 'incorrect' ? incorrectCountSql : improvementCountSql;

/** JS twin of `missingTranslationSql` — drives the per-card `signals.translations` booleans. */
function hasCompleteTranslation(
  translations: CardTranslations | null,
  lang: CardLanguage
): boolean {
  const t = translations?.[lang];
  return !!t && t.question.trim() !== '' && t.answer.trim() !== '';
}

/**
 * True when the card has NO complete (question + answer) alternate translation for `lang`.
 * Branches on the literal lang so no user input is ever built into SQL. Checks the `translations`
 * jsonb only (the primary language lives in the top-level columns). NOTE: a `match` card may have
 * a legitimately empty translated answer; this rule still flags it as missing — acceptable for the
 * open/quiz/type-answer use case. Keep in sync with `hasCompleteTranslation`.
 */
function missingTranslationSql(lang: CardLanguage): SQL {
  const t = cards.translations;
  return lang === 'pt'
    ? sql`(${t} is null or trim(coalesce(${t} #>> '{pt,question}', '')) = '' or trim(coalesce(${t} #>> '{pt,answer}', '')) = '')`
    : sql`(${t} is null or trim(coalesce(${t} #>> '{en,question}', '')) = '' or trim(coalesce(${t} #>> '{en,answer}', '')) = '')`;
}

/**
 * Publishes shared catalog content owned by the system user and visible to everyone.
 * Authorized by the API key (see ApiKeyGuard), not a user JWT.
 */
@Injectable()
export class CatalogService implements OnModuleInit {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  onModuleInit(): Promise<void> {
    return this.ensureSystemUser();
  }

  async createSubject(dto: CreateSubjectDto): Promise<SubjectResponse> {
    await this.ensureSystemUser();
    const [subject] = await this.db
      .insert(subjects)
      .values({ userId: SYSTEM_USER_ID, isPublic: true, ...dto })
      .returning();
    // `selected` is per-user; the catalog (admin) API has no user context, so it's never selected.
    return { ...subject, cardCount: 0, selected: false };
  }

  async createCard(dto: CreateCardDto): Promise<CardResponse> {
    // Catalog cards may only be added to a public catalog subject.
    const [subject] = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, dto.subjectId), eq(subjects.isPublic, true)))
      .limit(1);
    if (!subject) throw ApiError.notFound('subjects.notFound');

    const [card] = await this.db
      .insert(cards)
      .values({
        subjectId: dto.subjectId,
        type: dto.type,
        language: dto.language ?? 'en',
        question: dto.question,
        answer: dto.answer ?? '',
        payload: buildPayload(dto),
        translations: dto.translations ?? null,
        hints: dto.hints ?? [],
        tags: dto.tags ?? [],
      })
      .returning();
    return toCardResponse(card, true);
  }

  /**
   * Bulk import of public content from a `{ subjects, cards }` JSON document. Subjects are
   * upserted (by their id, or created with a fresh one); each card is validated against the
   * per-type rules and upserted. Invalid cards (or cards targeting an unknown subject) are
   * skipped and reported in `errors`, so a good batch isn't lost to one bad card.
   */
  async import(input: CatalogImportInput): Promise<ImportResult> {
    await this.ensureSystemUser();
    const now = new Date().toISOString();
    const result: ImportResult = {
      subjects: { created: 0, updated: 0 },
      cards: { created: 0, updated: 0 },
      errors: [],
    };

    // Cards may target a subject from this batch or one already published.
    const validSubjectIds = new Set<string>();
    const existingPublic = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.isPublic, true), eq(subjects.userId, SYSTEM_USER_ID)));
    for (const s of existingPublic) validSubjectIds.add(s.id);

    const inSubjects = input.subjects ?? [];
    const existingSubjectIds = await this.existingIds(
      subjects.id,
      inSubjects.map((s) => s.id)
    );
    for (const s of inSubjects) {
      const set = {
        title: s.title,
        description: s.description ?? null,
        color: s.color ?? null,
        icon: s.icon ?? null,
        isPublic: true,
        updatedAt: now,
      };
      if (s.id) {
        await this.db
          .insert(subjects)
          .values({ id: s.id, userId: SYSTEM_USER_ID, ...set })
          .onConflictDoUpdate({ target: subjects.id, set });
        existingSubjectIds.has(s.id) ? result.subjects.updated++ : result.subjects.created++;
        validSubjectIds.add(s.id);
      } else {
        const [row] = await this.db
          .insert(subjects)
          .values({ userId: SYSTEM_USER_ID, ...set })
          .returning({ id: subjects.id });
        result.subjects.created++;
        validSubjectIds.add(row.id);
      }
    }

    const inCards = input.cards ?? [];
    const existingCardIds = await this.existingIds(
      cards.id,
      inCards.map((c) => c.id)
    );
    for (let i = 0; i < inCards.length; i++) {
      const c = inCards[i];
      if (!validSubjectIds.has(c.subjectId)) {
        result.errors.push({ index: i, id: c.id, error: 'subjects.notFound' });
        continue;
      }
      const parsed = createCardSchema.safeParse({
        subjectId: c.subjectId,
        type: c.type ?? 'open',
        language: c.language,
        translations: c.translations,
        question: c.question,
        answer: c.answer,
        choices: c.choices,
        shortAnswer: c.shortAnswer,
        matchPairs: c.matchPairs,
        hints: c.hints,
        tags: c.tags,
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const error = issue
          ? `${issue.path.join('.') || 'card'}: ${issue.message}`
          : 'errors.validation';
        result.errors.push({ index: i, id: c.id, error });
        continue;
      }
      const d = parsed.data;
      const set = {
        subjectId: d.subjectId,
        type: d.type,
        language: d.language ?? 'en',
        translations: d.translations ?? null,
        question: d.question,
        answer: d.answer ?? '',
        payload: buildPayload(d),
        hints: d.hints ?? [],
        tags: d.tags ?? [],
        updatedAt: now,
      };
      if (c.id) {
        await this.db
          .insert(cards)
          .values({ id: c.id, ...set })
          .onConflictDoUpdate({ target: cards.id, set });
        existingCardIds.has(c.id) ? result.cards.updated++ : result.cards.created++;
      } else {
        await this.db.insert(cards).values(set);
        result.cards.created++;
      }
    }

    return result;
  }

  /** Exports public content as a `{ subjects, cards }` document (round-trips with import). */
  async export(subjectId?: string): Promise<CatalogExport> {
    const scope = and(
      eq(subjects.isPublic, true),
      eq(subjects.userId, SYSTEM_USER_ID),
      subjectId ? eq(subjects.id, subjectId) : undefined
    );
    const subs = await this.db.select().from(subjects).where(scope).orderBy(asc(subjects.id));
    const subjectIds = subs.map((s) => s.id);
    const cardRows = subjectIds.length
      ? await this.db
          .select(getTableColumns(cards))
          .from(cards)
          .where(inArray(cards.subjectId, subjectIds))
          .orderBy(asc(cards.id))
      : [];
    return {
      subjects: subs.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        color: s.color,
        icon: s.icon,
      })),
      cards: cardRows.map((c) => toCardResponse(c, true)),
    };
  }

  /**
   * Search/filter/rank public catalog cards for the AI/operator, each decorated with aggregate
   * `signals` (global review accuracy, learner reports, translation completeness). Filters: text
   * (`q`), `type`, `language`, `missing_translation`, and report thresholds. Offset pagination —
   * ranked sorts can't page by UUIDv7 id (architecture §6). Always scoped to public/system content.
   */
  async listCards(
    query: CatalogCardQuery
  ): Promise<{ rows: CatalogCardResponse[]; limit: number }> {
    const where: SQL[] = [eq(subjects.isPublic, true), eq(subjects.userId, SYSTEM_USER_ID)];
    if (query.subject) where.push(eq(cards.subjectId, query.subject));
    if (query.type) where.push(eq(cards.type, query.type));
    if (query.language) where.push(eq(cards.language, query.language));
    if (query.q) {
      const term = `%${query.q}%`;
      const match = or(ilike(cards.question, term), ilike(cards.answer, term));
      if (match) where.push(match);
    }
    if (query.missing_translation) where.push(missingTranslationSql(query.missing_translation));

    // Report filters: `reported=false` → none; otherwise a count threshold (on a specific
    // reason when `report_reason` is set, else across all reasons).
    if (query.reported === false) {
      where.push(sql`${reportCountSql} = 0`);
    } else if (
      query.reported === true ||
      query.report_reason !== undefined ||
      query.min_reports !== undefined
    ) {
      const countSql = query.report_reason ? reasonCountSql(query.report_reason) : reportCountSql;
      where.push(sql`${countSql} >= ${query.min_reports ?? 1}`);
    }

    // Accuracy-ranked sorts only make sense over reviewed cards ("most wrong" ≠ "nobody tried it").
    if (query.sort === 'most_wrong' || query.sort === 'most_right') {
      where.push(sql`${reviewCountSql} > 0`);
    }

    const rows = await this.db
      .select({
        ...getTableColumns(cards),
        reviewCount: reviewCountSql,
        accuracy: accuracySql,
        avgQuality: avgQualitySql,
        reportCount: reportCountSql,
        incorrectCount: incorrectCountSql,
        improvementCount: improvementCountSql,
      })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(...where))
      .orderBy(...this.orderFor(query.sort))
      .limit(query.limit + 1)
      .offset(query.offset);

    const result = rows.map((row) => ({
      ...toCardResponse(row, true),
      signals: {
        reviewCount: row.reviewCount,
        accuracy: row.accuracy,
        avgQuality: row.avgQuality,
        reportCount: row.reportCount,
        reportsByReason: { incorrect: row.incorrectCount, improvement: row.improvementCount },
        translations: {
          en: hasCompleteTranslation(row.translations, 'en'),
          pt: hasCompleteTranslation(row.translations, 'pt'),
        },
      },
    }));
    return { rows: result, limit: query.limit };
  }

  /** ORDER BY for each sort. `desc(cards.id)` is the final tiebreaker so offset paging is stable. */
  private orderFor(sort: CatalogSort): SQL[] {
    const tiebreak = desc(cards.id);
    switch (sort) {
      case 'most_reported':
        return [desc(reportCountSql), tiebreak];
      case 'most_reviewed':
        return [desc(reviewCountSql), tiebreak];
      case 'most_wrong':
        return [asc(accuracySql), desc(reviewCountSql), tiebreak];
      case 'most_right':
        return [desc(accuracySql), desc(reviewCountSql), tiebreak];
      default:
        return [tiebreak];
    }
  }

  /**
   * One public catalog card with its aggregate signals AND the actual learner report messages
   * (across all users, anonymized — no userId) so the AI can read *why* a card was flagged before
   * patching it. 404 if the id isn't public/system content.
   */
  async getCardDetail(id: string): Promise<CatalogCardDetail> {
    const card = await this.findPublicCard(id);

    const [agg] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        right: sql<number>`coalesce(sum(case when ${reviewHistory.quality} >= 3 then 1 else 0 end), 0)::int`,
        avgQuality: sql<number>`coalesce(round(avg(${reviewHistory.quality})::numeric, 2), 0)::float`,
      })
      .from(reviewHistory)
      .where(eq(reviewHistory.cardId, id));

    const [rep] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        incorrect: sql<number>`coalesce(sum(case when ${cardReports.reason} = 'incorrect' then 1 else 0 end), 0)::int`,
        improvement: sql<number>`coalesce(sum(case when ${cardReports.reason} = 'improvement' then 1 else 0 end), 0)::int`,
      })
      .from(cardReports)
      .where(eq(cardReports.cardId, id));

    const reports = await this.db
      .select({
        id: cardReports.id,
        reason: cardReports.reason,
        message: cardReports.message,
        createdAt: cardReports.createdAt,
      })
      .from(cardReports)
      .where(eq(cardReports.cardId, id))
      .orderBy(desc(cardReports.id));

    const total = agg?.total ?? 0;
    return {
      ...toCardResponse(card, true),
      signals: {
        reviewCount: total,
        accuracy: total > 0 ? Math.round(((agg?.right ?? 0) / total) * 100) : 0,
        avgQuality: agg?.avgQuality ?? 0,
        reportCount: rep?.total ?? 0,
        reportsByReason: { incorrect: rep?.incorrect ?? 0, improvement: rep?.improvement ?? 0 },
        translations: {
          en: hasCompleteTranslation(card.translations, 'en'),
          pt: hasCompleteTranslation(card.translations, 'pt'),
        },
      },
      reports,
    };
  }

  /**
   * Surgically improve a single public card (add a translation, fix an answer, tweak a choice).
   * Partial edit merged onto the stored card and re-validated against its (immutable) type — the
   * same guard as `CardsService.update`, but scoped to public/system content so the key can never
   * touch a user's card.
   */
  async updateCard(id: string, dto: UpdateCardDto): Promise<CatalogCardDetail> {
    const existing = await this.findPublicCard(id);
    const merged = mergeCardForValidation(existing, dto);
    const parsed = createCardSchema.safeParse(merged);
    if (!parsed.success) {
      throw ApiError.badRequest('errors.validation', parsed.error.issues[0]?.path.join('.'));
    }
    const next = parsed.data;
    await this.db
      .update(cards)
      .set({
        language: next.language ?? existing.language,
        question: next.question,
        answer: next.answer ?? '',
        payload: buildPayload(next),
        ...(dto.translations !== undefined ? { translations: dto.translations } : {}),
        ...(dto.hints !== undefined ? { hints: dto.hints } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(cards.id, id));
    return this.getCardDetail(id);
  }

  /** Loads a card only if it belongs to public/system content; 404 otherwise. */
  private async findPublicCard(id: string): Promise<Card> {
    const [card] = await this.db
      .select(getTableColumns(cards))
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(
        and(eq(cards.id, id), eq(subjects.isPublic, true), eq(subjects.userId, SYSTEM_USER_ID))
      )
      .limit(1);
    if (!card) throw ApiError.notFound('cards.notFound');
    return card;
  }

  /** Set of the given ids that already exist in `column`'s table (for created/updated counts). */
  private async existingIds(
    column: typeof cards.id | typeof subjects.id,
    ids: (string | undefined)[]
  ): Promise<Set<string>> {
    const present = ids.filter((id): id is string => !!id);
    if (present.length === 0) return new Set();
    const rows = await this.db
      .select({ id: column })
      .from(column === cards.id ? cards : subjects)
      .where(inArray(column, present));
    return new Set(rows.map((r) => r.id));
  }

  /** Removes a public catalog subject (and its cards/progress via cascade). */
  async deleteSubject(id: string): Promise<void> {
    // Scoped to public, system-owned content so the key can never delete a user's subject.
    const deleted = await this.db
      .delete(subjects)
      .where(
        and(eq(subjects.id, id), eq(subjects.isPublic, true), eq(subjects.userId, SYSTEM_USER_ID))
      )
      .returning({ id: subjects.id });
    if (deleted.length === 0) throw ApiError.notFound('subjects.notFound');
  }

  /** The system user owns all public content; created once and never logs in. */
  private async ensureSystemUser(): Promise<void> {
    await this.db
      .insert(users)
      .values({
        id: SYSTEM_USER_ID,
        email: 'system@magic-cards.local',
        passwordHash: '!', // unusable hash — the system user cannot authenticate
        username: 'system',
      })
      .onConflictDoNothing();
  }
}
