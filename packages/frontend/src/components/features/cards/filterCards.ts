import type { Card } from '@/api/queries/cards';

/**
 * Client-side filter for the subject's already-loaded cards. Matches the query
 * (case-insensitive, trimmed) against the question, the answer/explanation, the
 * accepted answer, the tags, and any quiz choice text. A blank query is a no-op.
 */
export function filterCards(cards: Card[], query: string): Card[] {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter((card) => {
    const haystacks = [
      card.question,
      card.answer ?? '',
      card.shortAnswer ?? '',
      ...card.tags,
      ...(card.choices?.map((c) => c.text) ?? []),
    ];
    return haystacks.some((value) => value.toLowerCase().includes(q));
  });
}
