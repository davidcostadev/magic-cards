import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { ApiError } from '../../common/errors/api-error';
import { SYSTEM_USER_ID } from '../../common/visibility';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { cards, subjects, users } from '../../db/schema';
import type { CardResponse, CreateCardDto } from '../cards/dto/card.dto';
import type { CreateSubjectDto, SubjectResponse } from '../subjects/dto/subject.dto';

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
        question: dto.question,
        answer: dto.answer,
        hints: dto.hints ?? [],
        tags: dto.tags ?? [],
      })
      .returning();
    return card;
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
