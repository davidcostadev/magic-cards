import { expect, test } from '@playwright/test';
import { createSubjectAndOpen, openCardForm, signUpAndOnboard, startStudying } from '../helpers';

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

  await startStudying(page, 'Quizzes');
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

  await startStudying(page, 'Type the Answer');
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

  await startStudying(page, 'Match Pairs');
  // Tap-to-match: pick a left then its right (tiles flash and are removed). Pairs are shuffled,
  // so pick by text. Matching the final pair auto-grades the card — there's no "Check" step.
  await page.getByRole('button', { name: 'TS', exact: true }).click();
  await page.getByRole('button', { name: 'TypeScript', exact: true }).click();
  await page.getByRole('button', { name: 'PY', exact: true }).click();
  await page.getByRole('button', { name: 'Python', exact: true }).click();
  await expect(page.getByText(/no mistakes/)).toBeVisible(); // perfect match
  await page.getByRole('button', { name: /Next Card/ }).click();
  await expect(page.getByText('Session Complete!')).toBeVisible();
});

test('quiz: the eliminate hint disables wrong choices down to two, never the answer', async ({
  page,
}) => {
  await signUpAndOnboard(page, 'qhint');
  await createSubjectAndOpen(page, 'Hint Subject');

  // Author a 4-choice quiz so two eliminations are possible (leaving the answer + one decoy).
  await openCardForm(page, 'Quiz', 'Capital of France?');
  await page.getByLabel('Explanation').fill('Paris is the capital.');
  await page.getByRole('button', { name: 'Add Choice' }).click();
  await page.getByRole('button', { name: 'Add Choice' }).click();
  const choices = page.getByPlaceholder(/Choice/);
  await choices.nth(0).fill('London');
  await choices.nth(1).fill('Paris');
  await choices.nth(2).fill('Berlin');
  await choices.nth(3).fill('Madrid');
  await page.getByRole('radio').nth(1).check(); // mark "Paris" as correct
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Capital of France?')).toBeVisible();

  await startStudying(page, 'Quizzes');

  // The server greys out one wrong choice per hint; after two, only the answer + one decoy
  // remain and the hint is no longer offered.
  await page.getByRole('button', { name: /Eliminate/ }).click();
  await page.getByRole('button', { name: /Eliminate/ }).click();
  await expect(page.getByRole('button', { name: /Eliminate/ })).toHaveCount(0);

  // "Paris" is never eliminated — it is still selectable and grades correct.
  await page.getByRole('button', { name: 'Paris' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();
});
