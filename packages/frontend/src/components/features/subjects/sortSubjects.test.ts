import { describe, expect, it } from 'vitest';
import type { Subject, SubjectProgress } from '@/api/queries/subjects';
import { SUBJECT_SORTS, sortSubjects } from './sortSubjects';

function subject(id: string, title = id): Subject {
  return {
    id,
    userId: 'u1',
    title,
    description: null,
    color: null,
    icon: null,
    isPublic: false,
    cardCount: 10,
    selected: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function progress(subjectId: string, values: Partial<SubjectProgress>): SubjectProgress {
  return {
    subjectId,
    total: 10,
    reviewed: 0,
    due: 0,
    mastered: 0,
    totalReviews: 0,
    accuracy: 0,
    avgEaseFactor: null,
    ...values,
  };
}

const SUBJECTS = [subject('a', 'Rust'), subject('b', 'Ansible'), subject('c', 'Kafka')];
const PROGRESS = new Map<string, SubjectProgress>([
  ['a', progress('a', { reviewed: 8, due: 1, mastered: 5, totalReviews: 20, accuracy: 90 })],
  ['b', progress('b', { reviewed: 2, due: 7, mastered: 0, totalReviews: 5, accuracy: 40 })],
  ['c', progress('c', { reviewed: 5, due: 3, mastered: 2, totalReviews: 12, accuracy: 65 })],
]);

const ids = (subjects: Subject[]) => subjects.map((s) => s.id);

describe('sortSubjects', () => {
  it('keeps the incoming order for the default sort', () => {
    expect(ids(sortSubjects(SUBJECTS, PROGRESS, 'recent'))).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = [...SUBJECTS];
    sortSubjects(input, PROGRESS, 'title');
    expect(ids(input)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by title, case-insensitively', () => {
    expect(ids(sortSubjects(SUBJECTS, PROGRESS, 'title'))).toEqual(['b', 'c', 'a']);
  });

  it('sorts by how much is due, most first', () => {
    expect(ids(sortSubjects(SUBJECTS, PROGRESS, 'due'))).toEqual(['b', 'c', 'a']);
  });

  it('sorts by share reviewed and share mastered', () => {
    expect(ids(sortSubjects(SUBJECTS, PROGRESS, 'progress'))).toEqual(['a', 'c', 'b']);
    expect(ids(sortSubjects(SUBJECTS, PROGRESS, 'mastered'))).toEqual(['a', 'c', 'b']);
  });

  it('sorts by accuracy in both directions, unstudied subjects last', () => {
    const withUnstudied = [...SUBJECTS, subject('d', 'New')];
    expect(ids(sortSubjects(withUnstudied, PROGRESS, 'accuracy'))).toEqual(['a', 'c', 'b', 'd']);
    expect(ids(sortSubjects(withUnstudied, PROGRESS, 'weakest'))).toEqual(['b', 'c', 'a', 'd']);
  });

  it('puts a never-studied subject last under "most mastered", not first', () => {
    // A subject with a progress row but zero reviews: nothing mastered because nothing was tried.
    // It used to tie at 0% with everyone else and could land first on incoming order alone.
    const withUntouched = [subject('d', 'Untouched'), ...SUBJECTS];
    const progressMap = new Map(PROGRESS).set('d', progress('d', {}));

    expect(ids(sortSubjects(withUntouched, progressMap, 'mastered'))).toEqual(['a', 'c', 'b', 'd']);
    expect(ids(sortSubjects(withUntouched, progressMap, 'progress'))).toEqual(['a', 'c', 'b', 'd']);
  });

  it('sorts by least mastered and least studied, unstudied subjects still last', () => {
    const withUntouched = [...SUBJECTS, subject('d', 'Untouched')];
    const progressMap = new Map(PROGRESS).set('d', progress('d', {}));

    expect(ids(sortSubjects(withUntouched, progressMap, 'leastMastered'))).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
    expect(ids(sortSubjects(withUntouched, progressMap, 'leastStudied'))).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
  });

  it('exposes every sort key it supports', () => {
    expect(SUBJECT_SORTS).toContain('recent');
    expect(SUBJECT_SORTS).toContain('weakest');
  });
});
