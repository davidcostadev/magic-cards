import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Card } from '@/api/queries/cards';
import { CardView } from './CardView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/components/features/learning/MarkdownContent', () => ({
  MarkdownContent: ({ text }: { text: string }) => <div>{text}</div>,
}));
// Self-gated, provider-dependent; covered by its own test. Stub it out here.
vi.mock('@/components/features/learning/CardStatsPanel', () => ({
  CardStatsPanel: () => null,
}));

const base = {
  id: 'c1',
  subjectId: 's1',
  language: 'en' as const,
  hints: [] as string[],
  tags: [] as string[],
  createdAt: '',
  updatedAt: '',
};
const make = (over: Partial<Card>): Card => ({ ...base, ...over }) as Card;

describe('CardView', () => {
  it('shows the question and answer of an open card', () => {
    render(
      <CardView
        open
        onOpenChange={vi.fn()}
        card={make({ type: 'open', question: 'Q text', answer: 'A text' })}
      />
    );
    expect(screen.getByText('Q text')).toBeInTheDocument();
    expect(screen.getByText('A text')).toBeInTheDocument();
  });

  it('offers Edit only when the viewer can edit', async () => {
    const onEdit = vi.fn();
    const card = make({ type: 'open', question: 'Q', answer: 'A' });
    const { rerender } = render(<CardView open onOpenChange={vi.fn()} card={card} />);
    expect(screen.queryByRole('button', { name: 'common.edit' })).toBeNull();

    rerender(<CardView open onOpenChange={vi.fn()} canEdit onEdit={onEdit} card={card} />);
    await userEvent.click(screen.getByRole('button', { name: 'common.edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('marks the correct choice of a quiz card', () => {
    render(
      <CardView
        open
        onOpenChange={vi.fn()}
        card={make({
          type: 'quiz',
          question: 'Pick one',
          answer: '',
          choices: [
            { id: 'a', text: 'Alpha', isCorrect: false },
            { id: 'b', text: 'Beta', isCorrect: true },
          ],
        })}
      />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByLabelText('cards.correct')).toBeInTheDocument();
  });

  it('toggles the question/answer between languages', async () => {
    render(
      <CardView
        open
        onOpenChange={vi.fn()}
        card={make({
          type: 'open',
          language: 'en',
          question: 'EN question',
          answer: 'EN answer',
          translations: { pt: { question: 'PT pergunta', answer: 'PT resposta' } },
        })}
      />
    );
    // Starts in the primary language.
    expect(screen.getByText('EN question')).toBeInTheDocument();
    expect(screen.queryByText('PT pergunta')).toBeNull();

    // Toggle to Portuguese.
    await userEvent.click(screen.getByRole('button', { name: /PT/ }));
    expect(screen.getByText('PT pergunta')).toBeInTheDocument();
    expect(screen.getByText('PT resposta')).toBeInTheDocument();
    expect(screen.queryByText('EN question')).toBeNull();
  });

  it('renders match pairs', () => {
    render(
      <CardView
        open
        onOpenChange={vi.fn()}
        card={make({
          type: 'match',
          question: 'Match them',
          answer: '',
          matchPairs: [{ left: 'HTML', right: 'markup' }],
        })}
      />
    );
    expect(screen.getByText('HTML')).toBeInTheDocument();
    expect(screen.getByText('markup')).toBeInTheDocument();
  });
});
