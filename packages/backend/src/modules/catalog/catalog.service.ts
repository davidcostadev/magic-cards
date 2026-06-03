import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { and, asc, eq, getTableColumns, inArray } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { SYSTEM_USER_ID } from '../../common/visibility';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { cards, subjects, users } from '../../db/schema';
import { buildPayload, toCardResponse } from '../cards/card-mapper';
import { type CardResponse, type CreateCardDto, createCardSchema } from '../cards/dto/card.dto';
import type { CreateSubjectDto, SubjectResponse } from '../subjects/dto/subject.dto';
import type { CatalogExport, CatalogImportInput, ImportResult } from './dto/catalog-io.dto';

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
    return { ...subject, cardCount: 0 };
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
        question: dto.question,
        answer: dto.answer ?? '',
        payload: buildPayload(dto),
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
