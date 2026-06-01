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
  component: LearningSessionPage,
});

const learnSubjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/learn/$subjectId',
  beforeLoad: requireAuth,
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
