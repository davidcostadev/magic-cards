import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Subject } from '@/api/queries/subjects';
import { OnboardingPage } from './OnboardingPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

const mutateAsync = vi.fn();
let subjects: Subject[] = [];
let isLoading = false;
vi.mock('@/api/queries/subjects', () => ({
  useSubjects: () => ({ data: subjects, isLoading }),
  useSelectSubject: () => ({ mutateAsync }),
}));

const completeOnboarding = vi.fn();
vi.mock('@/context/PreferencesContext', () => ({
  usePreferences: () => ({ completeOnboarding }),
}));

const updatePreferences = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ updatePreferences }),
}));

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

const subject = (over: Partial<Subject>): Subject =>
  ({
    id: 'x',
    userId: 'u',
    title: '',
    description: null,
    color: null,
    icon: null,
    isPublic: true,
    cardCount: 0,
    selected: false,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Subject;

async function gotoSubjectsStep() {
  await userEvent.click(screen.getByRole('button', { name: 'onboarding.next' }));
}

beforeEach(() => {
  navigate.mockReset();
  mutateAsync.mockReset().mockResolvedValue(undefined);
  completeOnboarding.mockReset();
  updatePreferences.mockReset();
  isLoading = false;
  subjects = [subject({ id: 'ts', title: 'TypeScript' }), subject({ id: 'sql', title: 'SQL' })];
});

describe('OnboardingPage', () => {
  it('lists the real catalog subjects and keeps Get started disabled until one is picked', async () => {
    render(<OnboardingPage />);
    await gotoSubjectsStep();

    expect(screen.getByRole('button', { name: /TypeScript/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'onboarding.getStarted' })).toBeDisabled();
  });

  it('persists the chosen subjects, marks onboarding done, and navigates', async () => {
    render(<OnboardingPage />);
    await gotoSubjectsStep();

    await userEvent.click(screen.getByRole('button', { name: /TypeScript/ }));
    await userEvent.click(screen.getByRole('button', { name: 'onboarding.getStarted' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/dashboard' }));
    expect(mutateAsync).toHaveBeenCalledWith('ts');
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(completeOnboarding).toHaveBeenCalled();
  });

  it('lets the user finish even when the catalog is empty', async () => {
    subjects = [];
    render(<OnboardingPage />);
    await gotoSubjectsStep();

    expect(screen.getByText('onboarding.noSubjects')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'onboarding.getStarted' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/dashboard' }));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(completeOnboarding).toHaveBeenCalled();
  });
});
