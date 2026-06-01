import { expect, test } from '@playwright/test';
import { createSubjectAndOpen, signUpAndOnboard } from '../helpers';

// Card authoring CRUD beyond create: editing and deleting an existing card.
test('a learner can edit and delete a card', async ({ page }) => {
  await signUpAndOnboard(page, 'crud');
  await createSubjectAndOpen(page, 'CRUD Subject');

  await page.getByRole('button', { name: 'New Card' }).click();
  await page.getByLabel('Question').fill('Capital of France?');
  await page.getByLabel('Answer').fill('Paris');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Capital of France?')).toBeVisible();

  // Edit it. Wait for the form to pre-populate before overwriting (it also proves edit pre-fills).
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await expect(page.getByLabel('Question')).toHaveValue('Capital of France?');
  await page.getByLabel('Question').fill('Capital of Spain?');
  await page.getByLabel('Answer').fill('Madrid');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Capital of Spain?')).toBeVisible();
  await expect(page.getByText('Capital of France?')).toHaveCount(0);

  // Delete it.
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await expect(page.getByText('Capital of Spain?')).toHaveCount(0);
});
