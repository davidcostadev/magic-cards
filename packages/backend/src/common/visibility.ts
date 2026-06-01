import { eq, or, type SQL } from 'drizzle-orm';
import { subjects } from '../db/schema';

/** Fixed id of the system user that owns all public (catalog) content. */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/** Subjects the user owns — used for mutations (public content is read-only to users). */
export const ownsSubject = (userId: string): SQL => eq(subjects.userId, userId);

/** Subjects the user can read: their own OR public catalog content. */
export const canSeeSubject = (userId: string): SQL =>
  or(eq(subjects.userId, userId), eq(subjects.isPublic, true)) as SQL;
