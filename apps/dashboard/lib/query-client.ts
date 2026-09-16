import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            // Do not retry auth or missing resource errors, except 429
            if ([401, 403, 404, 422].includes(error.status)) {
              return false;
            }
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex, error) => {
          if (error instanceof ApiError && error.status === 429 && error.retryAfter) {
            return error.retryAfter * 1000;
          }
          const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
          return delay + Math.random() * 200;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser or test: make a new query client if we don't already have one
    // This is very important so we don't re-make a new client if React
    // suspends during initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}
