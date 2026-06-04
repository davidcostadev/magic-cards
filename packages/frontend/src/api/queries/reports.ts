import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';

export type CardReport = components['schemas']['ReportResponseDto'];
export type CreateReportInput = components['schemas']['CreateReportDto'];
/** Why a card was flagged ('incorrect' | 'improvement'), derived from the API contract. */
export type ReportReason = CardReport['reason'];

export const reportKeys = {
  all: ['card_reports'] as const,
  list: (subjectId: string) => [...reportKeys.all, 'list', subjectId] as const,
};

/** The current user's reports for a subject (used to drive the "Reported" list filter). */
export function useCardReports(subjectId: string) {
  return useQuery({
    queryKey: reportKeys.list(subjectId),
    queryFn: async () => {
      // Page through the cursor like useCards — a subject holds at most a few hundred cards.
      const all: CardReport[] = [];
      let startingAfter: string | undefined;
      for (;;) {
        const { data, error } = await apiClient.GET('/v1/card_reports', {
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

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateReportInput) => {
      const { data, error } = await apiClient.POST('/v1/card_reports', { body });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: reportKeys.list(report.subjectId) });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; subjectId: string }) => {
      const { error } = await apiClient.DELETE('/v1/card_reports/{id}', {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: reportKeys.list(variables.subjectId) });
    },
  });
}
