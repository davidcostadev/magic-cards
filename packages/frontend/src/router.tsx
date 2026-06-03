import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { lazy } from 'react';
import { AppLayout } from './App';
import { isOnboarded } from './context/PreferencesContext';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SignupPage } from './pages/SignupPage';

// Code-split the authenticated pages so the initial (auth) bundle stays small.
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const SubjectsPage = lazy(() =>
  import('./pages/SubjectsPage').then((m) => ({ default: m.SubjectsPage }))
);
const SubjectDetailPage = lazy(() =>
  import('./pages/SubjectDetailPage').then((m) => ({ default: m.SubjectDetailPage }))
);
const LearningSessionPage = lazy(() =>
  import('./pages/LearningSessionPage').then((m) => ({ default: m.LearningSessionPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage }))
);

/**
 * Study modes the Learn page understands. The chooser screen is shown until `mode` is set;
 * `all` studies every type, the rest narrow to one card type (mirrors the backend `CARD_TYPES`).
 */
const STUDY_MODES = ['all', 'open', 'quiz', 'type-answer', 'match'] as const;
export type StudyMode = (typeof STUDY_MODES)[number];

/**
 * Parses the learn routes' search. `?mode=` chooses what to study (absent/unknown shows the
 * chooser); `?ahead=true` runs a review-ahead session (study already-seen cards before they're due).
 */
function validateLearnSearch(search: Record<string, unknown>): {
  mode?: StudyMode;
  ahead?: boolean;
} {
  const mode = search.mode;
  const validMode =
    typeof mode === 'string' && (STUDY_MODES as readonly string[]).includes(mode)
      ? (mode as StudyMode)
      : undefined;
  if (!validMode) return {};
  const ahead = search.ahead === true || search.ahead === 'true';
  return ahead ? { mode: validMode, ahead: true } : { mode: validMode };
}

function isAuthenticated() {
  return localStorage.getItem('auth_token') !== null;
}

function requireAuth() {
  if (!isAuthenticated()) {
    throw redirect({ to: '/login' });
  }
  if (!isOnboarded()) {
    throw redirect({ to: '/onboarding' });
  }
}

function requireGuest() {
  if (isAuthenticated()) {
    throw redirect({ to: '/dashboard' });
  }
}

function requireOnboardingPending() {
  if (!isAuthenticated()) {
    throw redirect({ to: '/login' });
  }
  if (isOnboarded()) {
    throw redirect({ to: '/dashboard' });
  }
}

const rootRoute = createRootRoute({
  component: AppLayout,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: isAuthenticated() ? '/dashboard' : '/login' });
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: requireGuest,
  component: LoginPage,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  beforeLoad: requireGuest,
  component: SignupPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: requireAuth,
  component: DashboardPage,
});

const subjectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/subjects',
  beforeLoad: requireAuth,
  component: SubjectsPage,
});

const subjectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/subjects/$subjectId',
  beforeLoad: requireAuth,
  component: SubjectDetailPage,
});

const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/learn',
  beforeLoad: requireAuth,
  validateSearch: validateLearnSearch,
  component: LearningSessionPage,
});

const learnSubjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/learn/$subjectId',
  beforeLoad: requireAuth,
  validateSearch: validateLearnSearch,
  component: LearningSessionPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: requireAuth,
  component: SettingsPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  beforeLoad: requireOnboardingPending,
  component: OnboardingPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  onboardingRoute,
  dashboardRoute,
  subjectsRoute,
  subjectDetailRoute,
  learnRoute,
  learnSubjectRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
