import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { cursorWhere } from '../../common/pagination';
import { canSeeSubject } from '../../common/visibility';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { type Card, cards, subjects } from '../../db/schema';
import { buildPayload, toCardResponse } from './card-mapper';
import {
  type CardListQuery,
  type CardResponse,
  type CreateCardDto,
  createCardSchema,
  type UpdateCardDto,
} from './dto/card.dto';

@Injectable()
export class CardsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Lists cards in a subject the user can see — own or public (newest first). */
  async list(
    userId: string,
    query: CardListQuery
  ): Promise<{ rows: CardResponse[]; limit: number }> {
    await this.assertSubjectVisible(userId, query.subject);
    const rows = await this.db
      .select()
      .from(cards)
      .where(and(eq(cards.subjectId, query.subject), cursorWhere(cards.id, query)))
      .orderBy(desc(cards.id))
      .limit(query.limit + 1);
    // Browse/management view: reveal full content for anything the user may see — their own
    // cards or shared public catalog content. The study queue is sanitized separately in
    // LearningService, so revealing here never leaks answers into a review session.
    return { rows: rows.map((card) => toCardResponse(card, true)), limit: query.limit };
  }

  async create(userId: string, dto: CreateCardDto): Promise<CardResponse> {
    await this.assertSubjectOwned(userId, dto.subjectId);
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

  async get(userId: string, id: string): Promise<CardResponse> {
    const row = await this.findVisibleCard(userId, id);
    if (!row) throw ApiError.notFound('cards.notFound');
    // Same as list(): full reveal for any visible card; edits stay owner-only (update/remove).
    return toCardResponse(row, true);
  }

  async update(userId: string, id: string, dto: UpdateCardDto): Promise<CardResponse> {
    const existing = await this.findOwnedCard(userId, id); // only the owner can edit
    if (!existing) throw ApiError.notFound('cards.notFound');

    // Re-validate the merged card against its (immutable) type so a partial edit can't
    // leave it in an invalid shape (e.g. a quiz with no correct choice).
    const merged = this.mergeForValidation(existing, dto);
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
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const owned = await this.findOwnedCard(userId, id);
    if (!owned) throw ApiError.notFound('cards.notFound');
    await this.db.delete(cards).where(eq(cards.id, id));
  }

  /** Reconstructs a full create-shaped input from the stored card plus the partial edit. */
  private mergeForValidation(card: Card, dto: UpdateCardDto) {
    const payload = card.payload;
    return {
      subjectId: card.subjectId,
      type: card.type,
      language: dto.language ?? card.language,
      translations: dto.translations ?? card.translations ?? undefined,
      question: dto.question ?? card.question,
      answer: dto.answer ?? card.answer,
      choices: dto.choices ?? (payload && 'choices' in payload ? payload.choices : undefined),
      shortAnswer:
        dto.shortAnswer ?? (payload && 'shortAnswer' in payload ? payload.shortAnswer : undefined),
      matchPairs:
        dto.matchPairs ?? (payload && 'matchPairs' in payload ? payload.matchPairs : undefined),
      hints: dto.hints ?? card.hints,
      tags: dto.tags ?? card.tags,
    };
  }

  /** Card create targets an owned subject (users can't add cards to public content). */
  private async assertSubjectOwned(userId: string, subjectId: string): Promise<void> {
    const [owned] = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
      .limit(1);
    if (!owned) throw ApiError.notFound('subjects.notFound');
  }

  /** Asserts the subject exists and is visible to the user (their own or public). */
  private async assertSubjectVisible(userId: string, subjectId: string): Promise<void> {
    const [subject] = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), canSeeSubject(userId)))
      .limit(1);
    if (!subject) throw ApiError.notFound('subjects.notFound');
  }

  private async findVisibleCard(userId: string, id: string): Promise<Card | null> {
    const [card] = await this.db
      .select(getTableColumns(cards))
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cards.id, id), canSeeSubject(userId)))
      .limit(1);
    return card ?? null;
  }

  private async findOwnedCard(userId: string, id: string): Promise<Card | null> {
    const [card] = await this.db
      .select(getTableColumns(cards))
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cards.id, id), eq(subjects.userId, userId)))
      .limit(1);
    return card ?? null;
  }
}
