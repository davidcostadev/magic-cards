import { expect, test } from '@playwright/test';
import { createSubjectAndOpen, openCardForm, signUpAndOnboard } from '../helpers';

// Interactive card types are auto-graded server-side. Each test authors a card via the form,
// studies it, and confirms the server grades the answer and the session completes.

test('quiz: author a multiple-choice card, study it, and get graded correct', async ({ page }) => {
  await signUpAndOnboard(page, 'quiz');
  await createSubjectAndOpen(page, 'Quiz Subject');

  await openCardForm(page, 'Quiz', 'Which keyword declares a constant?');
  await page.getByLabel('Explanation').fill('`const` cannot be reassigned.');
  const choices = page.getByPlaceholder(/Choice/);
  await choices.nth(0).fill('let');
  await choices.nth(1).fill('const');
  await page.getByRole('radio').nth(1).check(); // mark "const" as the correct choice
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Which keyword declares a constant?')).toBeVisible();

  await page.getByRole('link', { name: 'Start Studying' }).first().click();
  // Choices are shuffled — pick by text. The correct one yields "Correct!".
  await page.getByRole('button', { name: 'const' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();
  await page.getByRole('button', { name: /Next Card/ }).click();
  await expect(page.getByText('Session Complete!')).toBeVisible();
});

test('type-answer: author a typed-answer card and pass it with lenient matching', async ({
  page,
}) => {
  await signUpAndOnboard(page, 'typeans');
  await createSubjectAndOpen(page, 'Type Answer Subject');

  await openCardForm(page, 'Type Answer', 'Utility type that makes all props optional?');
  await page.getByLabel('Explanation').fill('`Partial<T>`.');
  await page.getByLabel('Accepted Answer').fill('Partial');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Utility type that makes all props optional?')).toBeVisible();

  await page.getByRole('link', { name: 'Start Studying' }).first().click();
  // Lowercase + spacing differ from "Partial"; the server normalizes and accepts it.
  await page.getByPlaceholder('Type your answer...').fill('  partial ');
  await page.getByRole('button', { name: /Check/ }).click();
  await expect(page.getByText('Correct!')).toBeVisible();
  await page.getByRole('button', { name: /Next Card/ }).click();
  await expect(page.getByText('Session Complete!')).toBeVisible();
});

test('match: author a pairing card, match all pairs, and get graded correct', async ({ page }) => {
  await signUpAndOnboard(page, 'match');
  await createSubjectAndOpen(page, 'Match Subject');

  await openCardForm(page, 'Match', 'Match the language abbreviations');
  await page.getByLabel('Left 1').fill('TS');
  await page.getByLabel('Right 1').fill('TypeScript');
  await page.getByLabel('Left 2').fill('PY');
  await page.getByLabel('Right 2').fill('Python');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Match the language abbreviations')).toBeVisible();

  await page.getByRole('link', { name: 'Start Studying' }).first().click();
  // Pair each left with its right (rights are shuffled server-side; pick by text).
  await page.getByRole('button', { name: 'TS', exact: true }).click();
  await page.getByRole('button', { name: 'TypeScript', exact: true }).click();
  await page.getByRole('button', { name: 'PY', exact: true }).click();
  await page.getByRole('button', { name: 'Python', exact: true }).click();
  await page.getByRole('button', { name: /Check/ }).click();
  await expect(page.getByText('All matched!')).toBeVisible();
  await page.getByRole('button', { name: /Next Card/ }).click();
  await expect(page.getByText('Session Complete!')).toBeVisible();
});
