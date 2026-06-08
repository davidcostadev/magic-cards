import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SessionSummary } from './SessionSummary';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// The dashboard link is the only navigation; render it as a plain anchor so we can assert on href.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

function renderSummary(onStudyMore = vi.fn()) {
  render(
    <SessionSummary
      cardsReviewed={5}
      correctCount={4}
      timeSpentMs={65_000}
      onStudyMore={onStudyMore}
    />
  );
  return onStudyMore;
}

describe('SessionSummary', () => {
  it('runs the study-more handler in place instead of navigating away', async () => {
    const onStudyMore = renderSummary();
    const button = screen.getByRole('button', { name: 'learn.studyMore' });

    // It must be a real button (restarts the session), never a link back to a fresh /learn chooser.
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button).not.toHaveAttribute('href');

    await userEvent.click(button);
    expect(onStudyMore).toHaveBeenCalledTimes(1);
  });

  it('keeps "back to dashboard" as a navigation link', () => {
    renderSummary();
    expect(screen.getByRole('link', { name: 'learn.backToDashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });
});
