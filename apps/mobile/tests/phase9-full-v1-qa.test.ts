import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resolveNotificationRoute } from '../src/lib/notification-routing';
import { useAuthStore } from '../src/store/auth';
import { queryClient } from '../src/providers/QueryProvider';
import { logout } from '../src/services/session';
import * as SecureStore from 'expo-secure-store';

let secureStoreMock: Record<string, string> = {};

vi.mock('expo-secure-store', () => ({
  setItemAsync: async (key: string, value: string) => { secureStoreMock[key] = value; },
  getItemAsync: async (key: string) => secureStoreMock[key] || null,
  deleteItemAsync: async (key: string) => { delete secureStoreMock[key]; },
  _reset: () => { secureStoreMock = {}; },
}));

vi.mock('expo-router', () => ({
  router: {
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    navigate: vi.fn(),
  },
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    navigate: vi.fn(),
    canGoBack: vi.fn().mockReturnValue(true),
  }),
  useLocalSearchParams: () => ({ id: 'qa-event-id' }),
  usePathname: () => '/(app)',
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn().mockResolvedValue({
      data: {
        idToken: 'qa-mock-token',
        user: { email: 'student@nst.edu.in' },
      },
    }),
    signOut: vi.fn().mockResolvedValue(null),
  },
}));

describe('Phase 9 — Full Mobile V1 End-to-End QA Test Suite', () => {
  const mobileDir = path.resolve(__dirname, '..');
  const tabsDir = path.resolve(mobileDir, 'app/(app)/(tabs)');
  const appDir = path.resolve(mobileDir, 'app/(app)');
  const authDir = path.resolve(mobileDir, 'app/(auth)');
  const hooksDir = path.resolve(mobileDir, 'src/hooks');

  const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
  const tabsLayoutContent = fs.readFileSync(path.join(tabsDir, '_layout.tsx'), 'utf-8');
  const authIndexContent = fs.readFileSync(path.join(authDir, 'index.tsx'), 'utf-8');
  const homeTabContent = fs.readFileSync(path.join(tabsDir, 'index.tsx'), 'utf-8');
  const historyTabContent = fs.readFileSync(path.join(tabsDir, 'history.tsx'), 'utf-8');
  const profileTabContent = fs.readFileSync(path.join(tabsDir, 'profile.tsx'), 'utf-8');
  const eventDetailContent = fs.readFileSync(path.join(appDir, 'events/[id]/index.tsx'), 'utf-8');
  const scanContent = fs.readFileSync(path.join(appDir, 'events/[id]/scan.tsx'), 'utf-8');
  const disputesIndexContent = fs.readFileSync(path.join(appDir, 'disputes/index.tsx'), 'utf-8');
  const disputeNewContent = fs.readFileSync(path.join(appDir, 'disputes/new.tsx'), 'utf-8');
  const disputeDetailContent = fs.readFileSync(path.join(appDir, 'disputes/[id].tsx'), 'utf-8');
  const notificationsContent = fs.readFileSync(path.join(appDir, 'notifications.tsx'), 'utf-8');
  const settingsContent = fs.readFileSync(path.join(appDir, 'settings.tsx'), 'utf-8');
  const useNotificationInboxContent = fs.readFileSync(path.join(hooksDir, 'use-notification-inbox.ts'), 'utf-8');

  beforeEach(() => {
    secureStoreMock = {};
    queryClient.clear();
    vi.clearAllMocks();
  });

  // 1. Navigation Architecture & Tabs
  it('1. Navigation architecture preserves strictly 3 tabs and no team tabs or routes', () => {
    expect(tabsLayoutContent).toContain("allowedRoutes = ['index', 'history', 'profile']");
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="index" />');
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="history" />');
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="profile" />');
    expect(tabsLayoutContent).not.toContain('name="invitations"');
    expect(tabsLayoutContent).not.toContain('name="teams"');
    expect(appLayoutContent).not.toContain('name="invitations"');
  });

  // 2. Authentication & Domain Restriction
  it('2. Enforces institutional domain validation and student role check', () => {
    expect(authIndexContent).toContain('INSTITUTIONAL_DOMAIN_NOT_ALLOWED');
    expect(authIndexContent).toContain('STUDENT_ACCESS_NOT_AUTHORIZED');
    expect(appLayoutContent).toContain("profile.global_role !== 'STUDENT'");
    expect(appLayoutContent).toContain('[ACCESS_RESTRICTED]');
  });

  // 3. Logout & Account Switch Cache Security
  it('3. Logout executes server revocation, purges local credentials, and flushes query cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 });
    global.fetch = fetchMock;

    await useAuthStore.getState().setSession('user-qa-1', 'tok-qa-1', 'ref-qa-1');
    queryClient.setQueryData(['user-profile'], { id: 'user-qa-1' });
    queryClient.setQueryData(['events'], [{ id: 'evt-qa-1' }]);
    queryClient.setQueryData(['my-attendance'], [{ id: 'att-qa-1' }]);
    queryClient.setQueryData(['my-disputes'], [{ id: 'disp-qa-1' }]);
    queryClient.setQueryData(['notifications'], { pages: [] });

    expect(queryClient.getQueryData(['user-profile'])).toBeDefined();

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(queryClient.getQueryData(['user-profile'])).toBeUndefined();
    expect(queryClient.getQueryData(['events'])).toBeUndefined();
    expect(queryClient.getQueryData(['my-attendance'])).toBeUndefined();
    expect(queryClient.getQueryData(['my-disputes'])).toBeUndefined();
    expect(queryClient.getQueryData(['notifications'])).toBeUndefined();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  // 4. Home & Attendance Feed
  it('4. Home tab classifies ongoing and upcoming events with status indicators', () => {
    expect(homeTabContent).toContain('findActiveAttendanceSession');
    expect(homeTabContent).toContain('isEventCurrentlyLive');
    expect(homeTabContent).toContain('ActiveAttendanceCard');
    expect(homeTabContent).toContain('EventCard');
    expect(homeTabContent).toContain('ONGOING');
    expect(homeTabContent).toContain('UPCOMING');
  });

  // 5. Event Detail & Back Fallbacks
  it('5. Event Detail handles loading, 404, fetch error, and provides onBackPress fallback', () => {
    expect(eventDetailContent).toContain('MobileShell');
    expect(eventDetailContent).toContain("onBackPress={() => {");
    expect(eventDetailContent).toContain("router.replace('/(app)')");
    expect(eventDetailContent).toContain('[NOT FOUND]');
    expect(eventDetailContent).toContain('[FETCH ERROR]');
  });

  // 6. QR Scanner & Verification Lifecycle
  it('6. QR Scanner enforces full-screen modal, camera & location permissions, and payload structure', () => {
    expect(appLayoutContent).toContain("options={{ presentation: 'fullScreenModal' }}");
    expect(scanContent).toContain('Location.getForegroundPermissionsAsync()');
    expect(scanContent).toContain('device_id: deviceId');
    expect(scanContent).toContain('device_os: Platform.OS');
    expect(scanContent).toContain('mock_location_detected: location.mocked || false');
    expect(scanContent).toContain("queryClient.invalidateQueries({ queryKey: ['my-attendance'] })");
  });

  // 7. Attendance History & Session Detail
  it('7. Attendance History ledger implements loading, error with retry, and navigates to session detail', () => {
    expect(historyTabContent).toContain('FETCHING ATTENDANCE LOGS...');
    expect(historyTabContent).toContain('FAILED TO LOAD');
    expect(historyTabContent).toContain('RETRY FETCH');
    expect(historyTabContent).toContain("pathname: '/(app)/history/[id]'");
  });

  // 8. Disputes Creation & Cache Invalidation
  it('8. Dispute submission enforces 10-1000 character limits and invalidates my-disputes query', () => {
    const useDisputesContent = fs.readFileSync(path.join(hooksDir, 'use-disputes.ts'), 'utf-8');
    expect(disputeNewContent).toContain('val.length <= 1000');
    expect(disputeNewContent).toContain('!isValid');
    expect(disputeNewContent).toContain('textAlignVertical="top"');
    expect(useDisputesContent).toContain("apiClient('/v1/attendance/disputes'");
    expect(useDisputesContent).toContain("queryKey: ['my-disputes']");
    expect(useDisputesContent).toContain("queryKey: ['my-attendance']");
  });

  // 9. Single Dispute Detail from Client Cache
  it('9. Dispute detail resolves from existing cache without inventing unsupported GET endpoint', () => {
    expect(disputeDetailContent).toContain('useDisputeDetail');
    expect(disputeDetailContent).not.toContain("apiClient(`/v1/attendance/disputes/${");
  });

  // 10. Notifications Inbox & Unread Count
  it('10. Notifications inbox handles pagination, empty/error states, and authoritative unread count', () => {
    expect(notificationsContent).toContain('useNotificationInbox()');
    expect(notificationsContent).toContain('NO NOTIFICATIONS');
    expect(notificationsContent).toContain('FAILED TO LOAD');
    expect(notificationsContent).toContain('MARK ALL READ');
    expect(useNotificationInboxContent).toContain("apiClient('/v1/notifications/unread-count')");
  });

  // 11. Notification SSE Singleton Lifecycle
  it('11. SSE connection is maintained as a single ref-counted singleton across the application', () => {
    expect(useNotificationInboxContent).toContain('let globalNotificationSSE: SSEManager | null = null;');
    expect(useNotificationInboxContent).toContain('let subscriberCount = 0;');
    expect(useNotificationInboxContent).toContain('subscriberCount++;');
    expect(useNotificationInboxContent).toContain('subscriberCount--;');
    expect(useNotificationInboxContent).toContain('globalNotificationSSE?.disconnect();');
  });

  // 12. Notification Deep Linking Canonical Contract
  it('12. Preserves canonical notification deep linking hierarchy and duplicate route suppression', () => {
    expect(resolveNotificationRoute({
      type: 'ATTENDANCE_DISPUTE_RESOLVED',
      metadata: { entity_ids: { dispute_id: 'disp-qa-99' } },
    })).toBe('/(app)/disputes/disp-qa-99');

    expect(resolveNotificationRoute({
      type: 'EVENT_REMINDER',
      metadata: { entity_ids: { event_id: 'evt-qa-88' } },
    })).toBe('/(app)/events/evt-qa-88');

    expect(resolveNotificationRoute({
      type: 'ROLE_CHANGED',
      metadata: { entity_ids: {} },
    })).toBe('/(app)/profile');

    expect(resolveNotificationRoute({
      type: 'TEAM_INVITATION_RECEIVED',
      metadata: {},
    })).toBeNull();
  });

  // 13. Profile Authoritative Data & Zero Invention
  it('13. Profile renders authoritative identity without fabricated fallback strings', () => {
    expect(profileTabContent).toContain('useUserProfile()');
    expect(profileTabContent).toContain('FAILED TO LOAD PROFILE');
    expect(profileTabContent).toContain('RETRY FETCH');
    expect(profileTabContent).not.toContain("'Student Account'");
    expect(profileTabContent).not.toContain("batch?.program?.code || 'CS'");
    expect(profileTabContent).not.toContain('graduation_year || 2027');
  });

  // 14. Settings & Notification Preferences Subordination
  it('14. Settings screen renders 4 preferences with subordination and account session actions', () => {
    expect(settingsContent).toContain('MASTER PUSH');
    expect(settingsContent).toContain('EVENT REMINDERS');
    expect(settingsContent).toContain('CLUB UPDATES');
    expect(settingsContent).toContain('ATTENDANCE & CLAIMS');
    expect(settingsContent).toContain('ACCOUNT / SESSION');
    expect(settingsContent).toContain('SWITCH ACCOUNT');
    expect(settingsContent).toContain('[ LOG OUT ]');
    expect(settingsContent).toContain('FAILED TO LOAD PREFERENCES');
  });
});
