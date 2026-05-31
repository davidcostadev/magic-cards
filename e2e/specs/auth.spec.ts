import { expect, test } from '@playwright/test';

// Phase 0 smoke flow: signup → onboarding → see profile → logout (FRD-002 / ADR 0005).
test('a learner can sign up, reach their dashboard, and log out', async ({ page }) => {
  const unique = Date.now();
  const username = `e2e_${unique}`;
  const email = `e2e_${unique}@example.com`;

  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign Up' }).click();

  // New users are walked through onboarding before the app proper.
  await expect(page.getByText('Welcome to Magic Cards')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Get started' }).click();

  // The dashboard greets the user by the name the backend persisted at signup.
  await expect(page.getByText(`Hello, ${username}!`)).toBeVisible();

  // Logging out (client-side token removal) returns to the login screen.
  await page.getByRole('button', { name: 'Log Out' }).click();
  await expect(page.getByText('Welcome back')).toBeVisible();
});
