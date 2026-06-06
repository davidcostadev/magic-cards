import type { Subject } from '@/api/queries/subjects';

/**
 * Client-side search over already-loaded subjects. Matches the query (case-insensitive, trimmed)
 * against the title and description. A blank query is a no-op. Selection filtering is handled
 * separately by the caller (`subjects.filter((s) => s.selected)`).
 */
export function filterSubjects(subjects: Subject[], query: string): Subject[] {
  const q = query.trim().toLowerCase();
  if (!q) return subjects;
  return subjects.filter(
    (s) => s.title.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q)
  );
}
