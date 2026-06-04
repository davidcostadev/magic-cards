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
});

describe('GradingService.nextEliminableChoice (quiz "eliminate" hint)', () => {
  const four: CardChoice[] = [
    { id: 'a', text: 'Wrong', isCorrect: false },
    { id: 'b', text: 'Right', isCorrect: true },
    { id: 'c', text: 'Wrong', isCorrect: false },
    { id: 'd', text: 'Wrong', isCorrect: false },
  ];

  it('returns a wrong choice to eliminate when more than two remain', () => {
    const next = service().nextEliminableChoice(four, []);
    expect(next).toBe('a');
  });

  it('never eliminates the correct choice', () => {
    // Eliminate down to the floor; the survivor set must still contain the correct id.
    const eliminated: string[] = [];
    let next = service().nextEliminableChoice(four, eliminated);
    while (next) {
      expect(next).not.toBe('b');
      eliminated.push(next);
      next = service().nextEliminableChoice(four, eliminated);
    }
    expect(four.length - eliminated.length).toBe(2);
    expect(eliminated).not.toContain('b');
  });

  it('stops (returns null) once only two choices remain — the correct one plus one decoy', () => {
    // Three choices → exactly one elimination is allowed.
    expect(service().nextEliminableChoice(choices, [])).toBe('a');
    expect(service().nextEliminableChoice(choices, ['a'])).toBeNull();
  });

  it('ignores already-eliminated ids it is given and picks the next remaining wrong one', () => {
    expect(service().nextEliminableChoice(four, ['a'])).toBe('c');
  });

  it('ignores ids that are not real choices (and never miscounts them as eliminations)', () => {
    expect(service().nextEliminableChoice(four, ['zzz'])).toBe('a');
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
