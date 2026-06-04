import { describe, expect, it } from 'vitest';
import type { Card } from '@/api/queries/cards';
import { advance, currentCard, initSession, isRelearning } from './sessionQueue';

const card = (id: string) => ({ id }) as Card;

describe('sessionQueue', () => {
  it('plays a clean first pass in order and completes', () => {
    let s = initSession([card('a'), card('b')]);
    expect(currentCard(s)?.id).toBe('a');
    s = advance(s, true);
    expect(currentCard(s)?.id).toBe('b');
    s = advance(s, true);
    expect(s.completed).toBe(true);
    expect(s.firstPassCorrect).toBe(2);
  });

  it('requeues a wrong card to the end and only finishes once it is cleared', () => {
    let s = initSession([card('a'), card('b')]);
    s = advance(s, false); // 'a' wrong → requeued to the end
    expect(currentCard(s)?.id).toBe('b');
    expect(s.completed).toBe(false);
    s = advance(s, true); // 'b' correct — but 'a' is still queued
    expect(s.completed).toBe(false);
    expect(currentCard(s)?.id).toBe('a');
    expect(isRelearning(s)).toBe(true);
    s = advance(s, true); // 'a' cleared
    expect(s.completed).toBe(true);
  });

  it('keeps requeuing a card until it is answered correctly', () => {
    let s = initSession([card('a')]);
    s = advance(s, false); // wrong → requeue
    expect(s.completed).toBe(false);
    expect(currentCard(s)?.id).toBe('a');
    s = advance(s, false); // wrong again → requeue
    expect(s.completed).toBe(false);
    s = advance(s, true); // cleared
    expect(s.completed).toBe(true);
  });

  it('counts first-pass accuracy only, ignoring re-practice', () => {
    let s = initSession([card('a'), card('b')]);
    s = advance(s, false); // 'a' wrong on the first pass
    s = advance(s, true); // 'b' right on the first pass
    s = advance(s, true); // 'a' re-practice right → must NOT count
    expect(s.firstPassCorrect).toBe(1);
    expect(s.firstPassLength).toBe(2);
    expect(s.completed).toBe(true);
  });

  it('is not relearning during the first pass', () => {
    let s = initSession([card('a'), card('b')]);
    expect(isRelearning(s)).toBe(false);
    s = advance(s, true);
    expect(isRelearning(s)).toBe(false);
  });

  it('treats an empty deck as already complete', () => {
    const s = initSession([]);
    expect(s.completed).toBe(true);
    expect(currentCard(s)).toBeUndefined();
  });
});
