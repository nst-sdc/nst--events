import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('NST Events Mobile UX 2.0 — Navigation & Architecture Verification Suite', () => {
  const rootAppDir = path.resolve(__dirname, '../app/(app)');
  const tabsDir = path.resolve(rootAppDir, '(tabs)');

  const tabsLayoutContent = fs.readFileSync(path.join(tabsDir, '_layout.tsx'), 'utf-8');
  const appLayoutContent = fs.readFileSync(path.join(rootAppDir, '_layout.tsx'), 'utf-8');
  const homeTabContent = fs.readFileSync(path.join(tabsDir, 'index.tsx'), 'utf-8');
  const exploreTabContent = fs.readFileSync(path.join(tabsDir, 'explore.tsx'), 'utf-8');
  const activityTabContent = fs.readFileSync(path.join(tabsDir, 'activity.tsx'), 'utf-8');
  const profileTabContent = fs.readFileSync(path.join(tabsDir, 'profile.tsx'), 'utf-8');

  describe('1. Primary 4-Destination Navigation Architecture', () => {
    it('defines exactly the 4 allowed destinations: index (HOME), explore, activity, profile', () => {
      expect(tabsLayoutContent).toContain("allowedRoutes = ['index', 'explore', 'activity', 'profile']");
    });

    it('declares the 4 primary Tabs.Screen components', () => {
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="index" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="explore" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="activity" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="profile" />');
    });

    it('retains history as a hidden route for backward link compatibility', () => {
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="history" options={{ href: null }} />');
    });

    it('prohibits rogue/detail screens from being registered as tabs', () => {
      expect(tabsLayoutContent).not.toContain('name="teams"');
      expect(tabsLayoutContent).not.toContain('name="events');
      expect(tabsLayoutContent).not.toContain('name="disputes');
      expect(tabsLayoutContent).not.toContain('name="settings"');
      expect(tabsLayoutContent).not.toContain('name="notifications"');
    });

    it('verifies that all primary destination tab files exist on disk', () => {
      const tabFiles = fs.readdirSync(tabsDir);
      expect(tabFiles).toContain('index.tsx');
      expect(tabFiles).toContain('explore.tsx');
      expect(tabFiles).toContain('activity.tsx');
      expect(tabFiles).toContain('profile.tsx');
      expect(tabFiles).toContain('history.tsx');
    });
  });

  describe('2. Destination 1 — Home Screen (index.tsx)', () => {
    it('configures MobileShell title to HOME with top notification inbox', () => {
      expect(homeTabContent).toContain('MobileShell \n      title="HOME"');
    });

    it('renders personalized student dashboard header', () => {
      expect(homeTabContent).toContain('STUDENT DASHBOARD');
      expect(homeTabContent).toContain('fullName.toUpperCase()');
      expect(homeTabContent).toContain('[STUDENT]');
    });

    it('renders Quick Actions tray with Attendance Scan, Explore, and Activity links', () => {
      expect(homeTabContent).toContain('[ 📸 SCAN ATTENDANCE ]');
      expect(homeTabContent).toContain('[ 🔍 EXPLORE CAMPUS ]');
      expect(homeTabContent).toContain('[ 📋 MY ACTIVITY ]');
      expect(homeTabContent).toContain("router.push('/(app)/(tabs)/explore')");
      expect(homeTabContent).toContain("router.push('/(app)/(tabs)/activity')");
    });

    it('includes context-aware pending squad invitations alert banner', () => {
      expect(homeTabContent).toContain('PENDING SQUAD INVITATION');
      expect(homeTabContent).toContain("router.push('/(app)/invitations')");
    });

    it('supports live attendance auto-elevation with ActiveAttendanceCard', () => {
      expect(homeTabContent).toContain('<ActiveAttendanceCard');
      expect(homeTabContent).toContain("router.push(`/(app)/events/${event.id}/scan`)");
    });
  });

  describe('3. Destination 2 — Explore Screen (explore.tsx)', () => {
    it('configures MobileShell title to EXPLORE', () => {
      expect(exploreTabContent).toContain('title="EXPLORE"');
    });

    it('provides search input with debouncing and clear control', () => {
      expect(exploreTabContent).toContain('testID="search-events-input"');
      expect(exploreTabContent).toContain('testID="btn-clear-search"');
      expect(exploreTabContent).toContain('SEARCH EVENTS...');
    });

    it('provides category filter chips and scope filter', () => {
      expect(exploreTabContent).toContain('testID="tab-all-events"');
      expect(exploreTabContent).toContain('testID="tab-my-clubs"');
      expect(exploreTabContent).toContain('category-chip-');
    });

    it('provides List vs Calendar view toggle', () => {
      expect(exploreTabContent).toContain('testID="view-toggle-list"');
      expect(exploreTabContent).toContain('testID="view-toggle-calendar"');
      expect(exploreTabContent).toContain('<StudentCalendarView');
    });

    it('provides campus shortcuts for Clubs, Student Directory, Leaderboard, and Projects', () => {
      expect(exploreTabContent).toContain('[ 👥 CLUBS ]');
      expect(exploreTabContent).toContain('[ 🔍 DIRECTORY ]');
      expect(exploreTabContent).toContain('[ 🏆 LEADERBOARD ]');
      expect(exploreTabContent).toContain('[ 🚀 PROJECTS ↗ ]');
      expect(exploreTabContent).toContain("router.push('/(app)/clubs')");
      expect(exploreTabContent).toContain("router.push('/(app)/students')");
      expect(exploreTabContent).toContain("router.push('/(app)/leaderboard')");
    });
  });

  describe('4. Destination 3 — Activity Screen (activity.tsx)', () => {
    it('configures MobileShell title to ACTIVITY', () => {
      expect(activityTabContent).toContain('title="ACTIVITY"');
    });

    it('implements segmented navigation: PASSES, INVITES, ATTENDANCE, DISPUTES, HONORS', () => {
      expect(activityTabContent).toContain('PASSES');
      expect(activityTabContent).toContain('INVITES');
      expect(activityTabContent).toContain('ATTENDANCE');
      expect(activityTabContent).toContain('DISPUTES');
      expect(activityTabContent).toContain('HONORS');
    });

    it('connects passes to Event Details, Squad Hub, and QR scanning', () => {
      expect(activityTabContent).toContain("router.push(`/(app)/events/${registration.eventId}`)");
      expect(activityTabContent).toContain("router.push(`/(app)/events/${registration.eventId}/teams`)");
      expect(activityTabContent).toContain("router.push(`/(app)/events/${registration.eventId}/scan`)");
    });

    it('connects team invitations with accept and decline confirmation modal', () => {
      expect(activityTabContent).toContain('CONFIRM SQUAD MEMBERSHIP');
      expect(activityTabContent).toContain('acceptInvitation');
      expect(activityTabContent).toContain('declineInvitation');
    });

    it('connects attendance logs to session detail route', () => {
      expect(activityTabContent).toContain("pathname: '/(app)/history/[id]'");
      expect(activityTabContent).toContain('<AttendanceHistoryRow');
    });

    it('connects attendance disputes with new claim filing and detail views', () => {
      expect(activityTabContent).toContain("router.push('/(app)/disputes/new')");
      expect(activityTabContent).toContain("router.push(`/(app)/disputes/${item.id}`)");
      expect(activityTabContent).toContain('<DisputeRow');
    });

    it('connects official honors to results and showcase project URLs', () => {
      expect(activityTabContent).toContain("router.push(`/(app)/events/${ach.event.id}/results`)");
      expect(activityTabContent).toContain('https://events.nstsdc.org/projects/');
    });
  });

  describe('5. Destination 4 — Profile Screen (profile.tsx)', () => {
    it('configures MobileShell title to PROFILE', () => {
      expect(profileTabContent).toContain('title="PROFILE"');
    });

    it('displays student identity, avatar initial, and verified affiliations', () => {
      expect(profileTabContent).toContain('styles.avatarInitial');
      expect(profileTabContent).toContain('styles.clubsSection');
    });

    it('provides public dossier link and visibility modal', () => {
      expect(profileTabContent).toContain("router.push(`/students/${mySlug}`");
      expect(profileTabContent).toContain('<ProfileVisibilityModal');
    });

    it('includes account navigation to settings, notifications, and dev club credits', () => {
      expect(profileTabContent).toContain("router.push('/(app)/settings')");
      expect(profileTabContent).toContain("router.push('/(app)/notifications')");
      expect(profileTabContent).toContain('<DevClubCreditsModal');
    });

    it('enforces confirmed logout modal flow', () => {
      expect(profileTabContent).toContain('END ACTIVE SESSION?');
      expect(profileTabContent).toContain('CONFIRM LOGOUT');
      expect(profileTabContent).toContain('handleConfirmLogout');
    });
  });

  describe('6. Root Stack Configuration & Exit Paths', () => {
    it('encloses (tabs) inside root (app) Stack navigator', () => {
      expect(appLayoutContent).toContain('<Stack.Screen name="(tabs)" />');
    });

    it('registers essential stack screens with hidden headers', () => {
      expect(appLayoutContent).toContain('<Stack screenOptions={{ headerShown: false }}>');
      expect(appLayoutContent).toContain('<Stack.Screen name="events/[id]/index" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="events/[id]/results" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="events/[id]/teams" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="history/[id]" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="disputes/index" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="notifications" />');
      expect(appLayoutContent).toContain('<Stack.Screen name="settings" />');
    });
  });
});
