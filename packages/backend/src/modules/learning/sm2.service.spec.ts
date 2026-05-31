import { describe, expect, it } from 'vitest';
import { Sm2Service } from './sm2.service';

const sm2 = new Sm2Service();

describe('Sm2Service.calculateNextReview', () => {
  it('schedules the first successful review at 1 day', () => {
    const result = sm2.calculateNextReview(4, 1, 2.5, 0);
    expect(result).toEqual({ newInterval: 1, newEaseFactor: 2.5, newRepetitions: 1 });
  });

  it('schedules the second successful review at 3 days', () => {
    const result = sm2.calculateNextReview(4, 1, 2.5, 1);
    expect(result).toEqual({ newInterval: 3, newEaseFactor: 2.5, newRepetitions: 2 });
  });

  it('grows the interval by the ease factor from the third review on', () => {
    // round(3 * 2.5) = 8
    const result = sm2.calculateNextReview(4, 3, 2.5, 2);
    expect(result.newInterval).toBe(8);
    expect(result.newRepetitions).toBe(3);
    expect(result.newEaseFactor).toBeCloseTo(2.5, 5);
  });

  it('raises the ease factor for an "easy" (quality 5) review', () => {
    const result = sm2.calculateNextReview(5, 8, 2.5, 3);
    expect(result.newEaseFactor).toBeCloseTo(2.6, 5);
    expect(result.newInterval).toBe(Math.round(8 * 2.6)); // 21
    expect(result.newRepetitions).toBe(4);
  });

  it('lowers the ease factor for a "hard" (quality 3) review', () => {
    const result = sm2.calculateNextReview(3, 6, 2.5, 2);
    expect(result.newEaseFactor).toBeCloseTo(2.36, 5);
    expect(result.newInterval).toBe(Math.round(6 * 2.36)); // 14
  });

  it('resets to a 1-day interval and 0 repetitions on a failed review (quality < 3)', () => {
    const result = sm2.calculateNextReview(1, 30, 2.5, 5);
    expect(result.newInterval).toBe(1);
    expect(result.newRepetitions).toBe(0);
    expect(result.newEaseFactor).toBeCloseTo(1.96, 5); // 2.5 - 0.54
  });

  it('never lets the ease factor fall below the 1.3 floor', () => {
    const result = sm2.calculateNextReview(1, 1, 1.3, 0);
    expect(result.newEaseFactor).toBe(1.3);
  });
});

describe('Sm2Service.applyHintCap', () => {
  it('caps quality at 3 when a hint was used', () => {
    expect(sm2.applyHintCap(5, true)).toBe(3);
    expect(sm2.applyHintCap(4, true)).toBe(3);
    expect(sm2.applyHintCap(3, true)).toBe(3);
  });

  it('leaves quality untouched when no hint was used', () => {
    expect(sm2.applyHintCap(5, false)).toBe(5);
    expect(sm2.applyHintCap(1, false)).toBe(1);
  });

  it('does not raise a low quality even when a hint was used', () => {
    expect(sm2.applyHintCap(1, true)).toBe(1);
  });
});

describe('Sm2Service.deriveStatus', () => {
  it('is "new" with zero repetitions', () => {
    expect(sm2.deriveStatus(0, 1, 2.5)).toBe('new');
  });

  it('is "learning" for the first few short-interval repetitions', () => {
    expect(sm2.deriveStatus(1, 1, 2.5)).toBe('learning');
    expect(sm2.deriveStatus(3, 6, 2.4)).toBe('learning');
  });

  it('is "reviewing" once intervals stabilise', () => {
    expect(sm2.deriveStatus(4, 10, 2.4)).toBe('reviewing');
    expect(sm2.deriveStatus(3, 8, 2.5)).toBe('reviewing'); // interval >= 7
  });

  it('is "mastered" with a long interval and high ease', () => {
    expect(sm2.deriveStatus(5, 30, 2.5)).toBe('mastered');
  });

  it('is not "mastered" when the ease factor is low despite a long interval', () => {
    expect(sm2.deriveStatus(6, 25, 1.9)).toBe('reviewing');
  });
});
