import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

const updatePreferences = vi.fn();
let sessionSize = 10;
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { dailyGoal: 20, nerdStats: false, sessionSize }, updatePreferences }),
}));

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

describe('SettingsPage — cards per session', () => {
  beforeEach(() => {
    updatePreferences.mockClear();
    sessionSize = 10;
  });

  it("marks the learner's current session size as selected", () => {
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: '10' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves the chosen session size', async () => {
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(updatePreferences).toHaveBeenCalledWith({ sessionSize: 5 });
  });
});
