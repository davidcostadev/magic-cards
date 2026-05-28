# Issue 002: Auth pages — Login, Signup, mock AuthContext, protected routes

**Type**: AFK
**Phase**: FRD-001 (UI Prototype)
**Label**: done

---

## What to build

Build the login and signup pages with a shared AuthLayout, and implement a mock AuthContext that simulates authentication (login always succeeds, stores a fake user in state). Wire up TanStack Router route guards so unauthenticated users are redirected to `/login` and authenticated users are redirected away from auth pages to `/dashboard`.

LoginForm: email + password fields, submit button, link to signup.
SignupForm: email + password + username fields, submit button, link to login.
AuthLayout: centered card layout, app branding, shared between login and signup.

The mock AuthContext should store a fake user object (matching the users schema shape) and a simulated token. Login/signup set the user in context; logout clears it. No real validation — any credentials "work."

## Acceptance criteria

- [ ] LoginPage with email/password fields, submit button, and "Create account" link to `/signup`
- [ ] SignupPage with email/password/username fields, submit button, and "Already have an account?" link to `/login`
- [ ] AuthLayout wrapping both pages with centered card design and app branding
- [ ] Mock AuthContext providing `user`, `token`, `login()`, `signup()`, `logout()` 
- [ ] Simulated login/signup always succeeds and populates the context with a mock user
- [ ] Unauthenticated users redirected to `/login` when accessing protected routes
- [ ] Authenticated users redirected to `/dashboard` when accessing `/login` or `/signup`
- [ ] Logout clears auth state and redirects to `/login`
- [ ] Pages responsive on mobile (375px) and desktop
- [ ] All visible text uses i18n `t()` function with EN/PT translations

## Blocked by

- Issue 001 (Frontend scaffold)
