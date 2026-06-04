import { expect, test } from '@playwright/test';
import { createSubjectAndOpen, signUpAndOnboard, startStudying } from '../helpers';

// After a study session the dashboard should reflect the reviews and render its stat sections.
test('the dashboard reflects a completed study session', async ({ page }) => {
  await signUpAndOnboard(page, 'dash');
  await createSubjectAndOpen(page, 'Dashboard Subject');

  for (const [question, answer] of [
    ['What is 2 + 2?', '4'],
    ['What is 3 + 3?', '6'],
  ]) {
    await page.getByRole('button', { name: 'New Card' }).click();
    await page.getByLabel('Question').fill(question);
    await page.getByLabel('Answer').fill(answer);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(question)).toBeVisible();
  }

  // Study both cards: one Right, one Wrong (so accuracy is meaningful).
  await startStudying(page, 'Flashcards');
  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await page.getByRole('button', { name: 'Right' }).click();
  await page.getByRole('button', { name: 'Reveal Answer' }).click();
  await page.getByRole('button', { name: 'Wrong' }).click();
  await expect(page.getByText('Session Complete!')).toBeVisible();

  await page.getByRole('link', { name: 'Back to Dashboard' }).click();
  await expect(page.getByText('2 / 20 cards')).toBeVisible();
  await expect(page.getByText('Accuracy')).toBeVisible();
  await expect(page.getByText('Cards by Status')).toBeVisible();
});
