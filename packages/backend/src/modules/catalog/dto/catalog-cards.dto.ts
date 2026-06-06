import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DEFAULT_LIMIT, listResponseSchema, MAX_LIMIT } from '../../../common/pagination';
import { CARD_LANGUAGES, CARD_TYPES, REPORT_REASONS } from '../../../db/schema';
import { cardResponseSchema } from '../../cards/dto/card.dto';

/**
 * Read/search/improve surface for the public catalog, authorized by `x-api-key` (admin/AI),
 * NOT a user JWT. Lets a content operator (or an AI) find cards to fix — by text, type,
 * missing translations, learner reports, or accuracy — and patch them in place.
 */

/** How a catalog card list can be ranked. Ranked sorts page by offset (see the query schema). */
export const CATALOG_SORTS = [
  'newest',
  'most_reported',
  'most_wrong',
  'most_right',
  'most_reviewed',
] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/**
 * A query-string boolean accepting only the literals `'true'`/`'false'`. `z.coerce.boolean()`
 * is a footgun here — it treats any non-empty string as `true`, so `reported=false` → true.
 */
const queryBoolean = z.enum(['true', 'false']).transform((v) => v === 'true');

export const catalogCardQuerySchema = z.object({
  // Scope to one public subject.
  subject: z.string().min(1).optional(),
  type: z.enum(CARD_TYPES).optional(),
  language: z.enum(CARD_LANGUAGES).optional(),
  // Free-text search over question + answer (case-insensitive).
  q: z.string().min(1).optional(),
  // Cards lacking a COMPLETE (question + answer) translation in this language.
  missing_translation: z.enum(CARD_LANGUAGES).optional(),
  // Only cards with at least one report (`true`) or with none (`false`).
  reported: queryBoolean.optional(),
  // Restrict the report filters/counts to one reason.
  report_reason: z.enum(REPORT_REASONS).optional(),
  // Minimum report count — of `report_reason` when set, otherwise of all reports.
  min_reports: z.coerce.number().int().min(1).optional(),
  sort: z.enum(CATALOG_SORTS).default('newest'),
  // Offset pagination (not cursor): ranked sorts can't page by UUIDv7 id. See architecture §6.
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Aggregate signals attached to each catalog card, so the AI can decide what to fix:
 * how learners perform on it (global, across all users), how often it's reported, and which
 * alternate-language translations are complete.
 */
export const cardSignalsSchema = z.object({
  reviewCount: z.number(),
  accuracy: z.number(), // 0–100 (quality ≥ 3 / total); 0 when never reviewed
  avgQuality: z.number(), // mean quality; 0 when never reviewed
  reportCount: z.number(),
  reportsByReason: z.object({
    incorrect: z.number(),
    improvement: z.number(),
  }),
  // Whether a COMPLETE (question + answer) translation exists for each language.
  translations: z.object({
    en: z.boolean(),
    pt: z.boolean(),
  }),
});

export const catalogCardResponseSchema = cardResponseSchema.extend({
  signals: cardSignalsSchema,
});

export const catalogCardListSchema = listResponseSchema(catalogCardResponseSchema);

/** One learner's report on a card — anonymized (no `userId`) for the admin/AI surface. */
export const reportMessageSchema = z.object({
  id: z.string(),
  reason: z.enum(REPORT_REASONS),
  message: z.string().nullable(),
  createdAt: z.string(),
});

export const catalogCardDetailSchema = catalogCardResponseSchema.extend({
  reports: z.array(reportMessageSchema),
});

export class CatalogCardQueryDto extends createZodDto(catalogCardQuerySchema) {}
export class CatalogCardResponseDto extends createZodDto(catalogCardResponseSchema) {}
export class CatalogCardListDto extends createZodDto(catalogCardListSchema) {}
export class CatalogCardDetailDto extends createZodDto(catalogCardDetailSchema) {}

export type CatalogCardQuery = z.infer<typeof catalogCardQuerySchema>;
export type CardSignals = z.infer<typeof cardSignalsSchema>;
export type CatalogCardResponse = z.infer<typeof catalogCardResponseSchema>;
export type CatalogCardDetail = z.infer<typeof catalogCardDetailSchema>;
export type ReportMessage = z.infer<typeof reportMessageSchema>;
