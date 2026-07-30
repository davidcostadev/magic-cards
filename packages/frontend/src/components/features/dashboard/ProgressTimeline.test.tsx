import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StudySession } from '@/api/queries/dashboard';
import { ProgressTimeline } from './ProgressTimeline';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'pt' } }),
}));

const SESSIONS: StudySession[] = [
  {
    startedAt: '2026-07-01T10:00:00.000Z',
    endedAt: '2026-07-01T10:20:00.000Z',
    reviews: 10,
    correct: 6,
    accuracy: 60,
    mastered: 1,
  },
  {
    startedAt: '2026-07-03T09:00:00.000Z',
    endedAt: '2026-07-03T09:30:00.000Z',
    reviews: 20,
    correct: 17,
    accuracy: 85,
    mastered: 4,
  },
];

describe('ProgressTimeline', () => {
  it('tells the learner what to do when there is no history yet', () => {
    render(<ProgressTimeline sessions={[]} />);

    expect(screen.getByText('dashboard.timelineEmpty')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('plots one point per study turn', () => {
    render(<ProgressTimeline sessions={SESSIONS} />);

    expect(screen.getAllByTestId('timeline-point')).toHaveLength(2);
  });

  it('starts on accuracy and switches the plotted metric on click', async () => {
    const user = userEvent.setup();
    render(<ProgressTimeline sessions={SESSIONS} />);

    const accuracy = screen.getByRole('button', { name: 'dashboard.timelineAccuracy' });
    const reviews = screen.getByRole('button', { name: 'dashboard.timelineReviews' });
    expect(accuracy).toHaveAttribute('aria-pressed', 'true');

    await user.click(reviews);
    expect(reviews).toHaveAttribute('aria-pressed', 'true');
    expect(accuracy).toHaveAttribute('aria-pressed', 'false');
  });

  it('exposes every turn in a table for screen readers', () => {
    render(<ProgressTimeline sessions={SESSIONS} />);

    const rows = within(screen.getByRole('table')).getAllByRole('row');
    // Header + one row per turn.
    expect(rows).toHaveLength(3);
    expect(within(rows[2]).getByText('85%')).toBeInTheDocument();
    expect(within(rows[2]).getByText('20')).toBeInTheDocument();
    expect(within(rows[2]).getByText('4')).toBeInTheDocument();
  });

  it('reveals the detail of a turn on keyboard focus', async () => {
    const user = userEvent.setup();
    render(<ProgressTimeline sessions={SESSIONS} />);

    await user.tab(); // accuracy toggle
    await user.tab(); // reviews toggle
    await user.tab(); // mastered toggle
    await user.tab(); // first data point

    expect(screen.getByTestId('timeline-tooltip')).toHaveTextContent('60%');
  });
});
