import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CARD_LANGUAGES, CARD_TYPES } from '../../../db/schema';
import { cardResponseSchema, cardTranslationsSchema } from '../../cards/dto/card.dto';

/**
 * Bulk import/export for the public catalog (authorized by `x-api-key`). The import body
 * uses the same `{ subjects, cards }` shape that export returns, so content round-trips:
 * export → edit the JSON → re-import. An AI can author a JSON file and POST it here.
 *
 * The card fields are validated structurally here; the per-type rules (e.g. a quiz needs
 * exactly one correct choice) are checked per-item by the service so it can report which
 * card failed instead of rejecting the whole batch.
 */

const importSubjectSchema = z.object({
  // Optional stable id: provide it so cards can reference the subject, and so re-importing
  // upserts instead of creating duplicates. Omitted → a new id is generated.
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  // `null` accepted (not just undefined) so an exported document round-trips back through import.
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

const importCardSchema = z.object({
  id: z.string().min(1).optional(),
  subjectId: z.string().min(1),
  type: z.enum(CARD_TYPES).optional(), // defaults to `open` during validation
  // Content language of the card; defaults to 'en' when omitted.
  language: z.enum(CARD_LANGUAGES).optional(),
  // Alternate-language versions of question/answer, keyed by language code.
  translations: cardTranslationsSchema.optional(),
  question: z.string().min(1),
  answer: z.string().optional(),
  choices: z
    .array(z.object({ id: z.string().min(1), text: z.string().min(1), isCorrect: z.boolean() }))
    .optional(),
  shortAnswer: z.string().optional(),
  matchPairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional(),
  hints: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const catalogImportSchema = z
  .object({
    subjects: z.array(importSubjectSchema).max(500).optional(),
    cards: z.array(importCardSchema).max(5000).optional(),
  })
  .refine((d) => (d.subjects?.length ?? 0) + (d.cards?.length ?? 0) > 0, {
    message: 'catalog.emptyImport',
  });

const importCountSchema = z.object({ created: z.number(), updated: z.number() });

export const importResultSchema = z.object({
  subjects: importCountSchema,
  cards: importCountSchema,
  // Cards that failed per-type validation or referenced an unknown subject — skipped, not fatal.
  errors: z.array(z.object({ index: z.number(), id: z.string().optional(), error: z.string() })),
});

const exportSubjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

export const catalogExportSchema = z.object({
  subjects: z.array(exportSubjectSchema),
  cards: z.array(cardResponseSchema),
});

export const exportQuerySchema = z.object({ subject: z.string().min(1).optional() });

export class CatalogImportDto extends createZodDto(catalogImportSchema) {}
export class ImportResultDto extends createZodDto(importResultSchema) {}
export class CatalogExportDto extends createZodDto(catalogExportSchema) {}
export class CatalogExportQueryDto extends createZodDto(exportQuerySchema) {}

export type CatalogImportInput = z.infer<typeof catalogImportSchema>;
export type ImportResult = z.infer<typeof importResultSchema>;
export type CatalogExport = z.infer<typeof catalogExportSchema>;
