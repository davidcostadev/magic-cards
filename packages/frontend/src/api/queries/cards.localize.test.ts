import { describe, expect, it } from 'vitest';
import { type Card, localizeCard, pickTranslation } from './cards';

const card = {
  id: 'c1',
  subjectId: 's1',
  type: 'open',
  language: 'en',
  question: 'What is a closure?',
  answer: 'fn + scope',
  translations: { pt: { question: 'O que é uma closure?', answer: 'função + escopo' } },
  hints: [],
  tags: [],
  createdAt: '',
  updatedAt: '',
} as unknown as Card;

describe('localizeCard', () => {
  it('returns the pt translation when the card language is pt', () => {
    expect(localizeCard(card, 'pt')).toEqual({
      question: 'O que é uma closure?',
      answer: 'função + escopo',
    });
  });

  it('falls back to the primary for "all"', () => {
    expect(localizeCard(card, 'all')).toEqual({
      question: 'What is a closure?',
      answer: 'fn + scope',
    });
  });

  it('falls back to the primary when the chosen language is the card primary', () => {
    expect(localizeCard(card, 'en').question).toBe('What is a closure?');
  });

  it('falls back to the primary when there is no translation', () => {
    const noTr = { ...card, translations: undefined } as unknown as Card;
    expect(localizeCard(noTr, 'pt').question).toBe('What is a closure?');
  });

  it('falls back per-field when a translated field is blank (study payload blanks answers)', () => {
    const blank = {
      ...card,
      translations: { pt: { question: 'O que é uma closure?', answer: '' } },
    } as unknown as Card;
    expect(localizeCard(blank, 'pt')).toEqual({
      question: 'O que é uma closure?',
      answer: 'fn + scope',
    });
  });
});

describe('pickTranslation', () => {
  it('returns undefined for "all", the primary, or a missing translation', () => {
    expect(pickTranslation(card.translations, 'all')).toBeUndefined();
    expect(pickTranslation(card.translations, 'en', 'en')).toBeUndefined();
    expect(pickTranslation(undefined, 'pt')).toBeUndefined();
  });

  it('returns the entry for a present language (works for a grade too)', () => {
    expect(pickTranslation(card.translations, 'pt')?.answer).toBe('função + escopo');
  });
});
