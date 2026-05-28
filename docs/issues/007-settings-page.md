# Issue 007: Settings page — Language, Theme, Daily goal

**Type**: AFK
**Phase**: FRD-001 (UI Prototype)
**Label**: done

---

## What to build

Build the settings page where the learner can configure their preferences: language (English/Portuguese), theme (dark/light), and daily goal (number input). Changes should take effect immediately — theme toggle updates the UI instantly, language switch re-renders all translated strings, daily goal updates the mock user state.

The settings page should be clean and simple — a form with clear labels, not a complex admin panel. Group related settings logically (appearance: theme; localization: language; learning: daily goal).

## Acceptance criteria

- [ ] SettingsPage at `/settings` with grouped preference controls
- [ ] Language selector (English / Portuguese) — switching re-renders all `t()` strings immediately
- [ ] Theme selector (Dark / Light) — switching toggles the Tailwind `dark` class immediately
- [ ] Daily goal input (number, minimum 1) — updates the mock user preference state
- [ ] Current values pre-populated from mock user / context state
- [ ] Visual feedback on change (e.g., changes applied immediately, no "save" button needed)
- [ ] Page responsive on mobile (375px) and desktop
- [ ] All visible text uses i18n `t()` function with EN/PT translations

## Blocked by

- Issue 001 (Frontend scaffold)
