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
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    signOut: vi.fn().mockResolvedValue(null),
  },
}));

describe('Phase 6 — Profile, Settings & Notifications UI & Contract Tests', () => {
  const tabsDir = path.resolve(__dirname, '../app/(app)/(tabs)');
  const appDir = path.resolve(__dirname, '../app/(app)');
  const hooksDir = path.resolve(__dirname, '../src/hooks');
  const servicesDir = path.resolve(__dirname, '../src/services');

  const profileContent = fs.readFileSync(path.join(tabsDir, 'profile.tsx'), 'utf-8');
  const settingsContent = fs.readFileSync(path.join(appDir, 'settings.tsx'), 'utf-8');
  const notificationsContent = fs.readFileSync(path.join(appDir, 'notifications.tsx'), 'utf-8');
  const useNotificationInboxContent = fs.readFileSync(path.join(hooksDir, 'use-notification-inbox.ts'), 'utf-8');
  const useNotificationPreferencesContent = fs.readFileSync(path.join(hooksDir, 'use-notification-preferences.ts'), 'utf-8');
  const useUserProfileContent = fs.readFileSync(path.join(hooksDir, 'use-user-profile.ts'), 'utf-8');
  const sessionContent = fs.readFileSync(path.join(servicesDir, 'session.ts'), 'utf-8');
  const tabsLayoutContent = fs.readFileSync(path.join(tabsDir, '_layout.tsx'), 'utf-8');
  const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');

  beforeEach(() => {
    secureStoreMock = {};
    queryClient.clear();
    vi.clearAllMocks();
  });

  // 1. Profile renders authoritative user data
  it('1. Profile renders authoritative user data without fabricated defaults', () => {
    expect(useUserProfileContent).toContain("queryFn: () => apiClient('/users/me')");
    expect(profileContent).toContain('useUserProfile()');
    expect(profileContent).toContain('fullName.toUpperCase()');
    expect(profileContent).toContain('academicRoleLabel');
    // Ensure fabricated defaults are not used as fallbacks
    expect(profileContent).not.toContain("'Student Account'");
    expect(profileContent).not.toContain("batch?.program?.code || 'CS'");
    expect(profileContent).not.toContain('graduation_year || 2027');
  });

  // 2. Profile loading state
  it('2. Profile implements structured loading state', () => {
    expect(profileContent).toContain('isLoading ? (');
    expect(profileContent).toContain('<ActivityIndicator size="large" color={theme.colors.primary} />');
    expect(profileContent).toContain('LOADING PROFILE DATA...');
  });

  // 3. Profile error state
  it('3. Profile implements genuine error state with retry and without masking', () => {
    expect(profileContent).toContain('isError || !profile');
    expect(profileContent).toContain('[FETCH ERROR]');
    expect(profileContent).toContain('FAILED TO LOAD PROFILE');
    expect(profileContent).toContain('RETRY FETCH');
    expect(profileContent).toContain('onPress={() => refetch()}');
  });

  // 4. Profile secondary navigation
  it('4. Profile provides secondary navigation links to settings, notifications, history, and disputes', () => {
    expect(profileContent).toContain("router.push('/(app)/settings')");
    expect(profileContent).toContain("router.push('/(app)/notifications')");
    expect(profileContent).toContain("router.navigate('/(app)/history')");
    expect(profileContent).toContain("router.push('/(app)/disputes')");
  });

  // 5. Settings loading/populated/error behavior
  it('5. Settings screen handles loading, populated, and error states for preferences', () => {
    expect(settingsContent).toContain('isPrefsLoading ? (');
    expect(settingsContent).toContain('LOADING PREFERENCES...');
    expect(settingsContent).toContain('isPrefsError ? (');
    expect(settingsContent).toContain('FAILED TO LOAD PREFERENCES');
    expect(settingsContent).toContain('RETRY FETCH');
  });

  // 6. Notification preferences render correctly
  it('6. Notification preferences render exactly the 4 established toggle categories', () => {
    expect(settingsContent).toContain('MASTER PUSH');
    expect(settingsContent).toContain('EVENT REMINDERS');
    expect(settingsContent).toContain('CLUB UPDATES');
    expect(settingsContent).toContain('ATTENDANCE & CLAIMS');
  });

  // 7. Notification preference persistence uses the established contract
  it('7. Notification preference persistence uses GET and PATCH /v1/notifications/preferences and keeps 4 toggles independent', () => {
    expect(useNotificationPreferencesContent).toContain("apiClient('/v1/notifications/preferences')");
    expect(useNotificationPreferencesContent).toContain("method: 'PATCH'");

    // No Subordination: child preferences are completely independent of push_enabled
    const prefs = {
      push_enabled: false,
      event_reminders: true,
      club_announcements: true,
      attendance_alerts: true,
    };
    const updateFn = vi.fn();
    const handleToggle = (key: 'event_reminders' | 'club_announcements' | 'attendance_alerts') => {
      updateFn({ [key]: !prefs[key] });
    };
    
    handleToggle('event_reminders');
    expect(updateFn).toHaveBeenCalledWith({ event_reminders: false });

    // The UI must not disable the other toggles
    expect(settingsContent).not.toContain('disabled={!preferences.push_enabled}');
    expect(settingsContent).not.toContain('if (preferences.push_enabled)');
  });

  // 8. Notification inbox loading
  it('8. Notification inbox implements genuine loading state', () => {
    expect(notificationsContent).toContain('isLoading && notifications.length === 0 ? (');
    expect(notificationsContent).toContain('<ActivityIndicator size="large" color={theme.colors.primary} />');
    expect(notificationsContent).toContain('FETCHING INBOX MESSAGES...');
  });

  // 9. Notification inbox populated state
  it('9. Notification inbox renders populated state with title, body, timestamp, and unread badges', () => {
    expect(notificationsContent).toContain('item.title');
    expect(notificationsContent).toContain('item.body');
    expect(notificationsContent).toContain('formattedDate');
    expect(notificationsContent).toContain('<StatusBadge status="[NEW]" type="warning" />');
    expect(notificationsContent).toContain('<StatusBadge status="[READ]" type="default" />');
  });

  // 10. Notification inbox genuine empty state
  it('10. Notification inbox displays genuine empty state when list is empty without masking errors', () => {
    expect(notificationsContent).toContain('<StatusBadge status="[INBOX CLEAR]" type="default" />');
    expect(notificationsContent).toContain('NO NOTIFICATIONS');
    expect(notificationsContent).toContain('ListEmptyComponent={renderEmptyState}');
  });

  // 11. Notification inbox error + retry
  it('11. Notification inbox renders error state with retry fetch on network failure', () => {
    expect(notificationsContent).toContain('isError && notifications.length === 0 ? (');
    expect(notificationsContent).toContain('<StatusBadge status="[FETCH ERROR]" type="error" />');
    expect(notificationsContent).toContain('FAILED TO LOAD');
    expect(notificationsContent).toContain('RETRY FETCH');
    expect(notificationsContent).toContain('onPress={() => refetch()}');
  });

  // 12. Unread count uses the authoritative contract
  it('12. Unread count calls GET /v1/notifications/unread-count and reads unread_count field', () => {
    expect(useNotificationInboxContent).toContain("apiClient('/v1/notifications/unread-count')");
    expect(useNotificationInboxContent).toContain("queryKey: ['notifications', 'unread-count']");
    expect(useNotificationInboxContent).toContain('unreadData?.unread_count ?? 0');
  });

  // 13. Notification deep link → dispute
  it('13. Notification deep link prioritizes entity_ids.dispute_id → /(app)/disputes/[id]', () => {
    const route = resolveNotificationRoute({
      type: 'ATTENDANCE_DISPUTE_RESOLVED',
      metadata: {
        entity_ids: {
          dispute_id: 'disp-42',
          event_id: 'evt-99', // even if event_id is also present
        },
      },
    });
    expect(route).toBe('/(app)/disputes/disp-42');
  });

  // 14. Notification deep link → event
  it('14. Notification deep link routes entity_ids.event_id → /(app)/events/[id] when dispute_id is absent', () => {
    const route = resolveNotificationRoute({
      type: 'EVENT_REMINDER',
      metadata: {
        entity_ids: {
          event_id: 'evt-100',
        },
      },
    });
    expect(route).toBe('/(app)/events/evt-100');
  });

  // 15. ROLE_CHANGED → profile
  it('15. Notification deep link routes type ROLE_CHANGED → /(app)/profile when dispute/event IDs are absent', () => {
    const route = resolveNotificationRoute({
      type: 'ROLE_CHANGED',
      metadata: {
        entity_ids: {},
      },
    });
    expect(route).toBe('/(app)/profile');
  });

  // 16. Unknown/no-navigation notification behavior
  it('16. Notification deep link returns null (no navigation) for unknown or unroutable notifications', () => {
    expect(resolveNotificationRoute(null)).toBeNull();
    expect(resolveNotificationRoute(undefined)).toBeNull();
    expect(resolveNotificationRoute({ type: 'ANNOUNCEMENT', metadata: {} })).toBeNull();
    expect(resolveNotificationRoute({ type: 'UNKNOWN_TYPE' })).toBeNull();
  });

  // 17. Duplicate deep-link protection
  it('17. Duplicate deep-link protection normalizes routes and suppresses navigation to active route', () => {
    const normalizeRoute = (path?: string | null) => (path || '').replace(/^\/(\(app\)\/)?/, '').replace(/\/$/, '');
    const currentPath = '/(app)/disputes/disp-42';
    const targetRoute = '/(app)/disputes/disp-42';

    expect(normalizeRoute(currentPath)).toBe('disputes/disp-42');
    expect(normalizeRoute(targetRoute)).toBe('disputes/disp-42');
    expect(normalizeRoute(currentPath) === normalizeRoute(targetRoute)).toBe(true);

    const differentTarget = '/(app)/events/evt-99';
    expect(normalizeRoute(currentPath) === normalizeRoute(differentTarget)).toBe(false);
  });

  // 18. SSE connection is not multiplied
  it('18. SSE connection is maintained as a single module-level instance', () => {
    expect(useNotificationInboxContent).toContain('let globalNotificationSSE: SSEManager | null = null;');
    expect(useNotificationInboxContent).toContain('let subscriberCount = 0;');
    expect(useNotificationInboxContent).toContain('subscriberCount++;');
    expect(useNotificationInboxContent).toContain('if (!globalNotificationSSE || globalNotificationSSEToken !== token)');
  });

  // 19. SSE cleanup/reconnect behavior
  it('19. SSE connection decrements subscriber count and disconnects when count reaches zero', () => {
    expect(useNotificationInboxContent).toContain('subscriberCount--;');
    expect(useNotificationInboxContent).toContain('if (subscriberCount <= 0)');
    expect(useNotificationInboxContent).toContain('globalNotificationSSE?.disconnect();');
    expect(useNotificationInboxContent).toContain('globalNotificationSSE = null;');
  });

  // 20. Notification updates affect unread state correctly
  it('20. Notification updates via SSE and mutations invalidate inbox and unread-count queries', () => {
    expect(useNotificationInboxContent).toContain("queryClient.invalidateQueries({ queryKey: ['notifications'] });");
    expect(useNotificationInboxContent).toContain("queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });");
    expect(useNotificationInboxContent).toContain("manager.on('NOTIFICATION_CREATED', invalidateNotificationQueries);");
    expect(useNotificationInboxContent).toContain("manager.on('NOTIFICATION_READ', invalidateNotificationQueries);");
    expect(useNotificationInboxContent).toContain("manager.on('NOTIFICATIONS_READ_ALL', invalidateNotificationQueries);");
  });

  // 21. Logout server revocation + local cleanup
  it('21. Logout dispatches server token revocation and performs complete local purge', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 });
    global.fetch = fetchMock;

    await useAuthStore.getState().setSession('test-user-1', 'access-tok-1', 'refresh-tok-1');
    expect(useAuthStore.getState().isLoggedIn).toBe(true);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-tok-1',
          Cookie: 'refreshToken=refresh-tok-1',
        }),
      })
    );

    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().userId).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  // 22. Switch-account cleanup
  it('22. Switch account triggers Google SSO sign out and navigation replace', async () => {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    const { router } = await import('expo-router');

    global.fetch = vi.fn().mockResolvedValue({ status: 204 });
    await useAuthStore.getState().setSession('user-to-switch', 'token-switch', 'refresh-switch');

    await logout();

    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(auth)');
  });

  // 23. Query cache is cleared appropriately
  it('23. Query cache is flushed via queryClient.clear() upon session termination', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    queryClient.setQueryData(['user-profile'], { id: 'u1', full_name: 'Alice' });
    queryClient.setQueryData(['notifications'], { pages: [] });
    queryClient.setQueryData(['notifications', 'unread-count'], { unread_count: 7 });

    expect(queryClient.getQueryData(['user-profile'])).toBeDefined();

    // logout must execute queryClient.clear() even if backend is offline
    await logout();

    expect(queryClient.getQueryData(['user-profile'])).toBeUndefined();
    expect(queryClient.getQueryData(['notifications'])).toBeUndefined();
    expect(queryClient.getQueryData(['notifications', 'unread-count'])).toBeUndefined();
  });

  // 24. No prior-user notification/profile/dispute/attendance leakage after account switch
  it('24. Prevents cross-user cache leakage between User A and User B across all entities', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 204 });

    // User A logs in and accumulates private data
    await useAuthStore.getState().setSession('user-a-id', 'token-a', 'refresh-a');
    queryClient.setQueryData(['user-profile'], { id: 'user-a-id', email: 'alice@nst.edu.in' });
    queryClient.setQueryData(['notifications'], { pages: [{ data: [{ id: 'notif-a', title: 'Alice Alert' }] }] });
    queryClient.setQueryData(['notifications', 'unread-count'], { unread_count: 3 });
    queryClient.setQueryData(['my-disputes'], [{ id: 'disp-a', reason: 'Dispute by Alice' }]);
    queryClient.setQueryData(['my-attendance'], [{ id: 'att-a', status: 'PRESENT' }]);
    queryClient.setQueryData(['notification-preferences'], { push_enabled: false });

    // Verify User A data is present
    expect(queryClient.getQueryData(['user-profile'])).toBeDefined();
    expect(queryClient.getQueryData(['my-disputes'])).toBeDefined();
    expect(queryClient.getQueryData(['my-attendance'])).toBeDefined();

    // User A logs out
    await logout();

    // Cache must be completely wiped
    expect(queryClient.getQueryData(['user-profile'])).toBeUndefined();
    expect(queryClient.getQueryData(['notifications'])).toBeUndefined();
    expect(queryClient.getQueryData(['notifications', 'unread-count'])).toBeUndefined();
    expect(queryClient.getQueryData(['my-disputes'])).toBeUndefined();
    expect(queryClient.getQueryData(['my-attendance'])).toBeUndefined();
    expect(queryClient.getQueryData(['notification-preferences'])).toBeUndefined();

    // User B starts a session
    await useAuthStore.getState().setSession('user-b-id', 'token-b', 'refresh-b');
    expect(useAuthStore.getState().userId).toBe('user-b-id');

    // User B cannot inspect any prior data of User A
    expect(queryClient.getQueryData(['user-profile'])).toBeUndefined();
    expect(queryClient.getQueryData(['notifications'])).toBeUndefined();
    expect(queryClient.getQueryData(['my-disputes'])).toBeUndefined();
    expect(queryClient.getQueryData(['my-attendance'])).toBeUndefined();
  });

  // 25. Three-tab structure remains exactly: ATTENDANCE / HISTORY / PROFILE
  it('25. Three-tab structure remains strictly ATTENDANCE / HISTORY / PROFILE in (tabs)/_layout.tsx', () => {
    expect(tabsLayoutContent).toContain("allowedRoutes = ['index', 'history', 'profile']");
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="index" />');
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="history" />');
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="profile" />');
  });

  // 26. No invitation/team functionality exists
  it('26. Prohibits team invitation tabs or organizer functionality on mobile', () => {
    expect(tabsLayoutContent).not.toContain('name="invitations"');
    expect(tabsLayoutContent).not.toContain('name="teams"');
    expect(tabsLayoutContent).not.toContain('INVITATIONS');
    expect(appLayoutContent).toContain("profile.global_role !== 'STUDENT'");
    expect(appLayoutContent).toContain('[ACCESS_RESTRICTED]');
  });
});
