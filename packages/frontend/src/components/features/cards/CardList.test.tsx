import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Card } from '@/api/queries/cards';
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
});
