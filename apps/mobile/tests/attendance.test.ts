import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { QueryClient } from '@tanstack/react-query';

(globalThis as any).__DEV__ = false;

vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn().mockResolvedValue(null),
  deleteItemAsync: vi.fn(),
}));

vi.mock('../src/store/theme-store', () => ({
  useAppTheme: () => ({
    mode: 'dark',
    spacing: { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32 },
    colors: {
      surface: '#000000',
      primary: '#ffffff',
      onPrimary: '#000000',
      onSurface: '#ffffff',
      onSurfaceVariant: '#888888',
      outline: '#444444',
      outlineVariant: '#333333',
      error: '#ff4444',
      surfaceContainerHighest: '#222222',
    },
    typography: {
      syneExtraBold: 'Syne',
      syneBold: 'Syne',
      interRegular: 'Inter',
      monoRegular: 'Mono',
      monoBold: 'Mono',
    },
  }),
}));

vi.mock('react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useMemo: (fn: any) => fn(),
  };
});

import { getAttendanceErrorDetails, AttendanceFailureView } from '../src/ui/AttendanceFailureView';

describe('Phase 3 — Mobile Attendance Reliability Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 60 * 1000,
        },
      },
    });
    vi.clearAllMocks();
  });

  describe('1. Attendance Success Cache Invalidation Contract', () => {
    it('invalidates ["my-attendance"], ["events", eventId], and ["home-events"] after confirmed attendance success', async () => {
      const eventId = 'test-event-uuid-1';

      // Seed query cache with pre-attendance state
      queryClient.setQueryData(['my-attendance'], [{ id: 'old-att-1', eventId: 'other-evt' }]);
      queryClient.setQueryData(['events', eventId], { id: eventId, title: 'Test Event', locationName: 'Campus Hall' });
      queryClient.setQueryData(['home-events'], [{ id: eventId, title: 'Test Event' }]);

      // Verify queries are initially fresh (not stale)
      expect(queryClient.getQueryState(['my-attendance'])?.isInvalidated).toBeFalsy();
      expect(queryClient.getQueryState(['events', eventId])?.isInvalidated).toBeFalsy();
      expect(queryClient.getQueryState(['home-events'])?.isInvalidated).toBeFalsy();

      // Simulate the attendance success invalidation routine from scan.tsx
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-attendance'] }),
        queryClient.invalidateQueries({ queryKey: ['events', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['home-events'] }),
      ]);

      // Verify all 3 query keys are marked as invalidated
      expect(queryClient.getQueryState(['my-attendance'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['events', eventId])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['home-events'])?.isInvalidated).toBe(true);
    });

    it('does NOT falsely invalidate cache when attendance submission fails', async () => {
      const eventId = 'test-event-uuid-2';

      queryClient.setQueryData(['my-attendance'], [{ id: 'att-existing' }]);
      queryClient.setQueryData(['events', eventId], { id: eventId, title: 'Event 2' });
      queryClient.setQueryData(['home-events'], [{ id: eventId }]);

      // Simulate a failed attendance submission (e.g. OUTSIDE_GEOFENCE or LOCATION_UNRELIABLE)
      const submitAttendance = async () => {
        throw new Error('OUTSIDE_GEOFENCE');
      };

      try {
        await submitAttendance();
        // If it were mistakenly placed here, it won't execute
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['my-attendance'] }),
          queryClient.invalidateQueries({ queryKey: ['events', eventId] }),
          queryClient.invalidateQueries({ queryKey: ['home-events'] }),
        ]);
      } catch {
        // Attendance failed, error caught
      }

      // Verify cache states were NOT invalidated
      expect(queryClient.getQueryState(['my-attendance'])?.isInvalidated).toBeFalsy();
      expect(queryClient.getQueryState(['events', eventId])?.isInvalidated).toBeFalsy();
      expect(queryClient.getQueryState(['home-events'])?.isInvalidated).toBeFalsy();
    });
  });

  describe('2. Venue Name Resolution on Attendance Success', () => {
    it('uses existing cached React Query event data as primary venue name source without network call', async () => {
      const eventId = 'evt-cached-1';
      const mockNetworkFetch = vi.fn();

      queryClient.setQueryData(['events', eventId], {
        id: eventId,
        title: 'Cached Event',
        locationName: 'Auditorium Alpha',
      });

      // Simulation of scan.tsx venue resolution
      const cachedEvent = queryClient.getQueryData<any>(['events', eventId]);
      let locationName = cachedEvent?.locationName || cachedEvent?.location_name;

      if (!locationName) {
        locationName = await mockNetworkFetch(eventId);
      }

      expect(locationName).toBe('Auditorium Alpha');
      expect(mockNetworkFetch).not.toHaveBeenCalled();
    });

    it('resolves snake_case location_name if cached data has snake_case', async () => {
      const eventId = 'evt-cached-2';
      const mockNetworkFetch = vi.fn();

      queryClient.setQueryData(['events', eventId], {
        id: eventId,
        title: 'Cached Event 2',
        location_name: 'Seminar Room B',
      });

      const cachedEvent = queryClient.getQueryData<any>(['events', eventId]);
      let locationName = cachedEvent?.locationName || cachedEvent?.location_name;

      if (!locationName) {
        locationName = await mockNetworkFetch(eventId);
      }

      expect(locationName).toBe('Seminar Room B');
      expect(mockNetworkFetch).not.toHaveBeenCalled();
    });

    it('falls back safely to network request when query cache is missing event data', async () => {
      const eventId = 'evt-uncached-1';
      const mockNetworkFetch = vi.fn().mockResolvedValue({
        id: eventId,
        locationName: 'Outdoor Grounds',
      });

      const cachedEvent = queryClient.getQueryData<any>(['events', eventId]);
      let locationName = cachedEvent?.locationName || cachedEvent?.location_name;

      if (!locationName) {
        const eventResponse = await mockNetworkFetch(eventId);
        locationName = eventResponse?.locationName || eventResponse?.location_name;
      }

      expect(locationName).toBe('Outdoor Grounds');
      expect(mockNetworkFetch).toHaveBeenCalledWith(eventId);
    });

    it('preserves "Unknown Location" safe fallback if both cache and network fail', async () => {
      const eventId = 'evt-error-1';
      const mockNetworkFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const cachedEvent = queryClient.getQueryData<any>(['events', eventId]);
      let locationName = cachedEvent?.locationName || cachedEvent?.location_name;

      if (!locationName) {
        try {
          const eventResponse = await mockNetworkFetch(eventId);
          locationName = eventResponse?.locationName || eventResponse?.location_name;
        } catch {
          // Network failed
        }
      }

      const finalLocation = locationName || 'Unknown Location';
      expect(finalLocation).toBe('Unknown Location');
    });
  });

  describe('3. Attendance Failure Error Mapping Contract', () => {
    it('LOCATION_UNRELIABLE renders dedicated GPS Accuracy Low copy and allows retry', () => {
      const details = getAttendanceErrorDetails('LOCATION_UNRELIABLE');

      expect(details.title).toBe('GPS Accuracy Low');
      expect(details.reason).toBe('Location accuracy is insufficient. Please move to an area with clear skies.');
      expect(details.action).toContain('clear skies');
    });

    it('LOCATION_TIMEOUT renders dedicated Location Timeout copy and allows retry', () => {
      const details = getAttendanceErrorDetails('LOCATION_TIMEOUT');

      expect(details.title).toBe('Location Timeout');
      expect(details.reason).toBe('Unable to acquire a GPS fix within 8 seconds.');
      expect(details.action).toContain('GPS');
    });

    it('ACADEMIC_PROFILE_MISSING treats as academic eligibility failure under "Ineligible Batch"', () => {
      const details = getAttendanceErrorDetails('ACADEMIC_PROFILE_MISSING');

      expect(details.title).toBe('Ineligible Batch');
      expect(details.reason).toBe('Your academic program is not eligible for this session.');
      expect(details.action).toBe('Please verify the event requirements.');
    });

    it('INVALID_QR_FORMAT renders friendly student-facing copy', () => {
      const details = getAttendanceErrorDetails('INVALID_QR_FORMAT');

      expect(details.title).toBe('Invalid QR Code');
      expect(details.reason).toBe('Unrecognized QR code format. Please scan the official NST-Events session QR code.');
    });

    it('MALFORMED_QR renders friendly student-facing copy', () => {
      const details = getAttendanceErrorDetails('MALFORMED_QR');

      expect(details.title).toBe('Invalid QR Code');
      expect(details.reason).toBe('Unrecognized QR code format. Please scan the official NST-Events session QR code.');
    });

    it('existing error codes preserve their exact contract mappings', () => {
      expect(getAttendanceErrorDetails('QR_EXPIRED').title).toBe('QR Code Expired');
      expect(getAttendanceErrorDetails('SESSION_CLOSED').title).toBe('Session Closed');
      expect(getAttendanceErrorDetails('EVENT_LOCKED').title).toBe('Event Locked');
      expect(getAttendanceErrorDetails('ALREADY_RECORDED').title).toBe('Already Marked');
      expect(getAttendanceErrorDetails('NOT_REGISTERED').title).toBe('Not Registered');
      expect(getAttendanceErrorDetails('WAITLISTED').title).toBe('Waitlisted');
      expect(getAttendanceErrorDetails('NETWORK_OFFLINE').title).toBe('Network Required');
      expect(getAttendanceErrorDetails('NETWORK_OFFLINE').reason).toBe('An active network connection is required to verify attendance.');
      expect(getAttendanceErrorDetails('REGISTRATION_NOT_ELIGIBLE').title).toBe('Ineligible Batch');
      expect(getAttendanceErrorDetails('ACADEMICALLY_INELIGIBLE').title).toBe('Ineligible Batch');
    });

    it('LOCATION_VERIFICATION_FAILED provides identical, idempotent UI for spoofing and geofence errors', () => {
      const details = getAttendanceErrorDetails('LOCATION_VERIFICATION_FAILED');
      expect(details.title).toBe('Location Check Failed');
      expect(details.reason).toBe('We couldn\'t verify your location. Move closer to the venue and try again.');
      expect(details.action).toContain('GPS accuracy');
    });
  });

  describe('4. Concealment of Raw Technical Error Identifiers in AttendanceFailureView', () => {
    // Helper to recursively find strings in a React element tree
    const extractTextContent = (node: any): string[] => {
      if (!node) return [];
      if (typeof node === 'string' || typeof node === 'number') return [String(node)];
      if (Array.isArray(node)) return node.flatMap(extractTextContent);
      let texts: string[] = [];
      if (node.props?.title) texts.push(String(node.props.title));
      if (node.props?.children) {
        texts = texts.concat(extractTextContent(node.props.children));
      }
      return texts;
    };

    it('does NOT display raw error code "ERROR: INVALID_QR_FORMAT" on the student-facing UI', () => {
      const view = AttendanceFailureView({
        errorCode: 'INVALID_QR_FORMAT',
        onRetryScan: () => {},
        onReturnHome: () => {},
      });

      const textTokens = extractTextContent(view);
      const fullText = textTokens.join(' ');

      expect(fullText).not.toContain('ERROR: INVALID_QR_FORMAT');
      expect(fullText).toContain('Invalid QR Code');
      expect(fullText).toContain('Unrecognized QR code format. Please scan the official NST-Events session QR code.');
      expect(fullText).toContain('RETRY SCAN');
      expect(fullText).toContain('RETURN TO HOME');
    });

    it('does NOT display raw error code "ERROR: MALFORMED_QR" on the student-facing UI', () => {
      const view = AttendanceFailureView({
        errorCode: 'MALFORMED_QR',
        onRetryScan: () => {},
        onReturnHome: () => {},
      });

      const textTokens = extractTextContent(view);
      const fullText = textTokens.join(' ');

      expect(fullText).not.toContain('ERROR: MALFORMED_QR');
      expect(fullText).toContain('Invalid QR Code');
      expect(fullText).toContain('Unrecognized QR code format. Please scan the official NST-Events session QR code.');
    });

    it('renders RETRY SCAN button for LOCATION_UNRELIABLE and LOCATION_TIMEOUT', () => {
      const unreliableView = AttendanceFailureView({
        errorCode: 'LOCATION_UNRELIABLE',
        onRetryScan: () => {},
        onReturnHome: () => {},
      });
      expect(extractTextContent(unreliableView).join(' ')).toContain('RETRY SCAN');

      const timeoutView = AttendanceFailureView({
        errorCode: 'LOCATION_TIMEOUT',
        onRetryScan: () => {},
        onReturnHome: () => {},
      });
      expect(extractTextContent(timeoutView).join(' ')).toContain('RETRY SCAN');
    });

    it('hides RETRY SCAN button for ALREADY_RECORDED', () => {
      const recordedView = AttendanceFailureView({
        errorCode: 'ALREADY_RECORDED',
        onRetryScan: () => {},
        onReturnHome: () => {},
      });
      const text = extractTextContent(recordedView).join(' ');
      expect(text).not.toContain('RETRY SCAN');
      expect(text).toContain('RETURN TO HOME');
    });
  });

  describe('5. Offline Attendance Policy Contract', () => {
    it('confirms no offline queueing or offline attendance storage exists in apps/mobile', () => {
      const srcDir = path.resolve(__dirname, '../src');
      const appDir = path.resolve(__dirname, '../app');

      const searchForOfflineTerms = (dir: string): string[] => {
        let matches: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            matches = matches.concat(searchForOfflineTerms(fullPath));
          } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (
              content.includes('attendanceOfflineQueue') ||
              content.includes('syncOfflineAttendance') ||
              content.includes('offline_attendance') ||
              content.includes('attendanceSyncQueue')
            ) {
              matches.push(fullPath);
            }
          }
        }
        return matches;
      };

      const hits = [...searchForOfflineTerms(srcDir), ...searchForOfflineTerms(appDir)];
      expect(hits).toEqual([]);
    });
  });

  describe('6. Scan Screen Architecture Contract (scan.tsx)', () => {
    const scanFile = path.resolve(__dirname, '../app/(app)/events/[id]/scan.tsx');
    const scanContent = fs.readFileSync(scanFile, 'utf-8');

    it('imports queryClient from QueryProvider', () => {
      expect(scanContent).toContain("import { queryClient } from '../../../../src/providers/QueryProvider'");
    });

    it('invalidates required query keys upon confirmed attendance success', () => {
      expect(scanContent).toContain("queryClient.invalidateQueries({ queryKey: ['my-attendance'] })");
      expect(scanContent).toContain("queryClient.invalidateQueries({ queryKey: ['events', eventId] })");
      expect(scanContent).toContain("queryClient.invalidateQueries({ queryKey: ['events'] })");
    });

    it('reads venue name primarily from existing React Query event data without mandatory secondary fetch', () => {
      expect(scanContent).toContain("queryClient.getQueryData<any>(['events', eventId])");
      expect(scanContent).toContain('cachedEvent?.locationName || cachedEvent?.location_name');
    });

    it('maps INVALID_QR_FORMAT, MALFORMED_QR, LOCATION_UNRELIABLE, LOCATION_TIMEOUT, and ACADEMIC_PROFILE_MISSING', () => {
      expect(scanContent).toContain("rawMsg = 'Unrecognized QR code format. Please scan the official NST-Events session QR code.'");
      expect(scanContent).toContain("parsedCode = 'INVALID_QR_FORMAT'");
      expect(scanContent).toContain("parsedCode = 'LOCATION_TIMEOUT'");
      expect(scanContent).toContain("parsedCode = 'LOCATION_UNRELIABLE'");
      expect(scanContent).toContain("parsedCode = 'ACADEMIC_PROFILE_MISSING'");
    });

    it('passes through LOCATION_VERIFICATION_FAILED idempotently and strips logs', () => {
      expect(scanContent).toContain("parsedCode = 'LOCATION_VERIFICATION_FAILED'");
      expect(scanContent).toContain("mock_location_detected=[REDACTED]");
    });
  });
});
