import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { cardKeys } from "./cards";
import { subjectKeys } from "./subjects";

export type ReviewQueue = components["schemas"]["ReviewQueueResponseDto"];
export type CardProgress = components["schemas"]["CardProgressResponseDto"];
export type ReviewInput = components["schemas"]["CreateReviewDto"];

export const reviewKeys = {
  queue: (subject?: string) => ["review_queue", subject ?? "all"] as const,
};

/** Fetches the study batch (due first, then capped new cards) for a session. */
export function useReviewQueue(subject?: string) {
  return useQuery({
    queryKey: reviewKeys.queue(subject),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/v1/review_queue", {
        params: { query: subject ? { subject } : {} },
      });
      if (error || !data) throw error;
      return data;
    },
    staleTime: 0,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ReviewInput) => {
      const { data, error } = await apiClient.POST("/v1/reviews", { body });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review_queue"] });
      queryClient.invalidateQueries({ queryKey: subjectKeys.all });
      queryClient.invalidateQueries({ queryKey: cardKeys.all });
    },
  });
}
