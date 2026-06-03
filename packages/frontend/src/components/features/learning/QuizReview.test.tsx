import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Card } from '@/api/queries/cards';
import { QuizReview } from './QuizReview';
import type { CardReviewProps } from './reviewTypes';

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
  type: 'quiz',
  language: 'en',
  question: 'Pick one',
  answer: '',
  hints: [],
  tags: [],
  choices: [
    { id: 'a', text: 'Alpha' },
    { id: 'b', text: 'Beta' },
  ],
  createdAt: '',
  updatedAt: '',
} as Card;

function renderQuiz(
  onSubmit: CardReviewProps['onSubmit'],
  onAdvance: CardReviewProps['onAdvance']
) {
  render(
    <QuizReview
      card={card}
      currentIndex={0}
      totalCards={1}
      dailyGoalProgress={0}
      dailyGoal={20}
      onSubmit={onSubmit}
      onAdvance={onAdvance}
    />
  );
}

describe('QuizReview', () => {
  it('submits the picked choice and shows server feedback, then advances', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      correct: true,
      correctChoiceId: 'b',
      explanation: 'Beta is right',
    });
    const onAdvance = vi.fn();
    renderQuiz(onSubmit, onAdvance);

    await userEvent.click(screen.getByText('Beta'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ response: { type: 'quiz', choiceId: 'b' }, wasHintUsed: false })
    );

    expect(await screen.findByText('learn.correct')).toBeInTheDocument();
    expect(screen.getByText('Beta is right')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /learn\.nextCard/ }));
    expect(onAdvance).toHaveBeenCalledWith(true);
  });

  it('marks an incorrect pick and advances with correct=false', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      correct: false,
      correctChoiceId: 'b',
      explanation: '',
    });
    const onAdvance = vi.fn();
    renderQuiz(onSubmit, onAdvance);

    await userEvent.click(screen.getByText('Alpha'));
    expect(await screen.findByText('learn.incorrect')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /learn\.nextCard/ }));
    expect(onAdvance).toHaveBeenCalledWith(false);
  });
});
