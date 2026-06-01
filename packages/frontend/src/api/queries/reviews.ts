import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';
import { cardKeys } from './cards';
import { subjectKeys } from './subjects';

export type ReviewQueue = components['schemas']['ReviewQueueResponseDto'];
export type SubmitReviewResult = components['schemas']['SubmitReviewResponseDto'];
export type CardProgress = SubmitReviewResult['progress'];
/** Grading feedback for auto-graded cards (absent for self-assessed `open` cards). */
export type Grade = NonNullable<SubmitReviewResult['grade']>;
export type ReviewInput = components['schemas']['CreateReviewDto'];
/** A review response for an auto-graded card, discriminated by type. */
export type ReviewResponse = NonNullable<ReviewInput['response']>;
/** A single card type a session can be narrowed to (e.g. only quizzes). */
export type CardType = components['schemas']['CardResponseDto']['type'];

export type CardTypeCounts = components['schemas']['ReviewQueueCountsResponseDto'];

export const reviewKeys = {
  queue: (subject?: string, type?: CardType) =>
    ['review_queue', subject ?? 'all', type ?? 'all'] as const,
  counts: (subject?: string) => ['review_queue', 'counts', subject ?? 'all'] as const,
};

/**
 * Fetches the study batch (due first, then capped new cards) for a session.
 * An optional `type` narrows the batch to a single card type. Pass `enabled: false`
 * to hold off fetching until the learner has chosen a study mode.
 */
export function useReviewQueue(subject?: string, type?: CardType, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.queue(subject, type),
    queryFn: async () => {
      const query: { subject?: string; type?: CardType } = {};
      if (subject) query.subject = subject;
      if (type) query.type = type;
      const { data, error } = await apiClient.GET('/v1/review_queue', { params: { query } });
      if (error || !data) throw error;
      return data;
    },
    staleTime: 0,
    enabled,
  });
}

/** Per-type card counts (optionally scoped to a subject) for the "choose what to study" screen. */
export function useTypeCounts(subject?: string, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.counts(subject),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/review_queue/counts', {
        params: { query: subject ? { subject } : {} },
      });
      if (error || !data) throw error;
      return data;
    },
    staleTime: 0,
    enabled,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ReviewInput) => {
      const { data, error } = await apiClient.POST('/v1/reviews', { body });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review_queue'] });
      queryClient.invalidateQueries({ queryKey: subjectKeys.all });
      queryClient.invalidateQueries({ queryKey: cardKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
