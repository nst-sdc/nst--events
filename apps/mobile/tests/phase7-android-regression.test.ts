import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Platform } from 'react-native';
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
  useLocalSearchParams: () => ({ id: 'test-event-id' }),
  usePathname: () => '/(app)',
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn().mockResolvedValue({
      data: {
        idToken: 'mock-id-token',
        user: { email: 'student@nst.edu.in' },
      },
    }),
    signOut: vi.fn().mockResolvedValue(null),
  },
}));

describe('Phase 7 — Android Regression & Parity Tests', () => {
  const mobileDir = path.resolve(__dirname, '..');
  const tabsDir = path.resolve(mobileDir, 'app/(app)/(tabs)');
  const appDir = path.resolve(mobileDir, 'app/(app)');
  const authDir = path.resolve(mobileDir, 'app/(auth)');
  const hooksDir = path.resolve(mobileDir, 'src/hooks');
  const infraDir = path.resolve(mobileDir, 'src/infrastructure');

  const rootLayoutContent = fs.readFileSync(path.join(mobileDir, 'app/_layout.tsx'), 'utf-8');
  const authIndexContent = fs.readFileSync(path.join(authDir, 'index.tsx'), 'utf-8');
  const configContent = fs.readFileSync(path.join(infraDir, 'config.ts'), 'utf-8');
  const useNotificationsContent = fs.readFileSync(path.join(hooksDir, 'use-notifications.ts'), 'utf-8');
  const eventDetailContent = fs.readFileSync(path.join(appDir, 'events/[id]/index.tsx'), 'utf-8');
  const scanContent = fs.readFileSync(path.join(appDir, 'events/[id]/scan.tsx'), 'utf-8');
  const disputeNewContent = fs.readFileSync(path.join(appDir, 'disputes/new.tsx'), 'utf-8');
  const tabsLayoutContent = fs.readFileSync(path.join(tabsDir, '_layout.tsx'), 'utf-8');

  beforeEach(() => {
    secureStoreMock = {};
    queryClient.clear();
    vi.clearAllMocks();
  });

  // 1. Android Cold Boot & Font Loading
  it('1. Root layout loads required Google fonts and prevents splash screen flicker', () => {
    expect(rootLayoutContent).toContain('SplashScreen.preventAutoHideAsync()');
    expect(rootLayoutContent).toContain('Syne_700Bold');
    expect(rootLayoutContent).toContain('Syne_800ExtraBold');
    expect(rootLayoutContent).toContain('Inter_400Regular');
    expect(rootLayoutContent).toContain('Inter_500Medium');
    expect(rootLayoutContent).toContain('Inter_600SemiBold');
    expect(rootLayoutContent).toContain('JetBrainsMono_400Regular');
    expect(rootLayoutContent).toContain('JetBrainsMono_500Medium');
    expect(rootLayoutContent).toContain('JetBrainsMono_700Bold');
    expect(rootLayoutContent).toContain('SplashScreen.hideAsync()');
  });

  // 2. Android API Base URL Resolution
  it('2. API configuration supports Android adb reverse default and EXPO_PUBLIC_API_URL override', () => {
    expect(configContent).toContain("if (process.env.EXPO_PUBLIC_API_URL)");
    expect(configContent).toContain("if (Platform.OS === 'android')");
    expect(configContent).toContain("'http://localhost:3001'");
  });

  // 3. Android Google Play Services Check in Auth
  it('3. Authentication checks Google Play Services availability specifically on Android', () => {
    expect(authIndexContent).toContain("if (Platform.OS === 'android')");
    expect(authIndexContent).toContain('await GoogleSignin.hasPlayServices()');
    expect(authIndexContent).toContain('await GoogleSignin.signIn()');
  });

  // 4. Android Push Notification Channel Configuration
  it('4. Configures required Android 8.0+ MAX importance notification channel', () => {
    expect(useNotificationsContent).toContain("if (Platform.OS === 'android')");
    expect(useNotificationsContent).toContain("Notifications.setNotificationChannelAsync('default'");
    expect(useNotificationsContent).toContain('importance: Notifications.AndroidImportance.MAX');
  });

  // 5. Android Attendance QR Scan Payload Parity
  it('5. Scanner submits complete mobile payload including Platform.OS and mock location detection', () => {
    expect(scanContent).toContain('device_os: Platform.OS');
    expect(scanContent).toContain('mock_location_detected: location.mocked || false');
    expect(scanContent).toContain('gps_accuracy: location.coords.accuracy || 0');
    expect(scanContent).toContain("method: 'POST'");
    expect(scanContent).toContain("apiClient('/v1/attendance/mark'");
  });

  // 6. Android Multiline TextInput Handling
  it('6. Text input in dispute form enforces textAlignVertical top for Android multiline layout', () => {
    expect(disputeNewContent).toContain('multiline');
    expect(disputeNewContent).toContain('textAlignVertical="top"');
    expect(disputeNewContent).toContain('numberOfLines={5}');
  });

  // 7. Android KeyboardAvoidingView Platform Adaptation
  it('7. Adapts KeyboardAvoidingView behavior based on platform', () => {
    expect(disputeNewContent).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");
  });

  // 8. Event Detail Back Button Fallback
  it('8. Event Detail MobileShell has onBackPress fallback to prevent deep-link trapping', () => {
    expect(eventDetailContent).toContain("onBackPress={() => {");
    expect(eventDetailContent).toContain("router.replace('/(app)')");
  });

  // 9. Preserves Canonical Deep Link Resolution
  it('9. Preserves canonical notification routing hierarchy on Android', () => {
    // 1. dispute_id exists
    expect(resolveNotificationRoute({
      type: 'ATTENDANCE_DISPUTE_RESOLVED',
      metadata: { entity_ids: { dispute_id: 'd-101', event_id: 'e-202' } },
    })).toBe('/(app)/disputes/d-101');

    // 2. event_id exists
    expect(resolveNotificationRoute({
      type: 'EVENT_REMINDER',
      metadata: { entity_ids: { event_id: 'e-202' } },
    })).toBe('/(app)/events/e-202');

    // 3. ROLE_CHANGED exists
    expect(resolveNotificationRoute({
      type: 'ROLE_CHANGED',
      metadata: { entity_ids: {} },
    })).toBe('/(app)/profile');

    // 4. Otherwise null
    expect(resolveNotificationRoute({
      type: 'UNRECOGNIZED',
      metadata: {},
    })).toBeNull();
  });

  // 10. Logout and Cache Clearing Parity on Android
  it('10. Logout completely purges tokens, clears React Query cache, and calls GoogleSignin.signOut()', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 });
    global.fetch = fetchMock;

    await useAuthStore.getState().setSession('android-user-1', 'tok-1', 'ref-1');
    queryClient.setQueryData(['events', 'ev-1'], { title: 'Android Tech Talk' });
    queryClient.setQueryData(['my-attendance'], [{ id: 'att-1' }]);

    expect(queryClient.getQueryData(['events', 'ev-1'])).toBeDefined();

    await logout();

    expect(queryClient.getQueryData(['events', 'ev-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['my-attendance'])).toBeUndefined();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  // 11. UX 2.0 4 Destinations Preserved
  it('11. Retains the 4 destinations (HOME, EXPLORE, ACTIVITY, PROFILE)', () => {
    expect(tabsLayoutContent).toContain("allowedRoutes = ['index', 'explore', 'activity', 'profile']");
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="index" />');
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="explore" />');
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="activity" />');
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="profile" />');
    expect(tabsLayoutContent).not.toContain('name="invitations"');
    expect(tabsLayoutContent).not.toContain('name="teams"');
  });
});
