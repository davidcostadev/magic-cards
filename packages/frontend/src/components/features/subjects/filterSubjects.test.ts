import { describe, expect, it } from 'vitest';
import type { Subject } from '@/api/queries/subjects';
import { filterSubjects } from './filterSubjects';

const subject = (over: Partial<Subject>): Subject =>
  ({
    id: 'x',
    userId: 'u',
    title: '',
    description: null,
    color: null,
    icon: null,
    isPublic: false,
    cardCount: 0,
    selected: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Subject;

describe('filterSubjects', () => {
  it('returns every subject when the query is blank', () => {
    const subjects = [subject({ id: 'a' }), subject({ id: 'b' })];
    expect(filterSubjects(subjects, '   ')).toHaveLength(2);
  });

  it('matches the title case-insensitively', () => {
    const subjects = [
      subject({ id: 'a', title: 'TypeScript' }),
      subject({ id: 'b', title: 'SQL' }),
    ];
    expect(filterSubjects(subjects, 'script').map((s) => s.id)).toEqual(['a']);
  });

  it('matches the description', () => {
    const subjects = [
      subject({ id: 'a', title: 'A', description: 'All about promises' }),
      subject({ id: 'b', title: 'B', description: null }),
    ];
    expect(filterSubjects(subjects, 'promise').map((s) => s.id)).toEqual(['a']);
  });
});
