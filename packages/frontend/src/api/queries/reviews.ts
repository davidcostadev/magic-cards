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
export type EliminateChoiceInput = components['schemas']['EliminateChoiceDto'];
export type CheckReviewInput = components['schemas']['CheckReviewDto'];

export const reviewKeys = {
  queue: (subject?: string, type?: CardType, ahead = false, mistakes = false) =>
    [
      'review_queue',
      subject ?? 'all',
      type ?? 'all',
      ahead ? 'ahead' : 'due',
      mistakes ? 'mistakes' : 'normal',
    ] as const,
  counts: (subject?: string) => ['review_queue', 'counts', subject ?? 'all'] as const,
};

/**
 * Fetches the study batch (weakest-first, then capped new cards) for a session.
 * An optional `type` narrows the batch to a single card type. With `ahead`, the due gate is
 * relaxed so already-seen, not-yet-due cards are pulled in (review-ahead). With `mistakes`, the
 * batch is instead the learner's wrong, not-yet-mastered cards (most-errored first), regardless of
 * schedule. Pass `enabled: false` to hold off fetching until the learner has chosen a study mode.
 */
export function useReviewQueue(
  subject?: string,
  type?: CardType,
  ahead = false,
  mistakes = false,
  enabled = true
) {
  return useQuery({
    queryKey: reviewKeys.queue(subject, type, ahead, mistakes),
    queryFn: async () => {
      const query: { subject?: string; type?: CardType; ahead?: boolean; mistakes?: boolean } = {};
      if (subject) query.subject = subject;
      if (type) query.type = type;
      if (ahead) query.ahead = true;
      if (mistakes) query.mistakes = true;
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

/**
 * Quiz "eliminate" hint: asks the server to grey out one more wrong choice (it knows which are
 * wrong — the study payload never carries that). Returns the choice id to disable, or `null` once
 * only two choices remain. Stateless, so no cache invalidation; the caller tracks eliminated ids.
 */
export function useEliminateChoice() {
  return useMutation({
    mutationFn: async (body: EliminateChoiceInput): Promise<string | null> => {
      const { data, error } = await apiClient.POST('/v1/quiz_hints', { body });
      if (error || !data) throw error;
      return data.choiceId;
    },
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

/**
 * Grades a re-practised answer in the session's short loop WITHOUT scheduling or recording it —
 * the first attempt already applied SM-2 and counted toward the daily goal. Returns the same
 * `Grade` shape, so re-shown auto-graded cards still get correctness + the right answer. Stateless,
 * so no cache invalidation.
 */
export function useCheckReview() {
  return useMutation({
    mutationFn: async (body: CheckReviewInput): Promise<Grade> => {
      const { data, error } = await apiClient.POST('/v1/reviews/check', { body });
      if (error || !data) throw error;
      return data;
    },
  });
}
