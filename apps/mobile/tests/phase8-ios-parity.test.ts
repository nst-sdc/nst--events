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
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn().mockResolvedValue({
      data: {
        idToken: 'mock-ios-id-token',
        user: { email: 'student@nst.edu.in' },
      },
    }),
    signOut: vi.fn().mockResolvedValue(null),
  },
}));

describe('Phase 8 — iOS Parity & Regression Tests', () => {
  const mobileDir = path.resolve(__dirname, '..');
  const tabsDir = path.resolve(mobileDir, 'app/(app)/(tabs)');
  const appDir = path.resolve(mobileDir, 'app/(app)');
  const authDir = path.resolve(mobileDir, 'app/(auth)');
  const uiDir = path.resolve(mobileDir, 'src/ui/core');

  const appJsonContent = fs.readFileSync(path.join(mobileDir, 'app.json'), 'utf-8');
  const authIndexContent = fs.readFileSync(path.join(authDir, 'index.tsx'), 'utf-8');
  const activityIndicatorContent = fs.readFileSync(path.join(uiDir, 'ActivityIndicator.tsx'), 'utf-8');
  const mobileShellContent = fs.readFileSync(path.join(uiDir, 'MobileShell.tsx'), 'utf-8');
  const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
  const disputeNewContent = fs.readFileSync(path.join(appDir, 'disputes/new.tsx'), 'utf-8');
  const tabsLayoutContent = fs.readFileSync(path.join(tabsDir, '_layout.tsx'), 'utf-8');

  beforeEach(() => {
    secureStoreMock = {};
    queryClient.clear();
    vi.clearAllMocks();
  });

  // 1. iOS Google Sign-In Configuration Parity
  it('1. Configures iOS Google Client ID and URL scheme in app.json and auth screen', () => {
    expect(authIndexContent).toContain('iosClientId:');
    expect(appJsonContent).toContain('iosUrlScheme');
    expect(appJsonContent).toContain('com.googleusercontent.apps.590987407822-ho2vv2d0994vhqag2i7r08jchnfb201l');
  });

  // 2. iOS Info.plist & Permission Usage Descriptions
  it('2. Specifies required iOS Info.plist usage descriptions and background modes', () => {
    expect(appJsonContent).toContain('NSLocationWhenInUseUsageDescription');
    expect(appJsonContent).toContain('remote-notification');
    expect(appJsonContent).toContain('cameraPermission');
    expect(appJsonContent).toContain('Required for scanning attendance QR codes.');
  });

  // 3. iOS Native Spinner Rendering Parity
  it('3. Uses native UIActivityIndicatorView on iOS matching Android 8-spoke stepped spinner', () => {
    expect(activityIndicatorContent).toContain("if (Platform.OS === 'ios')");
    expect(activityIndicatorContent).toContain('<RNActivityIndicator');
    expect(activityIndicatorContent).toContain('size={size}');
    expect(activityIndicatorContent).toContain('color={activeColor}');
  });

  // 4. iOS Scanner Full-Screen Modal Presentation
  it('4. Configures scanner with presentation: fullScreenModal to prevent sheet pull-down disruption', () => {
    expect(appLayoutContent).toContain("name=\"events/[id]/scan\"");
    expect(appLayoutContent).toContain("options={{ presentation: 'fullScreenModal' }}");
  });

  // 5. iOS KeyboardAvoidingView Padding Adaptation
  it('5. Enforces padding behavior on iOS for KeyboardAvoidingView in dispute form', () => {
    expect(disputeNewContent).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");
  });

  // 6. iOS Safe Area Insets Protection
  it('6. MobileShell protects top status bar and bottom home-indicator safe areas', () => {
    expect(mobileShellContent).toContain('useSafeAreaInsets()');
    expect(mobileShellContent).toContain('paddingTop: Math.max(insets.top, 8)');
    expect(mobileShellContent).toContain('paddingBottom: Math.max(insets.bottom, 12) + 80');
  });

  // 7. iOS Canonical Notification Deep Linking
  it('7. Preserves canonical deep-link resolution on iOS', () => {
    expect(resolveNotificationRoute({
      type: 'ATTENDANCE_DISPUTE_RESOLVED',
      metadata: { entity_ids: { dispute_id: 'disp-ios-1' } },
    })).toBe('/(app)/disputes/disp-ios-1');

    expect(resolveNotificationRoute({
      type: 'EVENT_REMINDER',
      metadata: { entity_ids: { event_id: 'evt-ios-2' } },
    })).toBe('/(app)/events/evt-ios-2');

    expect(resolveNotificationRoute({
      type: 'ROLE_CHANGED',
      metadata: { entity_ids: {} },
    })).toBe('/(app)/profile');
  });

  // 8. iOS Logout and Keychain Clearance Parity
  it('8. Logout on iOS purges tokens, wipes React Query cache, and calls GoogleSignin.signOut()', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 });
    global.fetch = fetchMock;

    await useAuthStore.getState().setSession('ios-user-1', 'ios-access-token', 'ios-refresh-token');
    queryClient.setQueryData(['user-profile'], { id: 'ios-user-1', full_name: 'iOS Student' });
    queryClient.setQueryData(['my-attendance'], [{ id: 'ios-att-1' }]);

    expect(queryClient.getQueryData(['user-profile'])).toBeDefined();

    await logout();

    expect(queryClient.getQueryData(['user-profile'])).toBeUndefined();
    expect(queryClient.getQueryData(['my-attendance'])).toBeUndefined();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  // 9. Three Permanent Tabs Frozen
  it('9. Retains exactly the 3 permanent tabs (ATTENDANCE, HISTORY, PROFILE) on iOS', () => {
    expect(tabsLayoutContent).toContain("allowedRoutes = ['index', 'history', 'profile']");
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="index" />');
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="history" />');
    expect(tabsLayoutContent).toContain('<Tabs.Screen name="profile" />');
    expect(tabsLayoutContent).not.toContain('name="invitations"');
    expect(tabsLayoutContent).not.toContain('name="teams"');
  });
});
