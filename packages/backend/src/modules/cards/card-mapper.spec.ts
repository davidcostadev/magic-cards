import { describe, expect, it } from 'vitest';
import type { Card } from '../../db/schema';
import { toCardResponse } from './card-mapper';

const quizCard = {
  id: 'c1',
  subjectId: 's1',
  type: 'quiz',
  language: 'en',
  question: 'Q',
  answer: 'because X',
  payload: {
    choices: [
      { id: 'a', text: 'A', isCorrect: true },
      { id: 'b', text: 'B', isCorrect: false },
    ],
  },
  translations: { pt: { question: 'P', answer: 'porque X' } },
  hints: [],
  tags: [],
  createdAt: '',
  updatedAt: '',
} as unknown as Card;

describe('toCardResponse translations', () => {
  it('study payload keeps the question translation but blanks the translated answer (anti-spoiler)', () => {
    const r = toCardResponse(quizCard, false);
    expect(r.translations?.pt?.question).toBe('P');
    expect(r.translations?.pt?.answer).toBe('');
    expect(r.answer).toBe('');
    // grading data is still stripped before the learner answers
    expect((r.choices ?? []).every((c) => c.isCorrect === undefined)).toBe(true);
  });

  it('reveal payload includes the full answer translation', () => {
    const r = toCardResponse(quizCard, true);
    expect(r.translations?.pt?.answer).toBe('porque X');
    expect(r.answer).toBe('because X');
  });

  it('open card ships full translations in the study payload (self-assessed, no spoiler risk)', () => {
    const openCard = {
      ...quizCard,
      type: 'open',
      payload: null,
      answer: 'ans',
      translations: { pt: { question: 'P', answer: 'resp' } },
    } as unknown as Card;
    const r = toCardResponse(openCard, false);
    expect(r.translations?.pt?.answer).toBe('resp');
  });

  it('omits translations entirely when the card has none', () => {
    const noTr = { ...quizCard, translations: null } as unknown as Card;
    expect(toCardResponse(noTr, false).translations).toBeUndefined();
  });
});
