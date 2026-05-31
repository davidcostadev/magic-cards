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
  list(userId: string, query: CardListQuery): { rows: CardResponse[]; limit: number } {
    this.assertSubjectOwned(userId, query.subject);
    const rows = this.db
      .select()
      .from(cards)
      .where(and(eq(cards.subjectId, query.subject), cursorWhere(cards.id, query)))
      .orderBy(desc(cards.id))
      .limit(query.limit + 1)
      .all();
    return { rows, limit: query.limit };
  }

  create(userId: string, dto: CreateCardDto): CardResponse {
    this.assertSubjectOwned(userId, dto.subjectId);
    return this.db
      .insert(cards)
      .values({
        subjectId: dto.subjectId,
        question: dto.question,
        answer: dto.answer,
        hints: dto.hints ?? [],
        tags: dto.tags ?? [],
      })
      .returning()
      .get();
  }

  get(userId: string, id: string): CardResponse {
    const card = this.db
      .select(getTableColumns(cards))
      .from(cards)
      .innerJoin(subjects, eq(cards.subjectId, subjects.id))
      .where(and(eq(cards.id, id), eq(subjects.userId, userId)))
      .get();
    if (!card) throw ApiError.notFound('cards.notFound');
    return card;
  }

  update(userId: string, id: string, dto: UpdateCardDto): CardResponse {
    this.get(userId, id); // ownership check (throws 404 if not owned)
    this.db
      .update(cards)
      .set({ ...dto, updatedAt: new Date().toISOString() })
      .where(eq(cards.id, id))
      .run();
    return this.get(userId, id);
  }

  remove(userId: string, id: string): void {
    this.get(userId, id);
    this.db.delete(cards).where(eq(cards.id, id)).run();
  }

  private assertSubjectOwned(userId: string, subjectId: string): void {
    const owned = this.db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
      .get();
    if (!owned) throw ApiError.notFound('subjects.notFound');
  }
}
