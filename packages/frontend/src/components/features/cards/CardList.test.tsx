import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Card, CardStats } from '@/api/queries/cards';
import { CardList } from './CardList';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// Self-gated, provider-dependent; covered by its own test. Stub it out here.
vi.mock('@/components/features/learning/CardStatsPanel', () => ({
  CardStatsPanel: () => null,
}));

const card = (over: Partial<Card> = {}): Card =>
  ({
    id: 'c1',
    subjectId: 's',
    type: 'open',
    language: 'en',
    question: 'What is a closure?',
    answer: '',
    hints: [],
    tags: [],
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Card;

const stats = (over: Partial<CardStats> = {}): CardStats => ({
  totalReviews: 4,
  correctCount: 1,
  incorrectCount: 3,
  accuracy: 25,
  avgTimeMs: 1000,
  hintedCount: 0,
  easeFactor: 1.7,
  interval: 1,
  repetitions: 1,
  status: 'learning',
  lastReviewDate: '2026-07-01T00:00:00.000Z',
  nextReviewDate: '2026-07-02T00:00:00.000Z',
  ...over,
});

describe('CardList', () => {
  it('opens the view when a card row is clicked', async () => {
    const onView = vi.fn();
    render(
      <CardList cards={[card()]} onView={onView} onEdit={vi.fn()} onDelete={vi.fn()} readOnly />
    );
    await userEvent.click(screen.getByRole('button', { name: /closure/i }));
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  });

  it('hides edit/delete for shared (read-only) content', () => {
    render(
      <CardList cards={[card()]} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} readOnly />
    );
    expect(screen.queryByRole('button', { name: 'common.edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'common.delete' })).toBeNull();
  });

  it('fires edit/delete (not view) from the action buttons when owned', async () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<CardList cards={[card()]} onView={onView} onEdit={onEdit} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: 'common.edit' }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));

    await userEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    expect(onDelete).toHaveBeenCalledWith('c1');

    expect(onView).not.toHaveBeenCalled();
  });

  it('scores each card from the user own stats', () => {
    render(
      <CardList
        cards={[card()]}
        stats={new Map([['c1', stats()]])}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('cards.difficulty.hard')).toBeInTheDocument();
    expect(screen.getByText('cards.scoreAccuracy')).toBeInTheDocument();
    expect(screen.getByText('cards.reviewCount')).toBeInTheDocument();
  });

  it('marks a card with no stats as not studied yet', () => {
    render(
      <CardList
        cards={[card()]}
        stats={new Map()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('cards.notStudied')).toBeInTheDocument();
    expect(screen.queryByText('cards.scoreAccuracy')).toBeNull();
  });

  it('shows no score row at all until the stats have loaded', () => {
    render(<CardList cards={[card()]} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('cards.notStudied')).toBeNull();
  });
});
