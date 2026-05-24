import { QueryClient } from "@tanstack/react-query";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // Disable garbage collection for testing to prevent cache leaks
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
