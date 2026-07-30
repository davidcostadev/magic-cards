import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { listResponseSchema } from '../../../common/pagination';

export const statsQuerySchema = z.object({
  period: z.enum(['7d', '30d']).optional(),
});

export const weakCardsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const cardsByStatusSchema = z.object({
  new: z.number(),
  learning: z.number(),
  reviewing: z.number(),
  mastered: z.number(),
});

export const dashboardStatsSchema = z.object({
  reviewedToday: z.number(),
  dailyGoal: z.number(),
  streak: z.number(),
  accuracy7d: z.number(),
  accuracy30d: z.number(),
  cardsByStatus: cardsByStatusSchema,
});

export const timelineQuerySchema = z.object({
  subject: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(90).default(30),
});

export const studySessionSchema = z.object({
  startedAt: z.string(),
  endedAt: z.string(),
  reviews: z.number(),
  correct: z.number(),
  accuracy: z.number(),
  mastered: z.number(),
});

export const weakCardSchema = z.object({
  id: z.string(),
  question: z.string(),
  easeFactor: z.number(),
  subjectId: z.string(),
  subjectTitle: z.string(),
});

export const upcomingSchema = z.object({
  today: z.number(),
  tomorrow: z.number(),
  thisWeek: z.number(),
});

export class StatsQueryDto extends createZodDto(statsQuerySchema) {}
export class TimelineQueryDto extends createZodDto(timelineQuerySchema) {}
export class StudySessionListDto extends createZodDto(listResponseSchema(studySessionSchema)) {}
export class WeakCardsQueryDto extends createZodDto(weakCardsQuerySchema) {}
export class DashboardStatsDto extends createZodDto(dashboardStatsSchema) {}
export class WeakCardDto extends createZodDto(weakCardSchema) {}
export class WeakCardListDto extends createZodDto(listResponseSchema(weakCardSchema)) {}
export class UpcomingDto extends createZodDto(upcomingSchema) {}

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
export type WeakCard = z.infer<typeof weakCardSchema>;
export type Upcoming = z.infer<typeof upcomingSchema>;
