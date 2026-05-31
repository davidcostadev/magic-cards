import { gt, lt, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ListResponse } from './interceptors/list.interceptor';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Cursor pagination query (Stripe-style). Cursors are resource `id`s; since ids are
 * UUIDv7 (time-sortable) they double as the sort key — no separate cursor column (§6).
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  starting_after: z.string().optional(),
  ending_before: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}

/**
 * Build a `ListResponse` from rows fetched with `limit + 1`: the extra row signals
 * `has_more` and is trimmed off before returning.
 */
export function toListResponse<T>(rows: T[], limit: number): ListResponse<T> {
  const hasMore = rows.length > limit;
  return new ListResponse(hasMore ? rows.slice(0, limit) : rows, hasMore);
}

/**
 * Cursor condition for a list ordered by `id DESC` (newest first). `starting_after`
 * pages forward (older ids), `ending_before` pages backward (newer ids).
 */
export function cursorWhere(idColumn: SQLiteColumn, query: PaginationQuery): SQL | undefined {
  if (query.starting_after) return lt(idColumn, query.starting_after);
  if (query.ending_before) return gt(idColumn, query.ending_before);
  return undefined;
}
