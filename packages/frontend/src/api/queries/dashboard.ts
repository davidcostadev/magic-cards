import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { components } from '@/api/schema';

export type DashboardStats = components['schemas']['DashboardStatsDto'];
export type Upcoming = components['schemas']['UpcomingDto'];
export type WeakCard = components['schemas']['WeakCardListDto']['data'][number];

// Stats are read-heavy and tolerate brief staleness (FRD-005); reviews invalidate them.
const STALE_TIME = 60_000;

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  weak: (limit: number) => [...dashboardKeys.all, 'weak', limit] as const,
  upcoming: () => [...dashboardKeys.all, 'upcoming'] as const,
};

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/dashboard/stats');
      if (error || !data) throw error;
      return data;
    },
    staleTime: STALE_TIME,
  });
}

export function useWeakCards(limit = 5) {
  return useQuery({
    queryKey: dashboardKeys.weak(limit),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/dashboard/weak_cards', {
        params: { query: { limit } },
      });
      if (error || !data) throw error;
      return data.data;
    },
    staleTime: STALE_TIME,
  });
}

export function useUpcoming() {
  return useQuery({
    queryKey: dashboardKeys.upcoming(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/dashboard/upcoming');
      if (error || !data) throw error;
      return data;
    },
    staleTime: STALE_TIME,
  });
}
