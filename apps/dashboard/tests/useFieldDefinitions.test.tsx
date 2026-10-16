/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCreateFieldDefinition, useAttachableFieldDefinitions } from '../hooks/useFieldDefinitions';
import * as apiModule from '../lib/api';
import * as currentUserHook from '../hooks/useCurrentUser';

describe('useFieldDefinitions Hook & Mutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('useCreateFieldDefinition payload serialization', () => {
    it('omits options property when options is null to satisfy backend Zod schema', async () => {
      let sentBody: any = null;
      vi.spyOn(apiModule, 'apiClient').mockImplementation(async (_endpoint: string, options?: any) => {
        sentBody = JSON.parse(options.body);
        return {
          data: {
            id: 'field-uuid-1',
            key: 'github_profile',
            label: 'github profile',
            fieldType: 'URL',
            options: null,
            isReusable: true,
            createdByClubId: null,
            createdAt: new Date().toISOString(),
          },
        };
      });

      const { result } = renderHook(() => useCreateFieldDefinition(), { wrapper });

      await result.current.mutateAsync({
        key: 'github_profile',
        label: 'github profile',
        fieldType: 'URL',
        options: null, // explicitly null (common frontend pattern)
        isReusable: true,
      });

      expect(sentBody).not.toBeNull();
      expect(sentBody.key).toBe('github_profile');
      expect(sentBody.label).toBe('github profile');
      expect(sentBody.fieldType).toBe('URL');
      expect(sentBody.isReusable).toBe(true);
      // Crucial: options must NOT be null in the JSON payload sent to the backend
      expect(sentBody.options).toBeUndefined();
      expect('options' in sentBody).toBe(false);
    });

    it('omits options property when options is empty array', async () => {
      let sentBody: any = null;
      vi.spyOn(apiModule, 'apiClient').mockImplementation(async (_endpoint: string, options?: any) => {
        sentBody = JSON.parse(options.body);
        return {
          data: {
            id: 'field-uuid-2',
            key: 'custom_text',
            label: 'Custom Text',
            fieldType: 'TEXT',
            options: null,
            isReusable: false,
            createdByClubId: null,
            createdAt: new Date().toISOString(),
          },
        };
      });

      const { result } = renderHook(() => useCreateFieldDefinition(), { wrapper });

      await result.current.mutateAsync({
        key: 'custom_text',
        label: 'Custom Text',
        fieldType: 'TEXT',
        options: [],
        isReusable: false,
      });

      expect(sentBody).not.toBeNull();
      expect(sentBody.options).toBeUndefined();
      expect('options' in sentBody).toBe(false);
    });

    it('includes options array when valid choices are provided', async () => {
      let sentBody: any = null;
      vi.spyOn(apiModule, 'apiClient').mockImplementation(async (_endpoint: string, options?: any) => {
        sentBody = JSON.parse(options.body);
        return {
          data: {
            id: 'field-uuid-3',
            key: 'tshirt_size',
            label: 'T-Shirt Size',
            fieldType: 'SELECT',
            options: ['S', 'M', 'L'],
            isReusable: false,
            createdByClubId: null,
            createdAt: new Date().toISOString(),
          },
        };
      });

      const { result } = renderHook(() => useCreateFieldDefinition(), { wrapper });

      await result.current.mutateAsync({
        key: 'tshirt_size',
        label: 'T-Shirt Size',
        fieldType: 'SELECT',
        options: ['S', 'M', 'L'],
        isReusable: false,
      });

      expect(sentBody).not.toBeNull();
      expect(sentBody.options).toEqual(['S', 'M', 'L']);
    });
  });

  describe('useAttachableFieldDefinitions filtering', () => {
    it('allows platform admins to see all field definitions', async () => {
      vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
        data: {
          id: 'admin-id',
          global_role: 'PLATFORM_ADMIN',
          club_memberships: [],
        } as any,
        isLoading: false,
      } as any);

      vi.spyOn(apiModule, 'apiClient').mockResolvedValue({
        data: [
          { id: '1', key: 'global_f', createdByClubId: null },
          { id: '2', key: 'club_f', createdByClubId: 'club-abc' },
        ],
      });

      const { result } = renderHook(() => useAttachableFieldDefinitions(), { wrapper });

      await waitFor(() => {
        expect(result.current.data?.length).toBe(2);
      });
    });

    it('restricts club organizers to platform fields and their own club fields', async () => {
      vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
        data: {
          id: 'club-user-id',
          global_role: 'STUDENT',
          club_memberships: [{ club_id: 'club-1' }],
        } as any,
        isLoading: false,
      } as any);

      vi.spyOn(apiModule, 'apiClient').mockResolvedValue({
        data: [
          { id: '1', key: 'platform_f', createdByClubId: null },
          { id: '2', key: 'my_club_f', createdByClubId: 'club-1' },
          { id: '3', key: 'other_club_f', createdByClubId: 'club-2' },
        ],
      });

      const { result } = renderHook(() => useAttachableFieldDefinitions(), { wrapper });

      await waitFor(() => {
        expect(result.current.data?.length).toBe(2);
        expect(result.current.data?.map((f) => f.id)).toEqual(['1', '2']);
      });
    });
  });
});
