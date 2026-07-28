import { render, screen, waitFor } from '@testing-library/react';
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
  language: 'en',
  question: 'Match the languages',
  answer: '',
  hints: [],
  tags: [],
  matchPairs: [
    { left: 'TS', right: 'TypeScript' },
    { left: 'PY', right: 'Python' },
  ],
  createdAt: '',
  updatedAt: '',
} as Card;

describe('MatchReview', () => {
  it('matches pairs by tapping left then right, removing each, then completes the card', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ correct: true, explanation: '' });
    const onAdvance = vi.fn();
    const user = userEvent.setup();
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

    // A correct pair is removed from the board.
    await user.click(screen.getByRole('button', { name: 'TS' }));
    await user.click(screen.getByRole('button', { name: 'TypeScript' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'TS' })).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'PY' }));
    await user.click(screen.getByRole('button', { name: 'Python' }));

    // Matching every pair finalizes the card (all pairs submitted, no mistakes).
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        response: {
          type: 'match',
          pairs: [
            { left: 'TS', right: 'TypeScript' },
            { left: 'PY', right: 'Python' },
          ],
        },
        wasHintUsed: false,
      })
    );

    const next = await screen.findByRole('button', { name: /learn\.nextCard/ });
    await user.click(next);
    expect(onAdvance).toHaveBeenCalledWith(true);
  });

  it('flashes a wrong pair without removing it and counts it as a mistake', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ correct: true, explanation: '' });
    const user = userEvent.setup();
    render(
      <MatchReview
        card={card}
        currentIndex={0}
        totalCards={1}
        dailyGoalProgress={0}
        dailyGoal={20}
        onSubmit={onSubmit}
        onAdvance={vi.fn()}
      />
    );

    // Wrong pairing: TS -> Python. Both tiles stay on the board.
    await user.click(screen.getByRole('button', { name: 'TS' }));
    await user.click(screen.getByRole('button', { name: 'Python' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'TS' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'TS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Python' })).toBeInTheDocument();
  });

  it('surfaces a retry instead of a fake verdict when the submit fails', async () => {
    // Matching every pair finalizes the card. If that submit fails (onSubmit → undefined) the
    // component must not fabricate a verdict (hiding the real pairing the server never sent): it
    // shows an error and a retry that re-submits and grades normally.
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ correct: true, explanation: '' });
    const onAdvance = vi.fn();
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('button', { name: 'TS' }));
    await user.click(screen.getByRole('button', { name: 'TypeScript' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'TS' })).not.toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: 'PY' }));
    await user.click(screen.getByRole('button', { name: 'Python' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());

    // First finalize failed → error + retry shown, no verdict, no advance possible yet.
    expect(await screen.findByText('learn.submitError')).toBeInTheDocument();
    expect(screen.queryByText('learn.incorrect')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /learn\.nextCard/ })).not.toBeInTheDocument();

    // Retrying re-submits the same matched pairs and grades.
    await user.click(screen.getByRole('button', { name: /learn\.retry/ }));
    const next = await screen.findByRole('button', { name: /learn\.nextCard/ });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    await user.click(next);
    expect(onAdvance).toHaveBeenCalledWith(true);
  });
});

describe('MatchReview regions', () => {
  it('names the question region for screen readers', () => {
    render(
      <MatchReview
        card={card}
        currentIndex={0}
        totalCards={1}
        dailyGoalProgress={0}
        dailyGoal={20}
        onSubmit={vi.fn()}
        onAdvance={vi.fn()}
      />
    );

    expect(screen.getByRole('region', { name: 'learn.part.question' })).toBeInTheDocument();
  });
});
