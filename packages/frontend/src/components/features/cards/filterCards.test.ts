import { describe, expect, it } from 'vitest';
import type { Card } from '@/api/queries/cards';
import { filterCards } from './filterCards';

const card = (over: Partial<Card>): Card =>
  ({
    id: 'x',
    subjectId: 's',
    type: 'open',
    question: '',
    answer: '',
    hints: [],
    tags: [],
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Card;

describe('filterCards', () => {
  it('returns every card when the query is blank', () => {
    const cards = [card({ id: 'a' }), card({ id: 'b' })];
    expect(filterCards(cards, '   ')).toHaveLength(2);
  });

  it('matches the question case-insensitively', () => {
    const cards = [
      card({ id: 'a', question: 'What is a Closure?' }),
      card({ id: 'b', question: 'Map vs object' }),
    ];
    expect(filterCards(cards, 'closure').map((c) => c.id)).toEqual(['a']);
  });

  it('matches tags, the answer, and quiz choices', () => {
    const cards = [
      card({ id: 'a', tags: ['async', 'promises'] }),
      card({ id: 'b', answer: 'It returns a Promise' }),
      card({ id: 'c', type: 'quiz', choices: [{ id: '1', text: 'Hoisting' }] }),
    ];
    expect(filterCards(cards, 'promise').map((c) => c.id)).toEqual(['a', 'b']);
    expect(filterCards(cards, 'hoist').map((c) => c.id)).toEqual(['c']);
  });
});
