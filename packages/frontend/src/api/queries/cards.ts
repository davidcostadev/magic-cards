import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';
import { subjectKeys } from './subjects';

export type Card = components['schemas']['CardResponseDto'];
export type CreateCardInput = components['schemas']['CreateCardDto'];
export type UpdateCardInput = components['schemas']['UpdateCardDto'];
/** Per-card performance for the current user ("nerd stats"). */
export type CardStats = components['schemas']['CardStatsDto'];
/** Supported content languages for a card (e.g. 'en' | 'pt'), derived from the API contract. */
export type CardLanguage = Card['language'];

type CardTranslationEntry = { question: string; answer: string };

/**
 * The translation entry for `lang`, or `undefined` when `lang` is `'all'`, the card's primary
 * language, or simply missing. Accepts both a card's and a grade's `translations` (same shape),
 * so callers can localize a question/answer or a grade explanation with one helper.
 */
export function pickTranslation(
  translations: { en?: CardTranslationEntry; pt?: CardTranslationEntry } | null | undefined,
  lang: string | null | undefined,
  primary?: string
): CardTranslationEntry | undefined {
  if (!lang || lang === 'all' || lang === primary) return undefined;
  return (translations ?? undefined)?.[lang as 'en' | 'pt'];
}

/**
 * Resolves a card's `{ question, answer }` in the learner's chosen card language, falling back to
 * the primary content whenever there is no complete translation. Drives the study + preview views
 * off the `cardLanguage` preference.
 */
export function localizeCard(
  card: Card,
  lang: string | null | undefined
): { question: string; answer: string } {
  const tr = pickTranslation(card.translations, lang, card.language);
  return {
    question: tr?.question?.trim() ? tr.question : card.question,
    answer: tr?.answer?.trim() ? tr.answer : card.answer,
  };
}

export const cardKeys = {
  all: ['cards'] as const,
  list: (subjectId: string) => [...cardKeys.all, 'list', subjectId] as const,
  stats: (cardId: string) => [...cardKeys.all, 'stats', cardId] as const,
};

/**
 * The current user's performance on a card. Gated by `enabled` (the caller passes the user's
 * "nerd stats" preference) so we never fetch when the panels are hidden.
 */
export function useCardStats(cardId: string, enabled: boolean) {
  return useQuery({
    queryKey: cardKeys.stats(cardId),
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/cards/{id}/stats', {
        params: { path: { id: cardId } },
      });
      if (error || !data) throw error;
      return data;
    },
  });
}

export function useCards(subjectId: string) {
  return useQuery({
    queryKey: cardKeys.list(subjectId),
    queryFn: async () => {
      // Page through the cursor so the entire deck is loaded — the list page does its own
      // client-side search and pagination over the full set (a subject holds at most a few
      // hundred cards). The API caps `limit` at 100, so this is 1–3 requests in practice.
      const all: Card[] = [];
      let startingAfter: string | undefined;
      for (;;) {
        const { data, error } = await apiClient.GET('/v1/cards', {
          params: {
            query: {
              subject: subjectId,
              limit: 100,
              ...(startingAfter ? { starting_after: startingAfter } : {}),
            },
          },
        });
        if (error || !data) throw error;
        all.push(...data.data);
        if (!data.has_more || data.data.length === 0) break;
        startingAfter = data.data[data.data.length - 1].id;
      }
      return all;
    },
  });
}

/** Invalidate the card list plus the owning subject (its cardCount/stats changed). */
function useCardInvalidation() {
  const queryClient = useQueryClient();
  return (subjectId: string) => {
    queryClient.invalidateQueries({ queryKey: cardKeys.list(subjectId) });
    queryClient.invalidateQueries({ queryKey: subjectKeys.all });
  };
}

export function useCreateCard() {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: async (body: CreateCardInput) => {
      const { data, error } = await apiClient.POST('/v1/cards', { body });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: (card) => invalidate(card.subjectId),
  });
}

export function useUpdateCard() {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateCardInput }) => {
      const { data, error } = await apiClient.PATCH('/v1/cards/{id}', {
        params: { path: { id } },
        body,
      });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: (card) => invalidate(card.subjectId),
  });
}

export function useDeleteCard() {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: async ({ id }: { id: string; subjectId: string }) => {
      const { error } = await apiClient.DELETE('/v1/cards/{id}', {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => invalidate(variables.subjectId),
  });
}
