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

export type CardType = "open" | "quiz" | "type-answer" | "match";

export interface Choice {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface MatchPair {
  left: string;
  right: string;
}

export interface Card {
  id: string;
  subjectId: string;
  type: CardType;
  language: string;
  question: string;
  answer: string;
  hints: string[];
  tags: string[];
  choices: Choice[];
  shortAnswer: string;
  matchPairs: MatchPair[];
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
