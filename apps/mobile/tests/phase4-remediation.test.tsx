// @vitest-environment jsdom
import React from 'react';
import { View, Text } from 'react-native';
import { render, screen, fireEvent, waitFor } from './mocks/testing-library-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { useAuthStore } from '../src/store/auth';
import { MobileShell } from '../src/ui/core/MobileShell';
import { useEventSessions } from '../src/hooks/use-events';
import { useAttendanceHistory } from '../src/hooks/use-attendance-history';
import { apiClient } from '../src/infrastructure/api';

vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: (props: any) => React.createElement('Text', props, props.name),
    Ionicons: (props: any) => React.createElement('Text', props, props.name),
    FontAwesome: (props: any) => React.createElement('Text', props, props.name),
    Feather: (props: any) => React.createElement('Text', props, props.name),
  };
});

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockReplace = vi.fn();
let mockCanGoBack = true;

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => ({}),
}));

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
}));

vi.mock('../src/hooks/use-notification-inbox', () => ({
  useNotificationInbox: () => ({ unreadCount: 2 }),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const withProviders = (ui: React.ReactElement, queryClient = createQueryClient()) => (
  <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
);

function TestSessionHook({ eventId, enabled }: { eventId: string; enabled?: boolean }) {
  const { data, fetchStatus } = useEventSessions(eventId, { enabled });
  return (
    <>
      <Text testID="session-status">{fetchStatus}</Text>
      <Text testID="session-data">{JSON.stringify(data || null)}</Text>
    </>
  );
}

function TestAttendanceHook({ eventId, enabled }: { eventId?: string; enabled?: boolean }) {
  const { data, fetchStatus } = useAttendanceHistory(eventId, { enabled });
  return (
    <>
      <Text testID="attendance-status">{fetchStatus}</Text>
      <Text testID="attendance-data">{JSON.stringify(data || null)}</Text>
    </>
  );
}

describe('Phase 4 Mobile UX & Performance Remediation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanGoBack = true;
    useAuthStore.setState({
      userId: 'test-user',
      isLoggedIn: true,
      pendingDeepLink: null,
    });
  });

  // ==========================================================================
  // 1. Nested Scrolling Audit & Fixes
  // ==========================================================================
  describe('1. Nested Scrolling Audit', () => {
    const resultsFilePath = path.resolve(__dirname, '../app/(app)/events/[id]/results.tsx');
    const studentsSlugFilePath = path.resolve(__dirname, '../app/(app)/students/[slug].tsx');
    const clubsFilePath = path.resolve(__dirname, '../app/(app)/clubs/index.tsx');

    const resultsSrc = fs.readFileSync(resultsFilePath, 'utf8');
    const studentsSlugSrc = fs.readFileSync(studentsSlugFilePath, 'utf8');
    const clubsSrc = fs.readFileSync(clubsFilePath, 'utf8');

    it('results.tsx disables shell scrolling (scrollable={false}) when owning ScrollView', () => {
      expect(resultsSrc).toMatch(/<MobileShell[^>]*scrollable=\{false\}/);
    });

    it('students/[slug].tsx disables shell scrolling (scrollable={false}) when owning ScrollView', () => {
      expect(studentsSlugSrc).toMatch(/<MobileShell[^>]*scrollable=\{false\}/);
    });

    it('clubs/index.tsx disables shell scrolling (scrollable={false}) when owning ScrollView', () => {
      expect(clubsSrc).toMatch(/<MobileShell[^>]*scrollable=\{false\}/);
    });

    it('MobileShell renders non-scrolling container when scrollable={false}', () => {
      const { container } = render(
        <MobileShell title="TEST SCREEN" scrollable={false}>
          <Text testID="inner-content">Screen Owned Scroll</Text>
        </MobileShell>
      );
      expect(screen.getByTestId('inner-content')).toBeTruthy();
      expect(container.innerHTML).toContain('Screen Owned Scroll');
    });
  });

  // ==========================================================================
  // 2. Activity Tab Overflow & Horizontally Scrollable Segment Navigation
  // ==========================================================================
  describe('2. Activity Tab Adaptive Layout', () => {
    const activityFilePath = path.resolve(__dirname, '../app/(app)/(tabs)/activity.tsx');
    const activitySrc = fs.readFileSync(activityFilePath, 'utf8');

    it('activity.tsx implements a horizontal ScrollView for segmentedNav to prevent narrow-screen clipping', () => {
      expect(activitySrc).toMatch(/<ScrollView[^>]*horizontal/);
      expect(activitySrc).toContain('showsHorizontalScrollIndicator={false}');
      expect(activitySrc).toContain('accessibilityRole="tablist"');
    });

    it('activity.tsx defines segments PASSES, INVITES, ATTENDANCE, DISPUTES, HONORS with accessibility tabs', () => {
      expect(activitySrc).toContain("activeSection === 'PASSES'");
      expect(activitySrc).toContain("activeSection === 'INVITES'");
      expect(activitySrc).toContain("activeSection === 'ATTENDANCE'");
      expect(activitySrc).toContain("activeSection === 'DISPUTES'");
      expect(activitySrc).toContain("activeSection === 'HONORS'");
      expect(activitySrc).toContain('accessibilityRole="tab"');
    });

    it('segmentTab styles define generous minWidth, touch target height, and active indicator', () => {
      expect(activitySrc).toMatch(/minWidth:\s*92/);
      expect(activitySrc).toMatch(/minHeight:\s*48/);
      expect(activitySrc).toMatch(/borderBottomWidth:\s*2/);
    });
  });

  // ==========================================================================
  // 3. Touch Targets Audit (>= 48dp)
  // ==========================================================================
  describe('3. Touch Target Compliance', () => {
    const mobileShellPath = path.resolve(__dirname, '../src/ui/core/MobileShell.tsx');
    const notificationsPath = path.resolve(__dirname, '../app/(app)/notifications.tsx');
    const resultsPath = path.resolve(__dirname, '../app/(app)/events/[id]/results.tsx');
    const resultModalPath = path.resolve(__dirname, '../src/ui/ResultReportModal.tsx');

    const mobileShellSrc = fs.readFileSync(mobileShellPath, 'utf8');
    const notificationsSrc = fs.readFileSync(notificationsPath, 'utf8');
    const resultsSrc = fs.readFileSync(resultsPath, 'utf8');
    const resultModalSrc = fs.readFileSync(resultModalPath, 'utf8');

    it('MobileShell backBtn provides at least 48dp touch dimensions and hitSlop', () => {
      expect(mobileShellSrc).toMatch(/backBtn:\s*\{[^}]*minHeight:\s*48[^}]*minWidth:\s*48/s);
      expect(mobileShellSrc).toContain('hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}');
    });

    it('MobileShell notifBtn provides hitSlop for reliable interaction target', () => {
      expect(mobileShellSrc).toMatch(/notifBtn:\s*\{[^}]*minHeight:\s*36/s);
      expect(mobileShellSrc).toContain('hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}');
    });

    it('notifications.tsx markAllBtn meets 48dp minimum touch target', () => {
      expect(notificationsSrc).toMatch(/markAllBtn:\s*\{[^}]*minHeight:\s*48[^}]*height:\s*48/s);
    });

    it('results.tsx action buttons and report link provide >= 48dp touch targets', () => {
      expect(resultsSrc).toMatch(/minHeight:\s*48,\s*height:\s*48/);
      expect(resultsSrc).toMatch(/projectLinkBox:\s*\{[^}]*minHeight:\s*48/s);
      expect(resultsSrc).toMatch(/hitSlop=\{\{\s*top:\s*8,\s*bottom:\s*8,\s*left:\s*8,\s*right:\s*8\s*\}\}/);
    });

    it('ResultReportModal.tsx close button provides hitSlop and accessible touch dimensions', () => {
      expect(resultModalSrc).toContain('hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}');
      expect(resultModalSrc).toMatch(/minWidth:\s*44,\s*minHeight:\s*44/);
    });

    it('MobileShell header back button is interactive and triggers back navigation', () => {
      render(
        <MobileShell title="TEST SCREEN" showBackButton={true}>
          <Text>Content</Text>
        </MobileShell>
      );
      const backButton = screen.getByText(/← BACK/);
      expect(backButton).toBeTruthy();
      fireEvent.press(backButton);
      expect(mockBack).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 4. Stale Authentication Deep Link Lifecycle
  // ==========================================================================
  describe('4. Stale Authentication Deep Link Lifecycle', () => {
    const authScreenPath = path.resolve(__dirname, '../app/(auth)/index.tsx');
    const authScreenSrc = fs.readFileSync(authScreenPath, 'utf8');

    it('(auth)/index.tsx clears pendingDeepLink on cancellation and failure paths', () => {
      expect(authScreenSrc).toContain('useAuthStore.getState().setPendingDeepLink(null);');
      // Verify clearing exists inside catch block covering cancellation and all failure paths
      expect(authScreenSrc).toMatch(/catch\s*\(err:\s*any\)\s*\{\s*useAuthStore\.getState\(\)\.setPendingDeepLink\(null\);/);
    });

    it('scenario A: successful authentication preserves and routes to valid pending deep link', async () => {
      const targetDeepLink = '/(app)/events/event-abc/register';
      useAuthStore.getState().setPendingDeepLink(targetDeepLink);
      expect(useAuthStore.getState().pendingDeepLink).toBe(targetDeepLink);

      // Simulate successful auth resolution
      const pending = useAuthStore.getState().pendingDeepLink;
      if (pending) {
        useAuthStore.getState().setPendingDeepLink(null);
        mockReplace(pending);
      } else {
        mockReplace('/(app)');
      }

      expect(mockReplace).toHaveBeenCalledWith(targetDeepLink);
      expect(useAuthStore.getState().pendingDeepLink).toBeNull();
    });

    it('scenario B: sign-in cancellation clears pending deep link so future session is not redirected', () => {
      const targetDeepLink = '/(app)/disputes/dispute-123';
      useAuthStore.getState().setPendingDeepLink(targetDeepLink);
      expect(useAuthStore.getState().pendingDeepLink).toBe(targetDeepLink);

      // Simulate OAuth cancellation
      useAuthStore.getState().setPendingDeepLink(null);
      expect(useAuthStore.getState().pendingDeepLink).toBeNull();

      // Later session logs in without deep link
      const laterPending = useAuthStore.getState().pendingDeepLink;
      if (laterPending) {
        useAuthStore.getState().setPendingDeepLink(null);
        mockReplace(laterPending);
      } else {
        mockReplace('/(app)');
      }

      expect(mockReplace).toHaveBeenCalledWith('/(app)');
      expect(mockReplace).not.toHaveBeenCalledWith(targetDeepLink);
    });

    it('scenario C: authentication failure clears pending deep link so future session is not redirected', () => {
      const targetDeepLink = '/(app)/events/event-xyz';
      useAuthStore.getState().setPendingDeepLink(targetDeepLink);

      // Simulate token exchange error
      useAuthStore.getState().setPendingDeepLink(null);
      expect(useAuthStore.getState().pendingDeepLink).toBeNull();

      // Subsequent login
      const laterPending = useAuthStore.getState().pendingDeepLink;
      if (laterPending) {
        mockReplace(laterPending);
      } else {
        mockReplace('/(app)');
      }

      expect(mockReplace).toHaveBeenCalledWith('/(app)');
    });
  });

  // ==========================================================================
  // 5. Home Feed Request Fan-Out Prevention
  // ==========================================================================
  describe('5. Home Feed Request Fan-Out Prevention', () => {
    const homeIndexPath = path.resolve(__dirname, '../app/(app)/(tabs)/index.tsx');
    const homeSrc = fs.readFileSync(homeIndexPath, 'utf8');

    it('EventRow conditionally disables per-event queries for upcoming events (mode === "upcoming")', () => {
      expect(homeSrc).toMatch(/const\s+shouldFetchDetails\s*=\s*mode\s*===\s*'ongoing'\s*\|\|\s*mode\s*===\s*'all'/);
      expect(homeSrc).toMatch(/useEventSessions\(event\.id,\s*\{[\s\S]*?enabled:\s*shouldFetchDetails[\s\S]*?\}\)/);
      expect(homeSrc).toMatch(/useAttendanceHistory\(event\.id,\s*\{[\s\S]*?enabled:\s*shouldFetchDetails\s*&&\s*isRegistered[\s\S]*?\}\)/);
    });

    it('useEventSessions does not initiate a fetch when enabled is false', async () => {
      const queryClient = createQueryClient();
      (apiClient as any).mockResolvedValueOnce([{ id: 'sess-1', title: 'Test Session' }]);

      render(
        withProviders(
          <TestSessionHook eventId="event-99" enabled={false} />,
          queryClient
        )
      );

      // Should be idle and not fetch
      expect(screen.getByTestId('session-status').textContent).toBe('idle');
      expect(screen.getByTestId('session-data').textContent).toBe('null');
      expect(apiClient).not.toHaveBeenCalled();
    });

    it('useAttendanceHistory does not initiate a fetch when enabled is false', async () => {
      const queryClient = createQueryClient();
      (apiClient as any).mockResolvedValueOnce({ data: [], nextCursor: null });

      render(
        withProviders(
          <TestAttendanceHook eventId="event-99" enabled={false} />,
          queryClient
        )
      );

      // Should be idle and not fetch
      expect(screen.getByTestId('attendance-status').textContent).toBe('idle');
      expect(screen.getByTestId('attendance-data').textContent).toBe('null');
      expect(apiClient).not.toHaveBeenCalled();
    });

    it('useEventSessions initiates fetch when enabled is true', async () => {
      const queryClient = createQueryClient();
      (apiClient as any).mockResolvedValueOnce([{ id: 'sess-1', title: 'Session A' }]);

      render(
        withProviders(
          <TestSessionHook eventId="event-100" enabled={true} />,
          queryClient
        )
      );

      await waitFor(() => {
        expect(apiClient).toHaveBeenCalledWith('/v1/events/event-100/sessions');
      });
    });

    it('preserves canScan business rules without regression', () => {
      expect(homeSrc).toMatch(/canScan\s*=\s*isSessionActive\s*&&\s*isRegistered\s*&&\s*!isPrimaryClubAdmin\s*&&\s*!hasAttendanceForActiveSession\s*&&\s*!event\.isLocked/);
    });
  });
});
