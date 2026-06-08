import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StudyModeModal } from './StudyModeModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// open: 8 due of 35 · quiz: caught up (0 of 23) · type-answer: 3 of 18 · match: empty pool (0 of 0)
const byType = { open: 8, quiz: 0, 'type-answer': 3, match: 0 };
const reviewable = { open: 35, quiz: 23, 'type-answer': 18, match: 0 };

function renderModal(onSelect = vi.fn(), mistakes = 5) {
  render(
    <StudyModeModal
      counts={byType}
      total={11}
      reviewable={reviewable}
      reviewableTotal={76}
      mistakes={mistakes}
      onSelect={onSelect}
    />
  );
  return onSelect;
}

describe('StudyModeModal', () => {
  it('shows a due/total fraction for a mode with cards due', () => {
    renderModal();
    expect(screen.getByText('8 / 35')).toBeInTheDocument();
    expect(screen.getByText('3 / 18')).toBeInTheDocument();
  });

  it('keeps a caught-up mode (0 due, pool > 0) enabled and selectable as review-ahead', async () => {
    const onSelect = renderModal();
    expect(screen.getByText('0 / 23')).toBeInTheDocument();

    const quizBtn = screen.getByRole('button', { name: /modeQuizzes/i });
    expect(quizBtn).toBeEnabled();

    await userEvent.click(quizBtn);
    expect(onSelect).toHaveBeenCalledWith('quiz');
  });

  it('labels caught-up modes as review-ahead', () => {
    renderModal();
    // quiz (0/23) and match (0/0) both have nothing due -> review-ahead label.
    expect(screen.getAllByText('learn.reviewAhead').length).toBeGreaterThanOrEqual(1);
  });

  it('disables only a mode whose entire pool is empty', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /modeMatch/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /modeFlashcards/i })).toBeEnabled();
  });

  it('offers practice mistakes with a count and selects it', async () => {
    const onSelect = renderModal();
    const mistakesBtn = screen.getByRole('button', { name: /modeMistakes/i });
    expect(mistakesBtn).toBeEnabled();
    // Mistakes show a plain "to practice" count, not a due/total fraction.
    expect(screen.getByText('learn.mistakesToPractice')).toBeInTheDocument();

    await userEvent.click(mistakesBtn);
    expect(onSelect).toHaveBeenCalledWith('mistakes');
  });

  it('disables practice mistakes when the learner has none', () => {
    renderModal(vi.fn(), 0);
    expect(screen.getByRole('button', { name: /modeMistakes/i })).toBeDisabled();
  });
});
