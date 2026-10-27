/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useReadAllNotifications, useReadNotification } from '../hooks/useNotifications';
import { useSubmitEventForm } from '../hooks/useEventForms';
import * as apiModule from '../lib/api';

describe('Workstream 15: Cross-Client Integration & Mutation Cache Reconciliation', () => {
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

  it('useReadAllNotifications invalidates both notifications and unread-count cache queries', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue({ success: true } as any);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useReadAllNotifications(), { wrapper });

    await result.current.mutateAsync();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications', 'unread-count'] });
  });

  it('useReadNotification invalidates both notifications and unread-count on settlement', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue({ success: true } as any);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useReadNotification(), { wrapper });

    await result.current.mutateAsync('notif-uuid-1');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications', 'unread-count'] });
    });
  });

  it('useSubmitEventForm invalidates form responses, form list, and profileValues cache', async () => {
    vi.spyOn(apiModule, 'apiClient').mockResolvedValue({ data: [] } as any);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const eventId = 'evt-integration-100';
    const formId = 'form-uuid-200';

    const { result } = renderHook(() => useSubmitEventForm(eventId), { wrapper });

    await result.current.mutateAsync({
      formId,
      responses: [{ fieldDefinitionId: 'f-1', value: 'Answer' }],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['event-form-responses', eventId, formId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['event-forms', eventId],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['profileValues'],
    });
  });
});
