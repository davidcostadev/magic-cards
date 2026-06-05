import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardStats } from '@/api/queries/cards';
import { CardStatsPanel } from './CardStatsPanel';

const useCardStatsMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock('@/api/queries/cards', () => ({
  useCardStats: (cardId: string, enabled: boolean) => useCardStatsMock(cardId, enabled),
}));

const FULL_STATS: CardStats = {
  totalReviews: 3,
  correctCount: 2,
  incorrectCount: 1,
  accuracy: 67,
  avgTimeMs: 2000,
  hintedCount: 1,
  easeFactor: 2.5,
  interval: 3,
  repetitions: 2,
  status: 'reviewing',
  lastReviewDate: '2026-06-01T00:00:00.000Z',
  nextReviewDate: '2026-06-10T00:00:00.000Z',
};

beforeEach(() => {
  useCardStatsMock.mockReset();
  useAuthMock.mockReset();
});

describe('CardStatsPanel', () => {
  it('renders nothing and does not fetch when nerd stats are off', () => {
    useAuthMock.mockReturnValue({ user: { nerdStats: false } });
    useCardStatsMock.mockReturnValue({ data: undefined, isLoading: false });

    const { container } = render(<CardStatsPanel cardId="c1" />);

    expect(container.firstChild).toBeNull();
    // The query is gated: enabled === false so no request is made.
    expect(useCardStatsMock).toHaveBeenCalledWith('c1', false);
  });

  it('renders the performance metrics when nerd stats are on', () => {
    useAuthMock.mockReturnValue({ user: { nerdStats: true } });
    useCardStatsMock.mockReturnValue({ data: FULL_STATS, isLoading: false });

    render(<CardStatsPanel cardId="c1" />);

    expect(useCardStatsMock).toHaveBeenCalledWith('c1', true);
    expect(screen.getByText('cardStats.title')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument(); // accuracy
    expect(screen.getByText('2.0s')).toBeInTheDocument(); // avg time
    expect(screen.getByText('2.50 / 2.5')).toBeInTheDocument(); // ease factor (vs SM-2 start)
    expect(screen.getByText('3d')).toBeInTheDocument(); // interval
    expect(screen.getByText('dashboard.reviewing')).toBeInTheDocument(); // status (reused key)
  });

  it('shows a no-data hint for a never-reviewed card', () => {
    useAuthMock.mockReturnValue({ user: { nerdStats: true } });
    useCardStatsMock.mockReturnValue({
      data: { ...FULL_STATS, totalReviews: 0 },
      isLoading: false,
    });

    render(<CardStatsPanel cardId="c1" />);
    expect(screen.getByText('cardStats.noData')).toBeInTheDocument();
  });

  it('renders a one-line summary in the inline variant', () => {
    useAuthMock.mockReturnValue({ user: { nerdStats: true } });
    useCardStatsMock.mockReturnValue({ data: FULL_STATS, isLoading: false });

    render(<CardStatsPanel cardId="c1" variant="inline" />);
    expect(screen.getByText('cardStats.inlineSummary')).toBeInTheDocument();
  });
});
