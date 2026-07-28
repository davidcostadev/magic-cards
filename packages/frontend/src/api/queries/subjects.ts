import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';

export type Subject = components['schemas']['SubjectResponseDto'];
export type SubjectStats = components['schemas']['SubjectStatsDto'];
export type SubjectProgress = components['schemas']['SubjectProgressListDto']['data'][number];
export type CreateSubjectInput = components['schemas']['CreateSubjectDto'];
export type UpdateSubjectInput = components['schemas']['UpdateSubjectDto'];

export const subjectKeys = {
  all: ['subjects'] as const,
  list: () => [...subjectKeys.all, 'list'] as const,
  detail: (id: string) => [...subjectKeys.all, 'detail', id] as const,
  stats: (id: string) => [...subjectKeys.all, 'stats', id] as const,
  cardStats: (id: string) => [...subjectKeys.all, 'card-stats', id] as const,
  progress: () => [...subjectKeys.all, 'progress'] as const,
};

export function useSubjects() {
  return useQuery({
    queryKey: subjectKeys.list(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/subjects');
      if (error || !data) throw error;
      return data.data;
    },
  });
}

export function useSubject(id: string) {
  return useQuery({
    queryKey: subjectKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/subjects/{id}', {
        params: { path: { id } },
      });
      if (error || !data) throw error;
      return data;
    },
  });
}

/** Per-subject progress (total / reviewed / due) for every visible subject, in one request. */
export function useSubjectsProgress() {
  return useQuery({
    queryKey: subjectKeys.progress(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/subjects/progress');
      if (error || !data) throw error;
      return data.data;
    },
  });
}

export function useSubjectStats(id: string) {
  return useQuery({
    queryKey: subjectKeys.stats(id),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/subjects/{id}/stats', {
        params: { path: { id } },
      });
      if (error || !data) throw error;
      return data;
    },
  });
}

/**
 * The user's performance on every studied card of a subject, in one request. Returned as a Map
 * keyed by card id so the list can look a card's score up while rendering; cards the user has
 * never studied simply have no entry.
 */
export function useSubjectCardStats(id: string) {
  return useQuery({
    queryKey: subjectKeys.cardStats(id),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/subjects/{id}/card-stats', {
        params: { path: { id } },
      });
      if (error || !data) throw error;
      return new Map(data.data.map((row) => [row.cardId, row]));
    },
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateSubjectInput) => {
      const { data, error } = await apiClient.POST('/v1/subjects', { body });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateSubjectInput }) => {
      const { data, error } = await apiClient.PATCH('/v1/subjects/{id}', {
        params: { path: { id } },
        body,
      });
      if (error || !data) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE('/v1/subjects/{id}', {
        params: { path: { id } },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
  });
}

/**
 * Adds (`useSelectSubject`) or removes (`useUnselectSubject`) a subject from the user's list.
 * Both flip `selected` optimistically on the cached list so the grid/Manage toggle feels instant,
 * roll back on error, and re-sync on settle. The list cache holds `Subject[]` (see `useSubjects`).
 */
function useToggleSelection(selected: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const opts = { params: { path: { id } } };
      const { error } = selected
        ? await apiClient.POST('/v1/subjects/{id}/selection', opts)
        : await apiClient.DELETE('/v1/subjects/{id}/selection', opts);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: subjectKeys.list() });
      const prev = queryClient.getQueryData<Subject[]>(subjectKeys.list());
      queryClient.setQueryData<Subject[]>(subjectKeys.list(), (old) =>
        old?.map((s) => (s.id === id ? { ...s, selected } : s))
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(subjectKeys.list(), ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: subjectKeys.all }),
  });
}

export function useSelectSubject() {
  return useToggleSelection(true);
}

export function useUnselectSubject() {
  return useToggleSelection(false);
}
