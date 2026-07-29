import type { Subject, SubjectProgress } from '@/api/queries/subjects';

/** Orderings offered by the subjects grid. `recent` keeps the API order (newest subject first). */
export const SUBJECT_SORTS = [
  'recent',
  'title',
  'due',
  'progress',
  'leastStudied',
  'mastered',
  'leastMastered',
  'accuracy',
  'weakest',
] as const;

export type SubjectSort = (typeof SUBJECT_SORTS)[number];

/** Study progress per subject, keyed by subject id (missing = no cards / not loaded yet). */
export type SubjectProgressMap = ReadonlyMap<string, SubjectProgress>;

/** Share of a subject's cards in some state, 0 when the subject has no cards. */
function share(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

/**
 * Orderings scored on study history. A subject the user has never reviewed has a 0 it never
 * earned — neither a 0% score nor 0 mastered cards says anything about it — so it sorts last in
 * *both* directions rather than topping "most mastered" on a tie or "least mastered" on a zero.
 * `due` is deliberately absent: never-reviewed cards are legitimately due.
 */
const RANK_UNSTUDIED_LAST: ReadonlySet<SubjectSort> = new Set([
  'progress',
  'leastStudied',
  'mastered',
  'leastMastered',
  'accuracy',
  'weakest',
]);

/**
 * Sorts the subjects grid by one of `SUBJECT_SORTS`, using the per-subject progress the list
 * already loads. Returns a new array (never mutates). Subjects with no study history sort last
 * on every history-based ordering (see `RANK_UNSTUDIED_LAST`). Ties keep the incoming order
 * (stable sort).
 */
export function sortSubjects(
  subjects: Subject[],
  progress: SubjectProgressMap,
  sort: SubjectSort
): Subject[] {
  if (sort === 'recent') return subjects;

  const sorted = [...subjects];
  if (sort === 'title') {
    return sorted.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    );
  }

  return sorted.sort((a, b) => {
    const pa = progress.get(a.id);
    const pb = progress.get(b.id);
    if (!pa || !pb) return pa ? -1 : pb ? 1 : 0;

    if (RANK_UNSTUDIED_LAST.has(sort)) {
      const studiedA = pa.totalReviews > 0;
      const studiedB = pb.totalReviews > 0;
      if (studiedA !== studiedB) return studiedA ? -1 : 1;
    }

    switch (sort) {
      case 'due':
        return pb.due - pa.due;
      case 'progress':
        return share(pb.reviewed, pb.total) - share(pa.reviewed, pa.total);
      case 'leastStudied':
        return share(pa.reviewed, pa.total) - share(pb.reviewed, pb.total);
      case 'mastered':
        return share(pb.mastered, pb.total) - share(pa.mastered, pa.total);
      case 'leastMastered':
        return share(pa.mastered, pa.total) - share(pb.mastered, pb.total);
      case 'accuracy':
        return pb.accuracy - pa.accuracy;
      default:
        return pa.accuracy - pb.accuracy;
    }
  });
}
