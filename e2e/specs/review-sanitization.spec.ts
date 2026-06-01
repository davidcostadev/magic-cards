import { expect, test } from '@playwright/test';

const API = 'http://localhost:3100';
const API_KEY = 'e2e-content-key-1234567890';

// The study payload is sanitized: grading data (isCorrect / shortAnswer / the match pairing)
// must never reach the learner, since the server grades the submitted answer.
test('the review queue never leaks grading data', async ({ request }) => {
  const unique = Date.now();
  const subjectRes = await request.post(`${API}/v1/catalog/subjects`, {
    headers: { 'x-api-key': API_KEY },
    data: { title: `Sanitized ${unique}` },
  });
  expect(subjectRes.status()).toBe(201);
  const subject = await subjectRes.json();

  const quizRes = await request.post(`${API}/v1/catalog/cards`, {
    headers: { 'x-api-key': API_KEY },
    data: {
      subjectId: subject.id,
      type: 'quiz',
      question: 'Pick the right one',
      answer: 'B is correct',
      choices: [
        { id: 'a', text: 'A', isCorrect: false },
        { id: 'b', text: 'B', isCorrect: true },
      ],
    },
  });
  expect(quizRes.status()).toBe(201);

  const matchRes = await request.post(`${API}/v1/catalog/cards`, {
    headers: { 'x-api-key': API_KEY },
    data: {
      subjectId: subject.id,
      type: 'match',
      question: 'Match these',
      matchPairs: [
        { left: 'TS', right: 'TypeScript' },
        { left: 'PY', right: 'Python' },
      ],
    },
  });
  expect(matchRes.status()).toBe(201);

  // A fresh learner signs up (via the API) and pulls the study queue for the public subject.
  const signup = await request.post(`${API}/v1/auth/signup`, {
    data: {
      username: `san_${unique}`,
      email: `san_${unique}@example.com`,
      password: 'password123',
    },
  });
  expect(signup.status()).toBe(201);
  const { token } = await signup.json();

  const queueRes = await request.get(`${API}/v1/review_queue?subject=${subject.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(queueRes.status()).toBe(200);
  const queue = await queueRes.json();
  const cards = [...queue.due, ...queue.new];

  const quiz = cards.find((c: { type: string }) => c.type === 'quiz');
  expect(quiz).toBeTruthy();
  expect(quiz.choices).toHaveLength(2);
  for (const choice of quiz.choices) {
    expect(choice).not.toHaveProperty('isCorrect');
  }
  expect(quiz.answer).toBe(''); // explanation is withheld until graded

  const match = cards.find((c: { type: string }) => c.type === 'match');
  expect(match).toBeTruthy();
  expect(match).not.toHaveProperty('matchPairs');
  expect([...match.matchItems.lefts].sort()).toEqual(['PY', 'TS']);
  expect([...match.matchItems.rights].sort()).toEqual(['Python', 'TypeScript']);
});
