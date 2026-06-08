import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { listResponseSchema, paginationQuerySchema } from '../../../common/pagination';
import { REPORT_REASONS, REPORT_SUGGESTIONS } from '../../../db/schema';

const MAX_MESSAGE = 2000;

/** A learner flags a card: why, an optional structured ask, plus an optional free-text note. */
export const createReportSchema = z.object({
  cardId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  // A recurring ask promoted to a pickable option (e.g. "add code examples"); optional.
  suggestion: z.enum(REPORT_SUGGESTIONS).optional(),
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
  suggestion: z.enum(REPORT_SUGGESTIONS).nullable(),
  message: z.string().nullable(),
  // Flipped by the catalog side once the card is fixed; cleared again on re-report.
  resolved: z.boolean(),
  resolvedAt: z.string().nullable(),
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
