import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock dependencies before importing hooks
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
  useMutation: ({ mutationFn, onSuccess, onError }: any) => {
    return {
      mutate: (variables?: any) => {
        return mutationFn(variables).then((data: any) => onSuccess?.(data, variables)).catch((err: any) => onError?.(err));
      },
      mutateAsync: (variables?: any) => {
        return mutationFn(variables).then((data: any) => {
          onSuccess?.(data, variables);
          return data;
        }).catch((err: any) => {
          onError?.(err);
          throw err;
        });
      },
      isPending: false,
      error: null,
    };
  },
  useQuery: vi.fn(),
  useInfiniteQuery: vi.fn(),
}));

const mockShowToast = vi.fn();
vi.mock('../src/hooks/use-toast', () => ({
  useToast: () => ({
    show: mockShowToast,
  }),
}));

let isOnlineMock = true;
vi.mock('../src/infrastructure/network', () => ({
  useNetworkStatus: () => ({
    isOnline: isOnlineMock,
  }),
}));

const mockApiClient = vi.fn();
vi.mock('../src/infrastructure/api', () => ({
  apiClient: (...args: any[]) => mockApiClient(...args),
}));

import { useRegistration } from '../src/hooks/use-registration';

describe('In-App Solo Event Registration & Cancellation Tests', () => {
  const mobileDir = path.resolve(__dirname, '..');
  const eventDetailPath = path.join(mobileDir, 'app/(app)/events/[id]/index.tsx');
  const eventDetailContent = fs.readFileSync(eventDetailPath, 'utf-8');

  beforeEach(() => {
    vi.clearAllMocks();
    isOnlineMock = true;
  });

  describe('1. useRegistration Mutation Lifecycle & Invalidation', () => {
    it('calls POST /v1/events/:id/register and invalidates all relevant queries on registration success', async () => {
      mockApiClient.mockResolvedValueOnce({
        id: 'reg-1',
        event_id: 'evt-123',
        status: 'REGISTERED',
      });

      const { registerAsync } = useRegistration('evt-123');
      const result = await registerAsync();

      expect(mockApiClient).toHaveBeenCalledWith('/v1/events/evt-123/register', { method: 'POST' });
      expect(result.status).toBe('REGISTERED');
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['events', 'evt-123'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['events', 'evt-123', 'registration'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['my-registration', 'evt-123'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['my-registrations'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['events'] });
      expect(mockShowToast).toHaveBeenCalledWith('You are confirmed for the event.', 'success', 'Registered!');
    });

    it('handles full capacity by showing waitlist toast on WAITLISTED response', async () => {
      mockApiClient.mockResolvedValueOnce({
        id: 'reg-2',
        event_id: 'evt-123',
        status: 'WAITLISTED',
      });

      const { registerAsync } = useRegistration('evt-123');
      await registerAsync();

      expect(mockShowToast).toHaveBeenCalledWith('The event is full. You are on the waitlist.', 'info', 'Waitlisted');
    });

    it('calls DELETE /v1/events/:id/register and invalidates queries on cancellation success', async () => {
      mockApiClient.mockResolvedValueOnce({ success: true });

      const { cancelAsync } = useRegistration('evt-123');
      await cancelAsync();

      expect(mockApiClient).toHaveBeenCalledWith('/v1/events/evt-123/register', { method: 'DELETE' });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['events', 'evt-123'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['events', 'evt-123', 'registration'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['my-registration', 'evt-123'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['my-registrations'] });
      expect(mockShowToast).toHaveBeenCalledWith('Registration cancelled successfully.', 'info', 'Cancelled');
    });

    it('calls DELETE /v1/events/:id/register and shows waitlist queue copy when cancelling from waitlist', async () => {
      mockApiClient.mockResolvedValueOnce({ success: true });

      const { cancelAsync } = useRegistration('evt-123');
      await cancelAsync({ isWaitlist: true });

      expect(mockApiClient).toHaveBeenCalledWith('/v1/events/evt-123/register', { method: 'DELETE' });
      expect(mockShowToast).toHaveBeenCalledWith('Left waitlist queue successfully.', 'info', 'Waitlist Updated');
    });

    it('rejects with offline error when device is offline', async () => {
      isOnlineMock = false;

      const { registerAsync } = useRegistration('evt-123');
      await expect(registerAsync()).rejects.toEqual({ status: 0, message: 'Offline' });
      expect(mockApiClient).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('You are currently offline.', 'error', 'No Connection');
    });

    it('extracts RFC 7807 detail/message from 4xx API error responses', async () => {
      mockApiClient.mockRejectedValueOnce({
        status: 403,
        detail: 'This event is restricted to Computer Science students.',
      });

      const { registerAsync } = useRegistration('evt-123');
      await expect(registerAsync()).rejects.toBeDefined();
      expect(mockShowToast).toHaveBeenCalledWith(
        'This event is restricted to Computer Science students.',
        'error',
        'Registration Failed'
      );
    });

    it('shows generic Server Error toast on 5xx status before checking detail/message', async () => {
      mockApiClient.mockRejectedValueOnce({
        status: 500,
        message: 'Internal server error',
        detail: 'Database deadlocked',
      });

      const { registerAsync } = useRegistration('evt-123');
      await expect(registerAsync()).rejects.toBeDefined();
      expect(mockShowToast).toHaveBeenCalledWith(
        'An unexpected error occurred.',
        'error',
        'Server Error'
      );
    });
  });

  describe('2. Event Detail Screen UI Invariants', () => {
    it('wires useRegistration and provides actionable buttons in place of read-only trays', () => {
      expect(eventDetailContent).toContain('useRegistration(');
      expect(eventDetailContent).toContain('[ REGISTER FOR EVENT ]');
      expect(eventDetailContent).toContain('[ JOIN EVENT WAITLIST ]');
      expect(eventDetailContent).toContain('[ CANCEL REGISTRATION ]');
      expect(eventDetailContent).toContain('[ LEAVE WAITLIST ]');
    });

    it('renders both Registration and Cancellation confirmation modals', () => {
      expect(eventDetailContent).toContain('showRegisterModal');
      expect(eventDetailContent).toContain('showCancelModal');
      expect(eventDetailContent).toContain('handleConfirmRegister');
      expect(eventDetailContent).toContain('handleConfirmCancel');
      expect(eventDetailContent).toContain('CONFIRM REGISTRATION');
      expect(eventDetailContent).toContain('CANCEL ENTRY PASS');
    });

    it('provides waitlist-specific copy and title for waitlisted cancellations', () => {
      expect(eventDetailContent).toContain('LEAVE WAITLIST QUEUE');
      expect(eventDetailContent).toContain('isWaitlistCancel ? "[LEAVE WAITLIST]" : "[CONFIRM CANCELLATION]"');
      expect(eventDetailContent).toContain('You will give up your current position in line');
    });

    it('guards against locked events, grace-period deadlines, and unpublished events', () => {
      expect(eventDetailContent).toContain("isLocked ? 'EVENT LOCKED' : 'REGISTRATION CLOSED'");
      expect(eventDetailContent).toContain('!isLocked');
      expect(eventDetailContent).toContain('isPastLockDeadline');
    });

    it('provides squad redirection for team events', () => {
      expect(eventDetailContent).toContain("registrationType === 'TEAM'");
      expect(eventDetailContent).toContain('[ SQUAD DETAILS & RULES ]');
      expect(eventDetailContent).toContain('router.push(`/(app)/events/${id}/teams`)');
    });
  });
});
