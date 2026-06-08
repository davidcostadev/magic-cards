import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@/api/queries/cards';
import { ReportCardSheet } from './ReportCardSheet';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mutateAsync = vi.fn();
let isPending = false;
let isError = false;

vi.mock('@/api/queries/reports', () => ({
  useCreateReport: () => ({ mutateAsync, isPending, isError }),
}));

const card = {
  id: 'c1',
  subjectId: 's1',
  type: 'open',
  language: 'en',
  question: 'Q',
  answer: 'A',
  hints: [],
  tags: [],
  createdAt: '',
  updatedAt: '',
} as Card;

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({ id: 'r1', subjectId: 's1' });
  isPending = false;
  isError = false;
});

describe('ReportCardSheet', () => {
  it('shows both reasons and keeps submit disabled until one is chosen', () => {
    render(<ReportCardSheet open card={card} onOpenChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'reports.reasonIncorrect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'reports.reasonImprovement' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'reports.submit' })).toBeDisabled();
  });

  it('submits the chosen reason plus the note and confirms success', async () => {
    const user = userEvent.setup();
    render(<ReportCardSheet open card={card} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'reports.reasonIncorrect' }));
    await user.type(screen.getByLabelText('reports.message'), 'wrong answer');

    const submit = screen.getByRole('button', { name: 'reports.submit' });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(mutateAsync).toHaveBeenCalledWith({
      cardId: 'c1',
      reason: 'incorrect',
      message: 'wrong answer',
    });
    expect(await screen.findByText('reports.success')).toBeInTheDocument();
  });

  it('omits an empty note from the submission', async () => {
    const user = userEvent.setup();
    render(<ReportCardSheet open card={card} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'reports.reasonImprovement' }));
    await user.click(screen.getByRole('button', { name: 'reports.submit' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      cardId: 'c1',
      reason: 'improvement',
      message: undefined,
    });
  });

  it('shows the "add examples" suggestion only for an improvement report', async () => {
    const user = userEvent.setup();
    render(<ReportCardSheet open card={card} onOpenChange={vi.fn()} />);

    // Hidden under "incorrect".
    await user.click(screen.getByRole('button', { name: 'reports.reasonIncorrect' }));
    expect(
      screen.queryByRole('button', { name: 'reports.suggestionAddExamples' })
    ).not.toBeInTheDocument();

    // Shown under "improvement".
    await user.click(screen.getByRole('button', { name: 'reports.reasonImprovement' }));
    expect(
      screen.getByRole('button', { name: 'reports.suggestionAddExamples' })
    ).toBeInTheDocument();
  });

  it('includes the chosen suggestion in the submission', async () => {
    const user = userEvent.setup();
    render(<ReportCardSheet open card={card} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'reports.reasonImprovement' }));
    await user.click(screen.getByRole('button', { name: 'reports.suggestionAddExamples' }));
    await user.click(screen.getByRole('button', { name: 'reports.submit' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      cardId: 'c1',
      reason: 'improvement',
      suggestion: 'add_examples',
      message: undefined,
    });
  });

  it('drops a stale suggestion when switching back to "incorrect"', async () => {
    const user = userEvent.setup();
    render(<ReportCardSheet open card={card} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'reports.reasonImprovement' }));
    await user.click(screen.getByRole('button', { name: 'reports.suggestionAddExamples' }));
    await user.click(screen.getByRole('button', { name: 'reports.reasonIncorrect' }));
    await user.click(screen.getByRole('button', { name: 'reports.submit' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      cardId: 'c1',
      reason: 'incorrect',
      message: undefined,
    });
  });
});
