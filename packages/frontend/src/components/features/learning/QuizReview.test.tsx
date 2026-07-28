import { render, screen, waitFor } from '@testing-library/react';
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

  const threeChoiceCard = {
    ...card,
    choices: [
      { id: 'a', text: 'Alpha' },
      { id: 'b', text: 'Beta' },
      { id: 'c', text: 'Gamma' },
    ],
  } as Card;

  it('eliminates a wrong choice via the H shortcut, disables it, and flags the submission as hinted', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      correct: true,
      correctChoiceId: 'b',
      explanation: '',
    });
    // The server decides which choice is wrong — here it says "a".
    const onEliminate = vi.fn().mockResolvedValue('a');
    render(
      <QuizReview
        card={threeChoiceCard}
        currentIndex={0}
        totalCards={1}
        dailyGoalProgress={0}
        dailyGoal={20}
        onSubmit={onSubmit}
        onAdvance={vi.fn()}
        onEliminate={onEliminate}
      />
    );

    await userEvent.keyboard('h');

    // Asks the server with the ids eliminated so far (none yet) and disables the returned choice.
    expect(onEliminate).toHaveBeenCalledWith([]);
    await waitFor(() => expect(screen.getByText('Alpha').closest('button')).toBeDisabled());

    // Picking the correct choice still works and is flagged as hinted (SM-2 caps the quality).
    await userEvent.click(screen.getByText('Beta'));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ wasHintUsed: true }));
  });

  it('stops offering eliminations once only two choices remain', async () => {
    const onEliminate = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('c');
    render(
      <QuizReview
        card={
          {
            ...card,
            choices: [
              { id: 'a', text: 'Alpha' },
              { id: 'b', text: 'Beta' },
              { id: 'c', text: 'Gamma' },
              { id: 'd', text: 'Delta' },
            ],
          } as Card
        }
        currentIndex={0}
        totalCards={1}
        dailyGoalProgress={0}
        dailyGoal={20}
        onSubmit={vi.fn()}
        onAdvance={vi.fn()}
        onEliminate={onEliminate}
      />
    );

    // 4 choices → at most two eliminations, leaving the answer plus one decoy.
    expect(screen.getByText(/learn\.eliminateChoice/)).toBeInTheDocument();
    await userEvent.keyboard('h');
    await waitFor(() => expect(screen.getByText('Alpha').closest('button')).toBeDisabled());
    await userEvent.keyboard('h');
    await waitFor(() => expect(screen.getByText('Gamma').closest('button')).toBeDisabled());

    expect(onEliminate).toHaveBeenCalledTimes(2);
    expect(onEliminate).toHaveBeenLastCalledWith(['a']);
    // No more eliminations offered: the button greys out (stays mounted so the choices below
    // it don't shift) instead of vanishing, and a third H is a no-op.
    expect(screen.getByText(/learn\.eliminateChoice/).closest('button')).toBeDisabled();
    await userEvent.keyboard('h');
    expect(onEliminate).toHaveBeenCalledTimes(2);
  });

  it('does not offer the eliminate hint when only two choices exist', () => {
    render(
      <QuizReview
        card={card}
        currentIndex={0}
        totalCards={1}
        dailyGoalProgress={0}
        dailyGoal={20}
        onSubmit={vi.fn()}
        onAdvance={vi.fn()}
        onEliminate={vi.fn()}
      />
    );
    expect(screen.queryByText(/learn\.eliminateChoice/)).not.toBeInTheDocument();
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

  it('marks an incorrect pick, highlights the correct choice, and advances with correct=false', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      correct: false,
      correctChoiceId: 'b',
      explanation: '',
    });
    const onAdvance = vi.fn();
    renderQuiz(onSubmit, onAdvance);

    await userEvent.click(screen.getByText('Alpha'));
    expect(await screen.findByText('learn.incorrect')).toBeInTheDocument();
    // The correct choice (server-reported) must be revealed as correct — a Check icon, not the
    // shortcut number — so the learner sees the right answer after a wrong pick.
    const correct = screen.getByText('Beta').closest('button');
    expect(correct?.querySelector('svg.lucide-check')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /learn\.nextCard/ }));
    expect(onAdvance).toHaveBeenCalledWith(false);
  });

  it('surfaces a retry error instead of a fake "incorrect" when grading fails', async () => {
    // When the grade request fails (network / expired token / server error) handleSubmit
    // resolves to undefined. The component must NOT fabricate an "Incorrect" verdict: the answer
    // lives server-side, so without a grade there is nothing to reveal — pretending the learner
    // was wrong both lies and hides the correct option. Surface an error and allow a retry.
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onAdvance = vi.fn();
    renderQuiz(onSubmit, onAdvance);

    await userEvent.click(screen.getByText('Alpha'));

    expect(await screen.findByText('learn.submitError')).toBeInTheDocument();
    expect(screen.queryByText('learn.incorrect')).not.toBeInTheDocument();
    expect(screen.queryByText('learn.correct')).not.toBeInTheDocument();
    // The card stays answerable so the learner can retry their pick.
    expect(screen.getByText('Beta').closest('button')).toBeEnabled();
    expect(onAdvance).not.toHaveBeenCalled();

    // Retrying clears the error and grades normally.
    onSubmit.mockResolvedValueOnce({ correct: false, correctChoiceId: 'b', explanation: '' });
    await userEvent.click(screen.getByText('Beta'));
    expect(await screen.findByText('learn.incorrect')).toBeInTheDocument();
    expect(screen.queryByText('learn.submitError')).not.toBeInTheDocument();
  });
});

describe('QuizReview regions', () => {
  it('names the question and the options for screen readers', () => {
    renderQuiz(vi.fn(), vi.fn());

    expect(screen.getByRole('region', { name: 'learn.part.question' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'learn.part.options' })).toBeInTheDocument();
  });

  it('names the explanation once the answer comes back', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      correct: false,
      correctChoiceId: 'b',
      explanation: 'Beta is right',
    });
    renderQuiz(onSubmit, vi.fn());

    await userEvent.click(screen.getByText('Alpha'));

    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'learn.part.explanation' })).toBeInTheDocument()
    );
  });
});
