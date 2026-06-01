import { describe, expect, it } from 'vitest';
import type { CardChoice, MatchPair } from '../../db/schema';
import { GradingService } from './grading.service';

const service = () => new GradingService();

const choices: CardChoice[] = [
  { id: 'a', text: 'Wrong', isCorrect: false },
  { id: 'b', text: 'Right', isCorrect: true },
  { id: 'c', text: 'Wrong', isCorrect: false },
];

const pairs: MatchPair[] = [
  { left: 'TS', right: 'TypeScript' },
  { left: 'JS', right: 'JavaScript' },
  { left: 'PY', right: 'Python' },
];

describe('GradingService.gradeQuiz', () => {
  it('marks the correct choice as correct and reports the right answer', () => {
    expect(service().gradeQuiz(choices, 'b')).toEqual({ correct: true, correctChoiceId: 'b' });
  });

  it('marks a wrong choice as incorrect but still reports the right answer', () => {
    expect(service().gradeQuiz(choices, 'a')).toEqual({ correct: false, correctChoiceId: 'b' });
  });

  it('treats an unknown choice id as incorrect', () => {
    expect(service().gradeQuiz(choices, 'zzz')).toEqual({ correct: false, correctChoiceId: 'b' });
  });
});

describe('GradingService.gradeTypeAnswer', () => {
  it('accepts an exact match', () => {
    expect(service().gradeTypeAnswer('Partial', 'Partial')).toEqual({
      correct: true,
      correctText: 'Partial',
    });
  });

  it('ignores case, surrounding whitespace, and trailing punctuation', () => {
    expect(service().gradeTypeAnswer('Partial', '  partial. ').correct).toBe(true);
  });

  it('ignores diacritics so "Inválido" matches "invalido"', () => {
    expect(service().gradeTypeAnswer('Inválido', 'invalido').correct).toBe(true);
  });

  it('collapses internal whitespace', () => {
    expect(service().gradeTypeAnswer('hello world', 'hello    world').correct).toBe(true);
  });

  it('rejects a genuinely different answer and reports the expected one', () => {
    expect(service().gradeTypeAnswer('Partial', 'Pick')).toEqual({
      correct: false,
      correctText: 'Partial',
    });
  });
});

describe('GradingService.gradeMatch (all-or-nothing)', () => {
  it('is correct only when every pair matches, regardless of order', () => {
    const submitted: MatchPair[] = [
      { left: 'PY', right: 'Python' },
      { left: 'TS', right: 'TypeScript' },
      { left: 'JS', right: 'JavaScript' },
    ];
    expect(service().gradeMatch(pairs, submitted)).toEqual({ correct: true, correctPairs: pairs });
  });

  it('is incorrect when any single pair is wrong', () => {
    const submitted: MatchPair[] = [
      { left: 'TS', right: 'JavaScript' },
      { left: 'JS', right: 'TypeScript' },
      { left: 'PY', right: 'Python' },
    ];
    expect(service().gradeMatch(pairs, submitted).correct).toBe(false);
  });

  it('is incorrect when a pair is missing', () => {
    const submitted: MatchPair[] = [
      { left: 'TS', right: 'TypeScript' },
      { left: 'JS', right: 'JavaScript' },
    ];
    expect(service().gradeMatch(pairs, submitted).correct).toBe(false);
  });

  it('grades only the first 4 pairs when a card has more (the rest are not shown)', () => {
    const sixPairs: MatchPair[] = [
      { left: 'a', right: '1' },
      { left: 'b', right: '2' },
      { left: 'c', right: '3' },
      { left: 'd', right: '4' },
      { left: 'e', right: '5' },
      { left: 'f', right: '6' },
    ];
    // The learner only ever sees/submits the first 4; matching those is correct.
    const submitted = sixPairs.slice(0, 4);
    const result = service().gradeMatch(sixPairs, submitted);
    expect(result.correct).toBe(true);
    expect(result.correctPairs).toHaveLength(4);
    expect(result.correctPairs.map((p) => p.left)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('GradingService.qualityForCorrectness', () => {
  it('maps a correct answer to SM-2 quality 4 (passing, neutral ease)', () => {
    expect(service().qualityForCorrectness(true)).toBe(4);
  });

  it('maps an incorrect answer to SM-2 quality 2 (lapse, resets interval)', () => {
    expect(service().qualityForCorrectness(false)).toBe(2);
  });
});
