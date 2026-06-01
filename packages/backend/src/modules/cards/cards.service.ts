import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { cursorWhere } from '../../common/pagination';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { cards, subjects } from '../../db/schema';
import type { CardListQuery, CardResponse, CreateCardDto, UpdateCardDto } from './dto/card.dto';

@Injectable()
export class CardsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Lists cards in a subject the user owns (newest first). 404 if not their subject. */
  async list(
    userId: string,
    query: CardListQuery
  ): Promise<{ rows: CardResponse[]; limit: number }> {
    await this.assertSubjectOwned(userId, query.subject);
    const rows = await this.db
      .select()
      .from(cards)
      .where(and(eq(cards.subjectId, query.subject), cursorWhere(cards.id, query)))
      .orderBy(desc(cards.id))
      .limit(query.limit + 1);
    return { rows, limit: query.limit };
  }

  async create(userId: string, dto: CreateCardDto): Promise<CardResponse> {
    await this.assertSubjectOwned(userId, dto.subjectId);
    const [card] = await this.db
      .insert(cards)
      .values({
        subjectId: dto.subjectId,
        question: dto.question,
        answer: dto.answer,
        hints: dto.hints ?? [],
        tags: dto.tags ?? [],
      })
      .returning();
    return card;
  }

  async get(userId: string, id: string): Promise<CardResponse> {
    const [card] = await this.db
      .select(getTableColumns(cards))
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cards.id, id), eq(subjects.userId, userId)))
      .limit(1);
    if (!card) throw ApiError.notFound('cards.notFound');
    return card;
  }

  async update(userId: string, id: string, dto: UpdateCardDto): Promise<CardResponse> {
    await this.get(userId, id); // ownership check (throws 404 if not owned)
    await this.db
      .update(cards)
      .set({ ...dto, updatedAt: new Date().toISOString() })
      .where(eq(cards.id, id));
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.get(userId, id);
    await this.db.delete(cards).where(eq(cards.id, id));
  }

  private async assertSubjectOwned(userId: string, subjectId: string): Promise<void> {
    const [owned] = await this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
      .limit(1);
    if (!owned) throw ApiError.notFound('subjects.notFound');
  }
}
