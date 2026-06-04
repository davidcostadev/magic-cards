import { expect, type Page } from '@playwright/test';

/** Sign up a brand-new user and walk through onboarding to the dashboard. Returns the username. */
export async function signUpAndOnboard(page: Page, prefix: string): Promise<string> {
  const username = `${prefix}_${Date.now()}`;
  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(`${username}@example.com`);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign Up' }).click();

  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByText(/Hello,/)).toBeVisible();
  return username;
}

/** Create a subject from the Subjects page and open its detail view. */
export async function createSubjectAndOpen(page: Page, title: string): Promise<void> {
  await page.getByRole('link', { name: 'Subjects' }).first().click();
  await page.getByRole('button', { name: 'New Subject' }).first().click();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: new RegExp(title) }).click();
}

/** Open the card form, pick a card type, and fill the shared question field. */
export async function openCardForm(page: Page, type: string, question: string): Promise<void> {
  await page.getByRole('button', { name: 'New Card' }).click();
  await page.getByRole('button', { name: type, exact: true }).click();
  await page.getByLabel('Question').fill(question);
}

/**
 * Click "Start Studying" and pick a study mode from the "How do you want to study?" chooser
 * shown before every session. `mode` is the visible mode label — e.g. "Flashcards", "Quizzes",
 * "Type the Answer", "Match Pairs".
 */
export async function startStudying(page: Page, mode: string): Promise<void> {
  await page.getByRole('link', { name: 'Start Studying' }).first().click();
  await page.getByRole('button', { name: mode }).click();
}
