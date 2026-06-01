import { QueryClient } from '@tanstack/react-query';

// Mutations never auto-retry, so a double-submit can't advance server state twice
// (architecture §6). Forms additionally disable submit while pending.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
