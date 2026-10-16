import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 5 — Attendance History & Disputes Contract Tests', () => {
  const tabsDir = path.resolve(__dirname, '../app/(app)/(tabs)');
  const appDir = path.resolve(__dirname, '../app/(app)');
  const hooksDir = path.resolve(__dirname, '../src/hooks');

  const historyTabContent = fs.readFileSync(path.join(tabsDir, 'history.tsx'), 'utf-8');
  const historyDetailContent = fs.readFileSync(path.join(appDir, 'history/[id].tsx'), 'utf-8');
  const disputesIndexContent = fs.readFileSync(path.join(appDir, 'disputes/index.tsx'), 'utf-8');
  const disputesNewContent = fs.readFileSync(path.join(appDir, 'disputes/new.tsx'), 'utf-8');
  const disputesSubmittedContent = fs.readFileSync(path.join(appDir, 'disputes/submitted.tsx'), 'utf-8');
  const disputesDetailContent = fs.readFileSync(path.join(appDir, 'disputes/[id].tsx'), 'utf-8');
  const useDisputesContent = fs.readFileSync(path.join(hooksDir, 'use-disputes.ts'), 'utf-8');
  const useAttendanceHistoryContent = fs.readFileSync(path.join(hooksDir, 'use-attendance-history.ts'), 'utf-8');
  const tabsLayoutContent = fs.readFileSync(path.join(tabsDir, '_layout.tsx'), 'utf-8');

  describe('1. Navigation & UX 2.0 Destinations Contract', () => {
    it('registers the 4 destinations (index, explore, activity, profile) in (tabs)/_layout.tsx', () => {
      expect(tabsLayoutContent).toContain("allowedRoutes = ['index', 'explore', 'activity', 'profile']");
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="index" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="explore" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="activity" />');
      expect(tabsLayoutContent).toContain('<Tabs.Screen name="profile" />');
    });

    it('prohibits deprecated invitation/team screens and detail screens from being tabs', () => {
      expect(tabsLayoutContent).not.toContain('name="invitations"');
      expect(tabsLayoutContent).not.toContain('name="teams"');
      expect(tabsLayoutContent).not.toContain('name="disputes"');
      expect(tabsLayoutContent).not.toContain('name="history/[id]"');
    });
  });

  describe('2. Attendance History Tab (history.tsx)', () => {
    it('implements genuine loading state with ActivityIndicator and branded label', () => {
      expect(historyTabContent).toContain('isLoading ? (');
      expect(historyTabContent).toContain('<ActivityIndicator size="large" color={theme.colors.primary} />');
      expect(historyTabContent).toContain('FETCHING ATTENDANCE LOGS...');
    });

    it('implements genuine error state with retry button', () => {
      expect(historyTabContent).toContain('isError ? (');
      expect(historyTabContent).toContain('<Display style={styles.errorTitle}>FAILED TO LOAD</Display>');
      expect(historyTabContent).toContain('error?.message || \'Unable to connect to attendance service.\'');
      expect(historyTabContent).toContain('onPress={() => refetch()}');
      expect(historyTabContent).toContain('RETRY FETCH');
    });

    it('implements genuine empty state without masking error state', () => {
      expect(historyTabContent).toContain('<Display style={styles.emptyTitle}>NO ATTENDANCE RECORDS</Display>');
      expect(historyTabContent).toContain('Scan a QR code at an event to build your record.');
    });

    it('navigates to /(app)/history/[id] on record press passing session.eventId', () => {
      expect(historyTabContent).toContain("pathname: '/(app)/history/[id]'");
      expect(historyTabContent).toContain('id: record.session.eventId');
    });

    it('provides top shortcut navigation to /(app)/disputes', () => {
      expect(historyTabContent).toContain("router.push('/(app)/disputes')");
      expect(historyTabContent).toContain('ATTENDANCE DISPUTES');
    });

    it('preserves backend chronological order without artificial client-side sorting', () => {
      expect(historyTabContent).toMatch(/records\s*=\s*data\?\.pages\.flatMap\(\(page\)\s*=>\s*page\.data\)\s*\|\|\s*\[\]/);
      expect(historyTabContent).not.toContain('.sort(');
    });
  });

  describe('3. Attendance Detail Screen (history/[id].tsx)', () => {
    it('has title="SESSION DETAILS" and provides onBackPress fallback to /(app)/history', () => {
      expect(historyDetailContent).toContain('MobileShell title="SESSION DETAILS"');
      expect(historyDetailContent).toContain("router.replace('/(app)/history')");
    });

    it('handles event loading, not-found, and error states', () => {
      expect(historyDetailContent).toContain('FETCHING ATTENDANCE RECORD...');
      expect(historyDetailContent).toContain('<Display style={styles.errorTitle}>EVENT NOT FOUND</Display>');
      expect(historyDetailContent).toContain('RETURN TO ATTENDANCE HISTORY');
    });

    it('renders session breakdown with status checks and conditional dispute actions', () => {
      expect(historyDetailContent).toContain("record.status === 'PRESENT' || record.status === 'EXCUSED'");
      expect(historyDetailContent).toContain("pathname: '/(app)/disputes/[id]'");
      expect(historyDetailContent).toContain("pathname: '/(app)/disputes/new'");
      expect(historyDetailContent).toContain('[ FILE DISPUTE ]');
      expect(historyDetailContent).toContain('DISPUTE {dispute.status}');
    });

    it('displays empty sessions message if no sessions registered for the event', () => {
      expect(historyDetailContent).toContain('NO SESSIONS REGISTERED FOR THIS EVENT');
    });
  });

  describe('4. My Disputes Screen (disputes/index.tsx)', () => {
    it('sets title="MY DISPUTES" and provides onBackPress fallback to /(app)/history', () => {
      expect(disputesIndexContent).toContain('title="MY DISPUTES"');
      expect(disputesIndexContent).toContain("router.replace('/(app)/history')");
    });

    it('renders status summary bar with PENDING, APPROVED, and REJECTED counts', () => {
      expect(disputesIndexContent).toContain("d.status === 'PENDING'");
      expect(disputesIndexContent).toContain("d.status === 'APPROVED'");
      expect(disputesIndexContent).toContain("d.status === 'REJECTED'");
      expect(disputesIndexContent).toContain('SUBMITTED CLAIMS');
    });

    it('handles loading, error with retry, and empty state with navigation to history', () => {
      expect(disputesIndexContent).toContain('FETCHING DISPUTE CLAIMS...');
      expect(disputesIndexContent).toContain('FAILED TO LOAD DISPUTES');
      expect(disputesIndexContent).toContain('RETRY FETCH');
      expect(disputesIndexContent).toContain('NO DISPUTES RECORDED');
      expect(disputesIndexContent).toContain("router.navigate('/(app)/history')");
    });

    it('navigates to /(app)/disputes/[id] on dispute item press', () => {
      expect(disputesIndexContent).toContain("pathname: '/(app)/disputes/[id]'");
      expect(disputesIndexContent).toContain('id: item.id');
    });
  });

  describe('5. Dispute Form & Submission Mutation (disputes/new.tsx & use-disputes.ts)', () => {
    it('enforces backend validation rules (min 10, max 1000 characters)', () => {
      expect(disputesNewContent).toContain('reason.trim().length >= 10');
      expect(disputesNewContent).toContain('val.length <= 1000');
      expect(disputesNewContent).toContain('/1000 CHARACTERS');
      expect(disputesNewContent).toContain('Reason must be at least 10 characters long.');
    });

    it('provides onBackPress fallback to /(app)/history', () => {
      expect(disputesNewContent).toContain('title="SUBMIT DISPUTE"');
      expect(disputesNewContent).toContain("router.replace('/(app)/history')");
    });

    it('maps known backend dispute rejection codes to human-readable guidance', () => {
      expect(disputesNewContent).toContain('ATTENDANCE_ALREADY_RECORDED');
      expect(disputesNewContent).toContain('DISPUTE_WINDOW_EXPIRED');
      expect(disputesNewContent).toContain('SESSION_CLOSED');
      expect(disputesNewContent).toContain('NOT_REGISTERED');
    });

    it('submits mutation with exact POST /v1/attendance/disputes contract and payload', () => {
      expect(useDisputesContent).toContain("apiClient('/v1/attendance/disputes'");
      expect(useDisputesContent).toContain("method: 'POST'");
      expect(useDisputesContent).toContain('session_id: string');
      expect(useDisputesContent).toContain('reason: string');
    });

    it('invalidates [my-disputes] and [my-attendance] queries upon dispute submission', () => {
      expect(useDisputesContent).toContain("queryClient.invalidateQueries({ queryKey: ['my-disputes'] })");
      expect(useDisputesContent).toContain("queryClient.invalidateQueries({ queryKey: ['my-attendance'] })");
    });

    it('navigates to /(app)/disputes/submitted upon confirmed creation', () => {
      expect(disputesNewContent).toContain("pathname: '/(app)/disputes/submitted'");
      expect(disputesNewContent).toContain('disputeId: data.id');
    });
  });

  describe('6. Submitted Dispute Receipt (disputes/submitted.tsx)', () => {
    it('sets title="CLAIM SUBMITTED" and displays receipt details without fake DISP-0000 fallback', () => {
      expect(disputesSubmittedContent).toContain('title="CLAIM SUBMITTED"');
      expect(disputesSubmittedContent).not.toContain("'DISP-0000'");
      expect(disputesSubmittedContent).not.toContain("'CLASSROOM SESSION'");
      expect(disputesSubmittedContent).toContain('CLAIM QUEUED FOR REVIEW');
      expect(disputesSubmittedContent).toContain('REGISTRY ENTRY');
      expect(disputesSubmittedContent).toContain('PENDING REVIEW');
    });

    it('provides explicit CTAs for VIEW MY DISPUTES and RETURN TO HOME', () => {
      expect(disputesSubmittedContent).toContain("onPress={() => router.replace('/(app)/disputes')}");
      expect(disputesSubmittedContent).toContain("onPress={() => router.replace('/(app)')}");
      expect(disputesSubmittedContent).toContain('VIEW MY DISPUTES');
      expect(disputesSubmittedContent).toContain('RETURN TO HOME');
    });
  });

  describe('7. Dispute Detail Screen (disputes/[id].tsx)', () => {
    it('sets title="CLAIM DETAIL" and provides header back fallback to /(app)/disputes', () => {
      expect(disputesDetailContent).toContain('title="CLAIM DETAIL"');
      expect(disputesDetailContent).toContain("router.replace('/(app)/disputes')");
    });

    it('includes RETURN TO MY DISPUTES button routing to /(app)/disputes', () => {
      expect(disputesDetailContent).toContain('title="RETURN TO MY DISPUTES"');
      expect(disputesDetailContent).toContain("onPress={() => router.push('/(app)/disputes')}");
    });

    it('resolves authoritative dispute via useDisputeDetail(targetId)', () => {
      expect(disputesDetailContent).toContain('useDisputeDetail(targetId)');
      expect(useDisputesContent).toContain('export function useDisputeDetail(id: string)');
      expect(useDisputesContent).toContain('useMyDisputes()');
    });

    it('handles loading state with ActivityIndicator and label', () => {
      expect(disputesDetailContent).toContain('FETCHING CLAIM DETAILS...');
    });

    it('handles error state with retry fetch button', () => {
      expect(disputesDetailContent).toContain('FAILED TO LOAD CLAIM');
      expect(disputesDetailContent).toContain('RETRY FETCH');
    });

    it('handles not-found dispute state with RETURN TO MY DISPUTES button', () => {
      expect(disputesDetailContent).toContain('DISPUTE NOT FOUND');
      expect(disputesDetailContent).toContain('The requested dispute claim could not be found or you do not have permission to view it.');
      expect(disputesDetailContent).toContain('title="RETURN TO MY DISPUTES"');
    });

    it('eliminates fake fallbacks (DISP-0000, CLASSROOM SESSION, No reason provided)', () => {
      expect(disputesDetailContent).not.toContain("'DISP-0000'");
      expect(disputesDetailContent).not.toContain("'CLASSROOM SESSION'");
      expect(disputesDetailContent).not.toContain("'No reason provided'");
    });

    it('renders reviewer notes and status-specific resolution details when resolved', () => {
      expect(disputesDetailContent).toContain('INSTRUCTOR RESOLUTION');
      expect(disputesDetailContent).toContain('[REVIEW IN PROGRESS]');
      expect(disputesDetailContent).toContain('REVIEWER NOTES:');
      expect(disputesDetailContent).toContain('STATUS EXCUSED RECORDED IN OFFICIAL LOGS');
    });
  });

  describe('8. Attendance History Data Hook Contract (use-attendance-history.ts)', () => {
    it('supports event filtering via filter_event_id in useAttendanceHistory', () => {
      expect(useAttendanceHistoryContent).toContain('filter_event_id=${eventId}');
      expect(useAttendanceHistoryContent).toContain("queryKey: ['my-attendance', eventId]");
    });

    it('exposes full status types (PRESENT, ABSENT, EXCUSED) and methods (QR, MANUAL, SYSTEM)', () => {
      expect(useAttendanceHistoryContent).toContain("'PRESENT' | 'ABSENT' | 'EXCUSED'");
      expect(useAttendanceHistoryContent).toContain("'QR' | 'MANUAL' | 'SYSTEM'");
    });
  });
});
