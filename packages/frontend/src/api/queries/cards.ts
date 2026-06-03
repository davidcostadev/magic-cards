import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';
import { subjectKeys } from './subjects';

export type Card = components['schemas']['CardResponseDto'];
export type CreateCardInput = components['schemas']['CreateCardDto'];
export type UpdateCardInput = components['schemas']['UpdateCardDto'];
/** Supported content languages for a card (e.g. 'en' | 'pt'), derived from the API contract. */
export type CardLanguage = Card['language'];

export const cardKeys = {
  all: ['cards'] as const,
  list: (subjectId: string) => [...cardKeys.all, 'list', subjectId] as const,
};

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
