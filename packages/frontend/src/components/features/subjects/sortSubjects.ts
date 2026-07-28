import type { Subject, SubjectProgress } from '@/api/queries/subjects';

/** Orderings offered by the subjects grid. `recent` keeps the API order (newest subject first). */
export const SUBJECT_SORTS = [
  'recent',
  'title',
  'due',
  'progress',
  'mastered',
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
 * Sorts the subjects grid by one of `SUBJECT_SORTS`, using the per-subject progress the list
 * already loads. Returns a new array (never mutates). The accuracy orderings put subjects the
 * user hasn't reviewed yet last in both directions — a 0% score they never earned shouldn't
 * top the "weakest first" list. Ties keep the incoming order (stable sort).
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
    switch (sort) {
      case 'due':
        return pb.due - pa.due;
      case 'progress':
        return share(pb.reviewed, pb.total) - share(pa.reviewed, pa.total);
      case 'mastered':
        return share(pb.mastered, pb.total) - share(pa.mastered, pa.total);
      default: {
        // Accuracy is only meaningful once the subject has been studied.
        const studiedA = pa.totalReviews > 0;
        const studiedB = pb.totalReviews > 0;
        if (studiedA !== studiedB) return studiedA ? -1 : 1;
        return sort === 'accuracy' ? pb.accuracy - pa.accuracy : pa.accuracy - pb.accuracy;
      }
    }
  });
}
