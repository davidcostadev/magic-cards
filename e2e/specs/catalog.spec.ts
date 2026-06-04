import { expect, test } from '@playwright/test';
import { startStudying } from '../helpers';

const API = 'http://localhost:3100';
const API_KEY = 'e2e-content-key-1234567890';

// Catalog: content published with the API key is auto-available + read-only to every learner.
test('published catalog content is visible and studyable by a new user', async ({
  page,
  request,
}) => {
  // Catalog content is public and persists, so use a unique title to stay isolated across runs.
  const unique = Date.now();
  const subjectTitle = `Shared SQL ${unique}`;
  const subjectName = new RegExp(subjectTitle);

  // Publish a public subject + card using the content API key.
  const subjectRes = await request.post(`${API}/v1/catalog/subjects`, {
    headers: { 'x-api-key': API_KEY },
    data: { title: subjectTitle, color: '#336791' },
  });
  expect(subjectRes.status()).toBe(201);
  const subject = await subjectRes.json();
  expect(subject.isPublic).toBe(true);

  const cardRes = await request.post(`${API}/v1/catalog/cards`, {
    headers: { 'x-api-key': API_KEY },
    data: { subjectId: subject.id, question: 'What does SELECT do?', answer: 'Reads rows' },
  });
  expect(cardRes.status()).toBe(201);

  // A brand-new learner signs up and goes through onboarding.
  await page.goto('/signup');
  await page.getByLabel('Username').fill(`cat_${unique}`);
  await page.getByLabel('Email').fill(`cat_${unique}@example.com`);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Get started' }).click();

  // The shared subject shows up in their list (marked Shared)...
  await page.getByRole('link', { name: 'Subjects' }).first().click();
  await expect(page.getByRole('link', { name: subjectName })).toBeVisible();

  // ...and they can study it.
  await page.getByRole('link', { name: subjectName }).click();
  await startStudying(page, 'Flashcards');
  await expect(page.getByText('What does SELECT do?')).toBeVisible();
});
