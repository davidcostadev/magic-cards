import {
  createRouter,
  createRootRoute,
  createRoute,
  redirect,
} from "@tanstack/react-router";
import { AppLayout } from "./App";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SubjectsPage } from "./pages/SubjectsPage";
import { SubjectDetailPage } from "./pages/SubjectDetailPage";
import { LearningSessionPage } from "./pages/LearningSessionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { isOnboarded } from "./context/PreferencesContext";

function isAuthenticated() {
  return localStorage.getItem("auth_token") !== null;
}

function requireAuth() {
  if (!isAuthenticated()) {
    throw redirect({ to: "/login" });
  }
  if (!isOnboarded()) {
    throw redirect({ to: "/onboarding" });
  }
}

function requireGuest() {
  if (isAuthenticated()) {
    throw redirect({ to: "/dashboard" });
  }
}

function requireOnboardingPending() {
  if (!isAuthenticated()) {
    throw redirect({ to: "/login" });
  }
  if (isOnboarded()) {
    throw redirect({ to: "/dashboard" });
  }
}

const rootRoute = createRootRoute({
  component: AppLayout,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: isAuthenticated() ? "/dashboard" : "/login" });
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: requireGuest,
  component: LoginPage,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  beforeLoad: requireGuest,
  component: SignupPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: requireAuth,
  component: DashboardPage,
});

const subjectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/subjects",
  beforeLoad: requireAuth,
  component: SubjectsPage,
});

const subjectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/subjects/$subjectId",
  beforeLoad: requireAuth,
  component: SubjectDetailPage,
});

const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn",
  beforeLoad: requireAuth,
  component: LearningSessionPage,
});

const learnSubjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn/$subjectId",
  beforeLoad: requireAuth,
  component: LearningSessionPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  beforeLoad: requireAuth,
  component: SettingsPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
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

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
