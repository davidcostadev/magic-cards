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

  it('reveals the next hint with the H keyboard shortcut and flags the submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      correct: false,
      correctChoiceId: 'b',
      explanation: '',
    });
    const onAdvance = vi.fn();
    render(
      <QuizReview
        card={{ ...card, hints: ['Think about descriptor defaults'] }}
        currentIndex={0}
        totalCards={1}
        dailyGoalProgress={0}
        dailyGoal={20}
        onSubmit={onSubmit}
        onAdvance={onAdvance}
      />
    );

    expect(screen.queryByText('Think about descriptor defaults')).not.toBeInTheDocument();

    await userEvent.keyboard('h');

    expect(screen.getByText('Think about descriptor defaults')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Alpha'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ wasHintUsed: true }));
  });

  it('reveals the answer without a pick via the Reveal button (submits an empty choice)', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      correct: false,
      correctChoiceId: 'b',
      explanation: 'Beta is right',
    });
    const onAdvance = vi.fn();
    renderQuiz(onSubmit, onAdvance);

    await userEvent.click(screen.getByRole('button', { name: /learn\.revealAnswer/ }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ response: { type: 'quiz', choiceId: '' }, wasHintUsed: false })
    );
    expect(await screen.findByText('learn.incorrect')).toBeInTheDocument();
    expect(screen.getByText('Beta is right')).toBeInTheDocument();
  });

  it('reveals the answer with the Enter shortcut when no choice is focused', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      correct: false,
      correctChoiceId: 'b',
      explanation: '',
    });
    renderQuiz(onSubmit, vi.fn());

    await userEvent.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ response: { type: 'quiz', choiceId: '' } })
    );
  });

  it('renders inline Markdown in choices so backticked code shows as <code>', () => {
    render(
      <QuizReview
        card={{
          ...card,
          choices: [
            { id: 'a', text: "`String('hello')`" },
            { id: 'b', text: 'plain text' },
          ],
        }}
        currentIndex={0}
        totalCards={1}
        dailyGoalProgress={0}
        dailyGoal={20}
        onSubmit={vi.fn()}
        onAdvance={vi.fn()}
      />
    );

    const code = screen.getByText("String('hello')");
    expect(code.tagName).toBe('CODE');
    // The backticks themselves must not leak into the rendered label.
    expect(screen.queryByText(/`/)).not.toBeInTheDocument();
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
