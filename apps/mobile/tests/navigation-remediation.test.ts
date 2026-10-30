import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('NST-Events Mobile Navigation Remediation & Regression Suite', () => {
  const mobileDir = path.resolve(__dirname, '..');
  const appDir = path.join(mobileDir, 'app/(app)');
  const rootAppDir = path.join(mobileDir, 'app');

  describe('BUG-01: Session Initialization Race & Deep-Link Preservation on Cold Boot', () => {
    it('(app)/_layout.tsx guards authentication check with isInitialized', () => {
      const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
      expect(appLayoutContent).toContain('const isInitialized = useAuthStore((state) => state.isInitialized);');
      expect(appLayoutContent).toContain('const initSession = useAuthStore((state) => state.initSession);');
      expect(appLayoutContent).toContain('if (!isInitialized) return;');
    });

    it('(app)/_layout.tsx triggers initSession() if not initialized', () => {
      const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
      expect(appLayoutContent).toMatch(/if\s*\(!isInitialized\)\s*\{\s*initSession\(\);\s*\}/);
    });

    it('(app)/_layout.tsx does not call logout() for unauthenticated cold boots, avoiding pendingDeepLink wiping', () => {
      const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
      // Must not call logout() unconditionally on !isLoggedIn
      expect(appLayoutContent).not.toContain('if (!isLoggedIn || isError) {\n      logout();\n    }');
      // Must redirect to /(auth) when !isLoggedIn, and only logout on isError
      expect(appLayoutContent).toContain("router.replace('/(auth)')");
    });

    it('(app)/_layout.tsx holds credential validator loading view while !isInitialized or isLoading', () => {
      const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
      expect(appLayoutContent).toContain('if (!isInitialized || isLoading)');
    });

    it('Root _layout.tsx triggers initSession() on app boot mount', () => {
      const rootLayoutContent = fs.readFileSync(path.join(rootAppDir, '_layout.tsx'), 'utf-8');
      expect(rootLayoutContent).toContain('const initSession = useAuthStore((state) => state.initSession);');
      expect(rootLayoutContent).toContain('const isInitialized = useAuthStore((state) => state.isInitialized);');
      expect(rootLayoutContent).toMatch(/if\s*\(!isInitialized\)\s*\{\s*initSession\(\);\s*\}/);
    });

    it('(app)/_layout.tsx redirects unauthenticated sessions after isInitialized resolves', () => {
      const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
      expect(appLayoutContent).toMatch(/if\s*\(!isLoggedIn\)\s*\{\s*router\.replace\('\/\(auth\)'\);\s*\}/);
    });
  });

  describe('BUG-02: Trapped Screen on Direct Registration Deep Link', () => {
    it('events/[id]/register.tsx defines handleBack with fallback to parent event', () => {
      const registerContent = fs.readFileSync(path.join(appDir, 'events/[id]/register.tsx'), 'utf-8');
      expect(registerContent).toContain('if (router.canGoBack())');
      expect(registerContent).toContain('router.back()');
      expect(registerContent).toContain("router.replace(`/(app)/events/${id}`)");
    });

    it('events/[id]/register.tsx passes onBackPress={handleBack} to MobileShell', () => {
      const registerContent = fs.readFileSync(path.join(appDir, 'events/[id]/register.tsx'), 'utf-8');
      expect(registerContent).toContain('MobileShell title="EVENT REGISTRATION" showBackButton onBackPress={handleBack}');
    });

    it('events/[id]/register.tsx uses handleBack in handleSubmit, empty fields, and cancel buttons', () => {
      const registerContent = fs.readFileSync(path.join(appDir, 'events/[id]/register.tsx'), 'utf-8');
      expect(registerContent).toContain('await registerAsync({ responses: toResponsePayload(responses) });');
      expect(registerContent).toContain('handleBack();');
      expect(registerContent).toContain('<Button title="[ GO BACK ]" variant="secondary" onPress={handleBack} />');
      expect(registerContent).toContain('<Button\n          title="[ CANCEL ]"\n          variant="secondary"\n          onPress={handleBack}');
    });
  });

  describe('BUG-03: Missing Stack Declaration for Squad Hub', () => {
    it('(app)/_layout.tsx includes events/[id]/teams Stack.Screen', () => {
      const appLayoutContent = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
      expect(appLayoutContent).toContain('<Stack.Screen name="events/[id]/teams" />');
    });
  });

  describe('BUG-04: Trapped Screens Without Back Buttons: Clubs', () => {
    it('clubs/index.tsx provides showBackButton and onBackPress fallback to /(app)/profile', () => {
      const clubsContent = fs.readFileSync(path.join(appDir, 'clubs/index.tsx'), 'utf-8');
      expect(clubsContent).toContain('showBackButton');
      expect(clubsContent).toContain('onBackPress={handleBackToProfile}');
      expect(clubsContent).toContain('if (router.canGoBack())');
      expect(clubsContent).toContain("router.replace('/(app)/profile')");
    });

    it('students/index.tsx provides onBackPress fallback to /(app)/profile', () => {
      const studentsContent = fs.readFileSync(path.join(appDir, 'students/index.tsx'), 'utf-8');
      expect(studentsContent).toContain('onBackPress={handleBackToProfile}');
      expect(studentsContent).toContain('if (router.canGoBack())');
      expect(studentsContent).toContain("router.replace('/(app)/profile')");
    });
  });

  describe('BUG-05: Trapped Screen in Event Forms', () => {
    it('events/[id]/forms/[formId].tsx defines handleBack with fallback to parent event', () => {
      const formContent = fs.readFileSync(path.join(appDir, 'events/[id]/forms/[formId].tsx'), 'utf-8');
      expect(formContent).toContain('if (router.canGoBack())');
      expect(formContent).toContain('router.back()');
      expect(formContent).toContain("router.replace(`/(app)/events/${id}`)");
    });

    it('events/[id]/forms/[formId].tsx provides onBackPress={handleBack} on all MobileShell states', () => {
      const formContent = fs.readFileSync(path.join(appDir, 'events/[id]/forms/[formId].tsx'), 'utf-8');
      expect(formContent).toContain('MobileShell title="EVENT FORM" showBackButton onBackPress={handleBack}');
      expect(formContent).toContain('MobileShell title={form.title} showBackButton onBackPress={handleBack}');
    });

    it('events/[id]/forms/[formId].tsx uses handleBack on [ DONE ] and [ CANCEL ] CTAs', () => {
      const formContent = fs.readFileSync(path.join(appDir, 'events/[id]/forms/[formId].tsx'), 'utf-8');
      expect(formContent).toContain('<Button title="[ DONE ]" onPress={handleBack} />');
      expect(formContent).toContain('title="[ CANCEL ]"');
      expect(formContent).toContain('onPress={handleBack}');
    });
  });

  describe('BUG-06: Trapped Screen in Student Profiles 404/Unlisted State', () => {
    it('students/[slug].tsx defines handleBackToDirectory with fallback to /(app)/students', () => {
      const profileContent = fs.readFileSync(path.join(appDir, 'students/[slug].tsx'), 'utf-8');
      expect(profileContent).toContain('if (router.canGoBack())');
      expect(profileContent).toContain('router.back()');
      expect(profileContent).toContain("router.replace('/(app)/students')");
    });

    it('students/[slug].tsx passes onBackPress={handleBackToDirectory} to MobileShell', () => {
      const profileContent = fs.readFileSync(path.join(appDir, 'students/[slug].tsx'), 'utf-8');
      expect(profileContent).toContain('onBackPress={handleBackToDirectory}');
    });

    it('students/[slug].tsx uses handleBackToDirectory on RETURN TO DIRECTORY CTA', () => {
      const profileContent = fs.readFileSync(path.join(appDir, 'students/[slug].tsx'), 'utf-8');
      expect(profileContent).toContain('onPress={handleBackToDirectory}');
      expect(profileContent).toContain('<Text style={styles.shareBtnText}>RETURN TO DIRECTORY</Text>');
    });
  });

  describe('BUG-07: Route Path Inconsistencies & Canonical Routes', () => {
    it('(tabs)/index.tsx uses canonical /(app)/events routes for cards and actions', () => {
      const tabsIndexContent = fs.readFileSync(path.join(appDir, '(tabs)/index.tsx'), 'utf-8');
      expect(tabsIndexContent).toContain("router.push(`/(app)/events/${event.id}/scan`)");
      expect(tabsIndexContent).toContain("router.push(`/(app)/events/${event.id}`)");
      expect(tabsIndexContent).not.toMatch(/router\.push\(`\/events\/\$\{event\.id\}/);
    });

    it('(tabs)/profile.tsx uses canonical /(app)/students route for directory menu item', () => {
      const profileContent = fs.readFileSync(path.join(appDir, '(tabs)/profile.tsx'), 'utf-8');
      expect(profileContent).toContain("router.push('/(app)/students')");
      expect(profileContent).not.toContain("router.push('/students' as any)");
    });

    it('invitations.tsx uses canonical /(app)/events route for squad hub navigation', () => {
      const invitationsContent = fs.readFileSync(path.join(appDir, 'invitations.tsx'), 'utf-8');
      expect(invitationsContent).toContain("router.push(`/(app)/events/${inv.event.event_id}/teams`)");
    });
  });

  describe('BUG-08: Orphaned & Race-Prone Root Splash Route', () => {
    it('splash.tsx initializes session and waits for isInitialized', () => {
      const splashContent = fs.readFileSync(path.join(rootAppDir, 'splash.tsx'), 'utf-8');
      expect(splashContent).toContain('const isInitialized = useAuthStore((state) => state.isInitialized);');
      expect(splashContent).toContain('const initSession = useAuthStore((state) => state.initSession);');
      expect(splashContent).toMatch(/if\s*\(!isInitialized\)\s*\{\s*initSession\(\);\s*\}/);
    });

    it('splash.tsx routes using authState.isLoggedIn and preserves pendingDeepLink', () => {
      const splashContent = fs.readFileSync(path.join(rootAppDir, 'splash.tsx'), 'utf-8');
      expect(splashContent).toContain('const authState = useAuthStore.getState();');
      expect(splashContent).toContain('if (authState.isLoggedIn)');
      expect(splashContent).toContain('const pendingDeepLink = authState.pendingDeepLink;');
      expect(splashContent).toContain("router.replace('/(auth)')");
    });
  });

  describe('BUG-09: Broken Return CTAs in Results & Teams', () => {
    it('events/[id]/results.tsx uses handleReturnToEvent for all return buttons', () => {
      const resultsContent = fs.readFileSync(path.join(appDir, 'events/[id]/results.tsx'), 'utf-8');
      expect(resultsContent).toContain('const handleReturnToEvent = () => {');
      expect(resultsContent).toContain('onBackPress={handleReturnToEvent}');
      // All 3 restricted/withdrawn/pending buttons must use handleReturnToEvent
      const returnMatches = resultsContent.match(/title="\[ RETURN TO EVENT \]"[\s\S]*?onPress=\{handleReturnToEvent\}/g);
      expect(returnMatches).not.toBeNull();
      expect(returnMatches!.length).toBe(3);
    });

    it('events/[id]/teams.tsx uses handleBackToEvent for leave confirmation and return button', () => {
      const teamsContent = fs.readFileSync(path.join(appDir, 'events/[id]/teams.tsx'), 'utf-8');
      expect(teamsContent).toContain('const handleBackToEvent = () => {');
      expect(teamsContent).toContain('onBackPress={handleBackToEvent}');
      expect(teamsContent).toContain('title="[ RETURN TO EVENT ]"');
      expect(teamsContent).toContain('onPress={handleBackToEvent}');
    });
  });

  describe('BUG-10: Unauthenticated Notification Deep Links Preservation', () => {
    it('use-notifications.ts preserves pendingDeepLink on cold start and runtime events when unauthenticated', () => {
      const notifHookContent = fs.readFileSync(path.join(mobileDir, 'src/hooks/use-notifications.ts'), 'utf-8');
      // Must not drop notification when !isLoggedIn
      expect(notifHookContent).not.toContain('if (lastNotificationResponse && isLoggedIn)');
      expect(notifHookContent).not.toContain('if (!isLoggedIn) return;');
      // Must save pending deep link when !isLoggedIn
      expect(notifHookContent).toContain('useAuthStore.getState().setPendingDeepLink(route);');
    });
  });

  describe('BUG-11: Dual Header Typography Duplication & Nested ScrollViews', () => {
    it('clubs/index.tsx sets MobileShell title to STUDENT CLUBS and scrollable={false}', () => {
      const clubsContent = fs.readFileSync(path.join(appDir, 'clubs/index.tsx'), 'utf-8');
      expect(clubsContent).toContain('title="STUDENT CLUBS"');
      expect(clubsContent).toContain('scrollable={false}');
      // No duplicate Display header title inside scroll view
      expect(clubsContent).not.toContain('<Display style={styles.headerTitle}>STUDENT CLUBS</Display>');
    });
  });
});
