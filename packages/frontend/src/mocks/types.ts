export interface User {
  id: string;
  email: string;
  username: string;
  language: string;
  theme: string;
  dailyGoal: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  userId: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export type CardType = "open" | "quiz";

export interface Choice {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Card {
  id: string;
  subjectId: string;
  type: CardType;
  question: string;
  answer: string;
  hints: string[];
  tags: string[];
  choices: Choice[];
  createdAt: string;
  updatedAt: string;
}

export type CardStatus = "new" | "learning" | "reviewing" | "mastered";

export interface CardProgress {
  id: string;
  userId: string;
  cardId: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReviewDate: string;
  lastReviewDate: string | null;
  status: CardStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewHistory {
  id: string;
  userId: string;
  cardId: string;
  subjectId: string;
  quality: 1 | 3 | 4 | 5;
  reviewedAt: string;
  timeSpent: number;
  wasHintUsed: boolean;
}
