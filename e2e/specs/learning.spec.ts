import { expect, test } from '@playwright/test';

// Phase 1 flow: create a subject, add a card, and study it through one review (FRD-003).
test('a learner can create a subject, add a card, and study it', async ({ page }) => {
  const unique = Date.now();

  await page.goto('/signup');
  await page.getByLabel('Username').fill(`learn_${unique}`);
  await page.getByLabel('Email').fill(`learn_${unique}@example.com`);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign Up' }).click();

  // Walk through onboarding to the dashboard.
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByText(/Hello,/)).toBeVisible();

  // Create a subject.
  await page.getByRole('link', { name: 'Subjects' }).first().click();
  await page.getByRole('button', { name: 'New Subject' }).first().click();
  await page.getByLabel('Title').fill('Algorithms');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: /Algorithms/ })).toBeVisible();

  // Open it and add a card.
  await page.getByRole('link', { name: /Algorithms/ }).click();
  await page.getByRole('button', { name: 'New Card' }).click();
  await page.getByLabel('Question').fill('Big-O of binary search?');
  await page.getByLabel('Answer').fill('O(log n)');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Big-O of binary search?')).toBeVisible();

  // Study the card: reveal the answer and rate it Right.
  await page.getByRole('link', { name: 'Start Studying' }).first().click();
  await expect(page.getByText('Big-O of binary search?')).toBeVisible();
  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await page.getByRole('button', { name: 'Right' }).click();

  // The session ends with a summary.
  await expect(page.getByText('Session Complete!')).toBeVisible();
});
