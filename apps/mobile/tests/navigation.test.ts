import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('NST-Events Mobile V1 Navigation Architecture Tests', () => {
  const appDir = path.resolve(__dirname, '../app/(app)');
  const tabsDir = path.resolve(__dirname, '../app/(app)/(tabs)');

  describe('1. Permanent 3-Tab Navigator Contract', () => {
    it('only registers the 3 frozen tabs: index, history, profile in (tabs)/_layout.tsx', () => {
      const tabsLayoutContent = fs.readFileSync(path.join(tabsDir, '_layout.tsx'), 'utf-8');

      // Allowed routes in tab bar
      expect(tabsLayoutContent).toContain("allowedRoutes = ['index', 'history', 'profile']");

      // Tabs.Screen declarations
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="index" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="history" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="profile" />');

      // Prohibit detail screens inside tabs navigator
      expect(tabsLayoutContent).not.toContain('name="events');
      expect(tabsLayoutContent).not.toContain('name="disputes');
      expect(tabsLayoutContent).not.toContain('name="notifications"');
      expect(tabsLayoutContent).not.toContain('name="settings"');
      expect(tabsLayoutContent).not.toContain('name="invitations"');
    });

    it('ensures no duplicate tab files exist directly under app/(app)', () => {
      const appFiles = fs.readdirSync(appDir);
      expect(appFiles).not.toContain('index.tsx');
      expect(appFiles).not.toContain('history.tsx');
      expect(appFiles).not.toContain('profile.tsx');
    });

    it('ensures the 3 tab files exist under app/(app)/(tabs)', () => {
      const tabFiles = fs.readdirSync(tabsDir);
      expect(tabFiles).toContain('index.tsx');
      expect(tabFiles).toContain('history.tsx');
      expect(tabFiles).toContain('profile.tsx');
    });
  });

  describe('2. Root (app) Stack Navigator Contract', () => {
    it('configures (app)/_layout.tsx as a Stack enclosing (tabs) and stack detail screens', () => {
      const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');

      // Encloses (tabs) group
      expect(appLayoutContent).toContain('<Stack screenOptions={{ headerShown: false }}>');
      expect(appLayoutContent).toContain('<Stack.Screen name="(tabs)" />');

      // Encloses detail screens
      expect(appLayoutContent).toContain('<Stack.Screen name="events/[id]/index" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="events/[id]/scan" options={{ presentation: \'fullScreenModal\' }} />');
      expect(appLayoutContent).toContain('<Stack.Screen name="history/[id]" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="disputes/index" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="disputes/new" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="disputes/submitted" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="disputes/[id]" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="notifications" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="settings" />');

      // Scanner must be configured as a fullScreenModal
      expect(appLayoutContent).toMatch(/name="events\/\[id\]\/scan"\s+options=\{\{\s*presentation:\s*'fullScreenModal'\s*\}\}/);
    });

    it('does not register deprecated/deferred /invitations in the active Stack', () => {
      const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
      expect(appLayoutContent).not.toContain('name="invitations"');
    });
  });

  describe('3. Tab Switching Contracts', () => {
    it('uses router.navigate(\'/(app)/history\') in Profile tab for tab switching', () => {
      const profileContent = fs.readFileSync(path.join(tabsDir, 'profile.tsx'), 'utf-8');
      expect(profileContent).toContain("router.navigate('/(app)/history')");
      expect(profileContent).not.toContain("router.push('/history')");
    });

    it('uses router.navigate(\'/(app)/history\') in Disputes empty state CTA', () => {
      const disputesIndexContent = fs.readFileSync(path.join(appDir, 'disputes/index.tsx'), 'utf-8');
      expect(disputesIndexContent).toContain("router.navigate('/(app)/history')");
      expect(disputesIndexContent).not.toContain("router.push('/history')");
    });
  });

  describe('4. Dispute & History Detail Navigation Flow Contracts', () => {
    it('uses router.push(\'/(app)/disputes\') on "RETURN TO MY DISPUTES" in disputes/[id].tsx', () => {
      const disputeDetailContent = fs.readFileSync(path.join(appDir, 'disputes/[id].tsx'), 'utf-8');
      expect(disputeDetailContent).toContain("title=\"RETURN TO MY DISPUTES\"");
      expect(disputeDetailContent).toContain("onPress={() => router.push('/(app)/disputes')}");
    });

    it('sets title to "SESSION DETAILS" and navigates existing dispute to /(app)/disputes/[id] in history/[id].tsx', () => {
      const historyDetailContent = fs.readFileSync(path.join(appDir, 'history/[id].tsx'), 'utf-8');
      expect(historyDetailContent).toContain('MobileShell title="SESSION DETAILS"');
      expect(historyDetailContent).toContain("pathname: '/(app)/disputes/[id]'");
      expect(historyDetailContent).toContain("pathname: '/(app)/disputes/new'");
      expect(historyDetailContent).not.toContain("router.push(`/disputes/submitted");
    });

    it('uses canonical routes in disputes/submitted.tsx CTAs', () => {
      const submittedContent = fs.readFileSync(path.join(appDir, 'disputes/submitted.tsx'), 'utf-8');
      expect(submittedContent).toContain("onPress={() => router.replace('/(app)/disputes')}");
      expect(submittedContent).toContain("onPress={() => router.replace('/(app)')}");
      expect(submittedContent).not.toContain("router.replace('/')");
      expect(submittedContent).not.toContain("router.replace('/disputes')");
    });

    it('uses canonical route in disputes/new.tsx submission success', () => {
      const newDisputeContent = fs.readFileSync(path.join(appDir, 'disputes/new.tsx'), 'utf-8');
      expect(newDisputeContent).toContain("pathname: '/(app)/disputes/submitted'");
    });
  });

  describe('5. Attendance Scanner Modal Dismissal / Return Home Contract', () => {
    it('uses router.canDismiss() ? router.dismissAll() : router.replace(\'/(app)\') in scan.tsx', () => {
      const scanContent = fs.readFileSync(path.join(appDir, 'events/[id]/scan.tsx'), 'utf-8');
      expect(scanContent).toContain('if (router.canDismiss())');
      expect(scanContent).toContain('router.dismissAll()');
      expect(scanContent).toContain("router.replace('/(app)')");
    });

    it('routes to /(app)/events/${id}/scan from Event Detail Screen', () => {
      const eventDetailContent = fs.readFileSync(path.join(appDir, 'events/[id]/index.tsx'), 'utf-8');
      expect(eventDetailContent).toContain("router.push(`/(app)/events/${id}/scan`)");
    });
  });

  describe('6. Settings & MobileShell Back Navigation Safety Contracts', () => {
    it('guards MobileShell handleBack with router.canGoBack()', () => {
      const shellContent = fs.readFileSync(
        path.resolve(__dirname, '../src/ui/core/MobileShell.tsx'),
        'utf-8'
      );
      expect(shellContent).toContain('if (onBackPress) {');
      expect(shellContent).toContain('onBackPress();');
      expect(shellContent).toContain('} else if (router.canGoBack()) {');
      expect(shellContent).toContain('router.back();');
    });

    it('provides fallback to /(app)/profile when stack is empty in settings.tsx', () => {
      const settingsContent = fs.readFileSync(path.join(appDir, 'settings.tsx'), 'utf-8');
      expect(settingsContent).toContain('if (router.canGoBack())');
      expect(settingsContent).toContain('router.back()');
      expect(settingsContent).toContain("router.replace('/(app)/profile')");
    });
  });

  describe('7. Push Notification Deduplication & Route Normalization', () => {
    const normalizeRoute = (path?: string | null) => (path || '').replace(/^\/(\(app\)\/)?/, '').replace(/\/$/, '');

    it('correctly normalizes current pathname and target route', () => {
      expect(normalizeRoute('/(app)/profile')).toBe('profile');
      expect(normalizeRoute('/profile')).toBe('profile');
      expect(normalizeRoute('/(app)/events/evt-123')).toBe('events/evt-123');
      expect(normalizeRoute('/events/evt-123')).toBe('events/evt-123');
      expect(normalizeRoute('/(app)/disputes/disp-456')).toBe('disputes/disp-456');
    });

    it('prevents duplicate navigation when user is already on the target route', () => {
      const routerPush = vi.fn();
      const currentPath = '/(app)/events/evt-123';
      const targetRoute = '/(app)/events/evt-123';

      if (normalizeRoute(currentPath) !== normalizeRoute(targetRoute)) {
        routerPush(targetRoute);
      }
      expect(routerPush).not.toHaveBeenCalled();
    });

    it('allows navigation when user is on a different route', () => {
      const routerPush = vi.fn();
      const currentPath = '/(app)/profile';
      const targetRoute = '/(app)/events/evt-123';

      if (normalizeRoute(currentPath) !== normalizeRoute(targetRoute)) {
        routerPush(targetRoute);
      }
      expect(routerPush).toHaveBeenCalledWith('/(app)/events/evt-123');
    });

    it('prevents redundant cold-start handling with identifier tracking', () => {
      const routerPush = vi.fn();
      let handledId: string | null = null;

      const handleNotification = (notifId: string, route: string) => {
        if (handledId === notifId) return;
        handledId = notifId;
        routerPush(route);
      };

      handleNotification('notif-1', '/(app)/disputes/disp-1');
      expect(routerPush).toHaveBeenCalledTimes(1);

      // Re-trigger with same ID
      handleNotification('notif-1', '/(app)/disputes/disp-1');
      expect(routerPush).toHaveBeenCalledTimes(1);

      // Different ID
      handleNotification('notif-2', '/(app)/events/evt-2');
      expect(routerPush).toHaveBeenCalledTimes(2);
    });
  });
});
