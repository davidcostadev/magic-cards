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

/**
 * Build a `ListResponse` from rows fetched with `limit + 1`: the extra row signals
 * `has_more` and is trimmed off before returning.
 */
export function toListResponse<T>(rows: T[], limit: number): ListResponse<T> {
  const hasMore = rows.length > limit;
  return new ListResponse(hasMore ? rows.slice(0, limit) : rows, hasMore);
}
