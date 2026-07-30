import { eq, or, type SQL, sql } from 'drizzle-orm';
import { subjects, userSubjects } from '../db/schema';

/** Fixed id of the system user that owns all public (catalog) content. */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/** Subjects the user owns — used for mutations (public content is read-only to users). */
export const ownsSubject = (userId: string): SQL => eq(subjects.userId, userId);

/** Subjects the user can read: their own OR public catalog content. */
export const canSeeSubject = (userId: string): SQL =>
  or(eq(subjects.userId, userId), eq(subjects.isPublic, true)) as SQL;

/**
 * Subjects in the user's list ("My Subjects") — narrower than {@link canSeeSubject}, which also
 * matches the whole public catalog. This is the pool a study session draws from when the learner
 * hasn't picked a single subject: seeing a catalog subject is not the same as studying it.
 *
 * A correlated EXISTS on the aliased `us.*` columns with a qualified `${subjects.id}`, so every
 * column ref stays unambiguous inside drizzle's single-table select builder.
 */
export const isSubjectInMyList = (userId: string): SQL =>
  sql`exists (select 1 from ${userSubjects} us where us.subject_id = ${subjects.id} and us.user_id = ${userId})`;
