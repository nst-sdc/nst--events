import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const noRetryStatuses = [401, 403, 404, 422];
        if (error?.status && noRetryStatuses.includes(error?.status)) {
          return false; // Do not retry auth/business deterministic failures
        }
        return failureCount < 3; // Retry network/5xx and 429 failures up to 3 times
      },
      retryDelay: (attemptIndex, error: any) => {
        if (error?.status === 429 && error?.retryAfter) {
          return error.retryAfter * 1000;
        }
        const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
        return delay + Math.random() * 200;
      },
      refetchOnWindowFocus: true,
      staleTime: 30 * 1000, // 30 seconds (prevent rapid-refetch storms from tab navigation)
    },
  },
});

export const AppQueryProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
