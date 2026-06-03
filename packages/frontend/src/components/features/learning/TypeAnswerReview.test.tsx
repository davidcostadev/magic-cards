import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Card } from '@/api/queries/cards';
import { TypeAnswerReview } from './TypeAnswerReview';

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
  type: 'type-answer',
  language: 'en',
  question: 'Utility type?',
  answer: '',
  hints: [],
  tags: [],
  createdAt: '',
  updatedAt: '',
} as Card;

describe('TypeAnswerReview', () => {
  it('submits the typed text and reveals the correct answer when wrong', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      correct: false,
      correctText: 'Partial',
      explanation: 'Makes props optional',
    });
    const onAdvance = vi.fn();
    render(
      <TypeAnswerReview
        card={card}
        currentIndex={0}
        totalCards={1}
        dailyGoalProgress={0}
        dailyGoal={20}
        onSubmit={onSubmit}
        onAdvance={onAdvance}
      />
    );

    await userEvent.type(screen.getByLabelText('learn.typeYourAnswer'), 'Pick');
    await userEvent.click(screen.getByRole('button', { name: /learn\.checkAnswer/ }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ response: { type: 'type-answer', text: 'Pick' } })
    );
    // The accepted answer is revealed by the server, not known to the client.
    expect(await screen.findByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('Makes props optional')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /learn\.nextCard/ }));
    expect(onAdvance).toHaveBeenCalledWith(false);
  });
});
