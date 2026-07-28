import { describe, expect, it } from 'vitest';
import type { Card, CardStats } from '@/api/queries/cards';
import { CARD_SORTS, cardDifficulty, sortCards } from './sortCards';

function card(id: string, question = id): Card {
  return {
    id,
    subjectId: 's1',
    type: 'open',
    language: 'en',
    question,
    answer: 'a',
    hints: [],
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as Card;
}

function stats(values: Partial<CardStats>): CardStats {
  return {
    totalReviews: 1,
    correctCount: 1,
    incorrectCount: 0,
    accuracy: 100,
    avgTimeMs: 1000,
    hintedCount: 0,
    easeFactor: 2.5,
    interval: 5,
    repetitions: 2,
    status: 'reviewing',
    lastReviewDate: '2026-01-01T00:00:00.000Z',
    nextReviewDate: '2026-02-01T00:00:00.000Z',
    ...values,
  };
}

const CARDS = [card('a'), card('b'), card('c'), card('d')];
const STATS = new Map<string, CardStats>([
  ['a', stats({ accuracy: 90, easeFactor: 2.6, totalReviews: 4, lastReviewDate: '2026-03-01' })],
  ['b', stats({ accuracy: 40, easeFactor: 1.8, totalReviews: 9, lastReviewDate: '2026-01-05' })],
  ['c', stats({ accuracy: 70, easeFactor: 2.2, totalReviews: 2, lastReviewDate: '2026-05-01' })],
  // 'd' has never been studied — no stats row at all.
]);

const ids = (cards: Card[]) => cards.map((c) => c.id);

describe('sortCards', () => {
  it('keeps the incoming order for the default sort', () => {
    expect(ids(sortCards(CARDS, STATS, 'recent'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not mutate the input array', () => {
    const input = [...CARDS];
    sortCards(input, STATS, 'hardest');
    expect(ids(input)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts the worst-scoring cards first for "hardest", never-studied ones last', () => {
    expect(ids(sortCards(CARDS, STATS, 'hardest'))).toEqual(['b', 'c', 'a', 'd']);
  });

  it('puts the best-scoring cards first for "easiest", never-studied ones last', () => {
    expect(ids(sortCards(CARDS, STATS, 'easiest'))).toEqual(['a', 'c', 'b', 'd']);
  });

  it('sorts by review count, then by most recently studied', () => {
    expect(ids(sortCards(CARDS, STATS, 'mostReviewed'))).toEqual(['b', 'a', 'c', 'd']);
    expect(ids(sortCards(CARDS, STATS, 'lastReviewed'))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('sorts alphabetically by question', () => {
    const shuffled = [card('2', 'Zebra'), card('1', 'apple'), card('3', 'Mango')];
    expect(ids(sortCards(shuffled, STATS, 'alphabetical'))).toEqual(['1', '3', '2']);
  });

  it('breaks ties on equal accuracy with the lower ease factor', () => {
    const tied = new Map<string, CardStats>([
      ['a', stats({ accuracy: 50, easeFactor: 2.4 })],
      ['b', stats({ accuracy: 50, easeFactor: 1.5 })],
    ]);
    expect(ids(sortCards([card('a'), card('b')], tied, 'hardest'))).toEqual(['b', 'a']);
  });

  it('exposes every sort key it supports', () => {
    expect(CARD_SORTS).toContain('recent');
    expect(CARD_SORTS).toContain('hardest');
  });
});

describe('cardDifficulty', () => {
  it('is null until the card has been reviewed', () => {
    expect(cardDifficulty(undefined)).toBeNull();
    expect(cardDifficulty(stats({ totalReviews: 0 }))).toBeNull();
  });

  it('labels low accuracy or a low ease factor as hard', () => {
    expect(cardDifficulty(stats({ accuracy: 40, easeFactor: 2.5 }))).toBe('hard');
    expect(cardDifficulty(stats({ accuracy: 90, easeFactor: 1.6 }))).toBe('hard');
  });

  it('labels consistently right, high-ease cards as easy', () => {
    expect(cardDifficulty(stats({ accuracy: 95, easeFactor: 2.6 }))).toBe('easy');
  });

  it('labels everything in between as medium', () => {
    expect(cardDifficulty(stats({ accuracy: 75, easeFactor: 2.3 }))).toBe('medium');
  });
});
