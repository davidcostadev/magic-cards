import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { listResponseSchema, paginationQuerySchema } from '../../../common/pagination';
import { REPORT_REASONS } from '../../../db/schema';

const MAX_MESSAGE = 2000;

/** A learner flags a card: why, plus an optional free-text note. */
export const createReportSchema = z.object({
  cardId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  message: z.string().max(MAX_MESSAGE).optional(),
});

/** List the user's own reports, optionally scoped to a single subject. */
export const reportListQuerySchema = paginationQuerySchema.extend({
  subject: z.string().min(1).optional(),
});

export const reportResponseSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  subjectId: z.string(),
  reason: z.enum(REPORT_REASONS),
  message: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class CreateReportDto extends createZodDto(createReportSchema) {}
export class ReportListQueryDto extends createZodDto(reportListQuerySchema) {}
export class ReportResponseDto extends createZodDto(reportResponseSchema) {}
export class ReportListDto extends createZodDto(listResponseSchema(reportResponseSchema)) {}

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ReportListQuery = z.infer<typeof reportListQuerySchema>;
export type ReportResponse = z.infer<typeof reportResponseSchema>;
