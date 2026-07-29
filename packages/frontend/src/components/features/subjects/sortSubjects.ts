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
 * Where a subject with no study history belongs, per ordering.
 *
 * Two kinds of zero are at play. `reviewed` and `mastered` are **counts of progress**: zero of them
 * is a true fact, so a never-opened subject really is the least studied and least mastered one — it
 * trails "most X" and leads "least X". `accuracy` is a **score**: 0% with no reviews means "no data
 * yet", not "answered everything wrong", so it trails in *both* directions rather than topping
 * "weakest first" with a grade the learner never earned.
 *
 * `due` is absent on purpose — never-reviewed cards are legitimately due, so a fresh subject
 * belongs at the top there and needs no special handling.
 */
const UNSTUDIED_RANK: Partial<Record<SubjectSort, 'first' | 'last'>> = {
  progress: 'last',
  leastStudied: 'first',
  mastered: 'last',
  leastMastered: 'first',
  accuracy: 'last',
  weakest: 'last',
};

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

    const unstudiedRank = UNSTUDIED_RANK[sort];
    if (unstudiedRank) {
      const studiedA = pa.totalReviews > 0;
      const studiedB = pb.totalReviews > 0;
      if (studiedA !== studiedB) {
        const aFirst = unstudiedRank === 'first' ? !studiedA : studiedA;
        return aFirst ? -1 : 1;
      }
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
