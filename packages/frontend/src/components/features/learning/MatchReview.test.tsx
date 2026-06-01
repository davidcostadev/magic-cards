import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Card } from '@/api/queries/cards';
import { MatchReview } from './MatchReview';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/context/LearningContext', () => ({
  useLearningSessions: () => ({ updateSessionInfo: vi.fn(), exitRequested: false }),
}));
vi.mock('./MarkdownContent', () => ({
  MarkdownContent: ({ text }: { text: string }) => <div>{text}</div>,
}));

const card = {
  id: 'c1',
  subjectId: 's1',
  type: 'match',
  question: 'Match the languages',
  answer: '',
  hints: [],
  tags: [],
  matchItems: { lefts: ['TS', 'PY'], rights: ['Python', 'TypeScript'] },
  createdAt: '',
  updatedAt: '',
} as Card;

describe('MatchReview', () => {
  it('keeps submit disabled until every left is paired, then submits the pairing', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ correct: true, explanation: '' });
    const onAdvance = vi.fn();
    render(
      <MatchReview
        card={card}
        currentIndex={0}
        totalCards={1}
        dailyGoalProgress={0}
        dailyGoal={20}
        onSubmit={onSubmit}
        onAdvance={onAdvance}
      />
    );

    const submit = screen.getByRole('button', { name: /learn\.checkAnswer/ });
    expect(submit).toBeDisabled();

    // Pair TS→TypeScript and PY→Python.
    await userEvent.click(screen.getByRole('button', { name: 'TS' }));
    await userEvent.click(screen.getByRole('button', { name: 'TypeScript' }));
    await userEvent.click(screen.getByRole('button', { name: 'PY' }));
    await userEvent.click(screen.getByRole('button', { name: 'Python' }));

    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        response: {
          type: 'match',
          pairs: [
            { left: 'TS', right: 'TypeScript' },
            { left: 'PY', right: 'Python' },
          ],
        },
      })
    );

    expect(await screen.findByText('learn.allMatched')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /learn\.nextCard/ }));
    expect(onAdvance).toHaveBeenCalledWith(true);
  });
});
