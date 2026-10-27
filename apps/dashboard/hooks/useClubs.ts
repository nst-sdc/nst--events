import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api";

import type { ClubListItem, ClubsResponse } from '@nst/shared';

export type { ClubListItem, ClubsResponse };

export const useClubs = (query: string = "", enabled = true) => {
  return useQuery<ClubsResponse>({
    queryKey: query ? ["clubs", "search", query] : ["clubs", "list"],
    queryFn: () => {
      if (query) {
        return apiClient<ClubsResponse>(
          `/clubs/search?q=${encodeURIComponent(query)}`,
        );
      }
      return apiClient<ClubsResponse>("/clubs");
    },
    staleTime: 10 * 60 * 1000, // 10 minutes from clubs.md
    enabled,
  });
};
