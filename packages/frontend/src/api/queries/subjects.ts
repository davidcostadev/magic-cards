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
