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
    const owned = await this.assertSubjectVisible(userId, query.subject);
    const rows = await this.db
      .select()
      .from(cards)
      .where(and(eq(cards.subjectId, query.subject), cursorWhere(cards.id, query)))
      .orderBy(desc(cards.id))
      .limit(query.limit + 1);
    return { rows: rows.map((card) => toCardResponse(card, owned)), limit: query.limit };
  }

  async create(userId: string, dto: CreateCardDto): Promise<CardResponse> {
    await this.assertSubjectOwned(userId, dto.subjectId);
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

  async get(userId: string, id: string): Promise<CardResponse> {
    const card = await this.findVisibleCard(userId, id);
    if (!card) throw ApiError.notFound('cards.notFound');
    return toCardResponse(card.row, card.owned);
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
        question: next.question,
        answer: next.answer ?? '',
        payload: buildPayload(next),
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

  /** Asserts the subject is visible and returns whether the user owns it (for reveal). */
  private async assertSubjectVisible(userId: string, subjectId: string): Promise<boolean> {
    const [subject] = await this.db
      .select({ userId: subjects.userId })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), canSeeSubject(userId)))
      .limit(1);
    if (!subject) throw ApiError.notFound('subjects.notFound');
    return subject.userId === userId;
  }

  private async findVisibleCard(
    userId: string,
    id: string
  ): Promise<{ row: Card; owned: boolean } | null> {
    const [card] = await this.db
      .select({ card: getTableColumns(cards), ownerId: subjects.userId })
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cards.id, id), canSeeSubject(userId)))
      .limit(1);
    if (!card) return null;
    return { row: card.card, owned: card.ownerId === userId };
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
