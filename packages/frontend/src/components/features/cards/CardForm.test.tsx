import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CardForm } from './CardForm';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// Render the dialog inline (skip the Radix portal/focus-trap in jsdom).
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

function renderForm(onSave = vi.fn()) {
  render(<CardForm open onOpenChange={vi.fn()} onSave={onSave} />);
  return onSave;
}

describe('CardForm', () => {
  it('blocks an empty open card and shows required errors', async () => {
    const onSave = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getAllByText('validation.required').length).toBeGreaterThan(0);
  });

  it('creates a quiz card with choices and the marked correct answer', async () => {
    const onSave = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'cards.typeQuiz' }));

    await userEvent.type(screen.getByLabelText('cards.question'), 'Pick one');
    await userEvent.type(screen.getByLabelText('cards.explanation'), 'Beta wins');
    const choiceInputs = screen.getAllByPlaceholderText('cards.choicePlaceholder');
    await userEvent.type(choiceInputs[0], 'Alpha');
    await userEvent.type(choiceInputs[1], 'Beta');
    // First choice is marked correct by default.
    await userEvent.click(screen.getByRole('button', { name: 'common.save' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'quiz',
        question: 'Pick one',
        answer: 'Beta wins',
        choices: [
          expect.objectContaining({ text: 'Alpha', isCorrect: true }),
          expect.objectContaining({ text: 'Beta', isCorrect: false }),
        ],
      })
    );
  });

  it('requires a shortAnswer for a type-answer card', async () => {
    const onSave = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'cards.typeTypeAnswer' }));
    await userEvent.type(screen.getByLabelText('cards.question'), 'Q');
    await userEvent.type(screen.getByLabelText('cards.explanation'), 'E');

    await userEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(onSave).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('cards.shortAnswer'), 'Partial');
    await userEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'type-answer', shortAnswer: 'Partial' })
    );
  });

  it('defaults the card language to English', async () => {
    const onSave = renderForm();
    await userEvent.type(screen.getByLabelText('cards.question'), 'Q');
    await userEvent.type(screen.getByLabelText('cards.answer'), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
  });

  it('saves the selected card language', async () => {
    const onSave = renderForm();
    await userEvent.type(screen.getByLabelText('cards.question'), 'Q');
    await userEvent.type(screen.getByLabelText('cards.answer'), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'settings.portuguese' }));
    await userEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ language: 'pt' }));
  });
});
