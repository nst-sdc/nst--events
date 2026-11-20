import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { ActivityIndicator } from '../../../src/ui/core/ActivityIndicator';
import { useUserProfile } from '../../../src/hooks/use-user-profile';
import { useMyRegistrations, MyRegistrationItem } from '../../../src/hooks/use-registration';
import { useEvents } from '../../../src/hooks/use-events';
import { useAttendanceHistory, AttendanceRecordItem } from '../../../src/hooks/use-attendance-history';
import { useStudentAchievements } from '../../../src/hooks/use-event-results';
import { openProjectShowcase } from '../../../src/lib/project-showcase';
import { useNetworkStatus } from '../../../src/infrastructure/network';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { AttendanceHistoryRow } from '../../../src/ui/AttendanceHistoryRow';
import { MonoLabel } from '../../../src/ui/core/Typography';
import { StatusBadge } from '../../../src/ui/core/StatusBadge';
import { Button } from '../../../src/ui/Button';
import { haptics } from '../../../src/lib/haptics';

// Prism v3.6.0 Section 3.4: Exactly 2 Tickets segments
export type TicketsSection = 'UPCOMING' | 'PAST_HISTORY';

const resolveSection = (param?: string | string[]): TicketsSection => {
  if (!param) return 'UPCOMING';
  const raw = Array.isArray(param) ? param[0] : param;
  const upper = raw.toUpperCase();
  if (upper === 'ATTENDANCE' || upper === 'HISTORY' || upper === 'PAST_HISTORY') {
    return 'PAST_HISTORY';
  }
  return 'UPCOMING';
};

export default function ActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; section?: string }>();
  const theme = useAppTheme();
  const { isOnline } = useNetworkStatus();

  const [activeSection, setActiveSection] = useState<TicketsSection>(() =>
    resolveSection(params.tab || params.section)
  );
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.tab === 'disputes') {
      router.push('/(app)/disputes');
      return;
    }
    const matched = resolveSection(params.tab || params.section);
    setActiveSection(matched);
  }, [params.tab, params.section, router]);

  // Data Hooks per Phase 1 scope (team invitations 404 endpoint excluded)
  const { data: profile } = useUserProfile();
  const {
    data: registrations = [],
    isLoading: isRegsLoading,
    refetch: refetchRegs,
  } = useMyRegistrations();
  const {
    data: eventsData,
    isLoading: isEventsLoading,
    refetch: refetchEvents,
  } = useEvents();
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useAttendanceHistory();
  const isHonors = (params.tab || params.section)?.toLowerCase() === 'honors';
  const {
    data: achievementsData,
    isLoading: isAchievementsLoading,
    refetch: refetchAchievements,
  } = useStudentAchievements(profile?.id, !!profile?.id);
  const achievements = achievementsData?.achievements || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchRegs(),
      refetchEvents(),
      refetchHistory(),
      refetchAchievements(),
    ]);
    setRefreshing(false);
  };

  const allEvents = eventsData?.pages.flatMap((page) => page.data) || [];
  const attendanceRecords = historyData?.pages.flatMap((page) => page.data) || [];

  // Active / registered passes joined with event info
  const passesWithEvent = useMemo(() => {
    return registrations
      .filter((r) => r.registrationStatus === 'REGISTERED' || r.registrationStatus === 'WAITLISTED')
      .map((r) => {
        const ev = allEvents.find((e) => e.id === r.eventId);
        return {
          registration: r,
          event: ev,
        };
      });
  }, [registrations, allEvents]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        segmentedNavScroll: {
          marginBottom: theme.spacing.md,
        },
        segmentedNav: {
          flexDirection: 'row',
          backgroundColor: theme.colors.surfaceSubtle,
          borderRadius: theme.radii.full,
          padding: 4,
          minWidth: '100%',
        },
        segmentTab: {
          paddingVertical: 10,
          paddingHorizontal: 16,
          minWidth: 92,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.full,
          borderBottomWidth: 2,
          borderBottomColor: 'transparent',
          flex: 1,
        },
        segmentTabActive: {
          backgroundColor: theme.colors.surfaceElevated,
          borderBottomColor: theme.colors.brandPrimary,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        },
        segmentLabel: {
          fontFamily: theme.typography.interMedium,
          fontSize: 13,
          lineHeight: 18,
          color: theme.colors.textMuted,
        },
        segmentLabelActive: {
          fontFamily: theme.typography.interSemiBold,
          color: theme.colors.brandText,
        },
        sectionContainer: {
          gap: theme.spacing.md,
        },
        ticketCard: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.base,
          gap: theme.spacing.sm,
        },
        ticketHeaderRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
        },
        ticketTitle: {
          flex: 1,
          fontFamily: theme.typography.interSemiBold,
          fontSize: 16,
          lineHeight: 22,
          color: theme.colors.textPrimary,
        },
        ticketMetaText: {
          fontFamily: theme.typography.interRegular,
          fontSize: 13,
          lineHeight: 18,
          color: theme.colors.textSecondary,
        },
        doorQrRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.surfaceSubtle,
          borderRadius: theme.radii.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          marginTop: 4,
        },
        doorQrLabel: {
          fontFamily: theme.typography.interMedium,
          fontSize: 13,
          color: theme.colors.textSecondary,
        },
        doorQrSubtext: {
          fontFamily: theme.typography.interRegular,
          fontSize: 12,
          color: theme.colors.textMuted,
        },
        waitlistBanner: {
          backgroundColor: theme.colors.badgeTintAmber,
          borderRadius: theme.radii.md,
          padding: 10,
          marginTop: 4,
        },
        waitlistText: {
          fontFamily: theme.typography.interRegular,
          fontSize: 12,
          lineHeight: 16,
          color: theme.colors.badgeTextAmber,
        },
        ticketActionsRow: {
          flexDirection: 'row',
          gap: 8,
          marginTop: 6,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderSubtle,
        },
        passActionBtn: {
          flex: 1,
          paddingVertical: 8,
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.borderStrong,
          backgroundColor: theme.colors.surfaceSubtle,
        },
        passActionBtnPrimary: {
          backgroundColor: theme.colors.brandPrimary,
          borderColor: theme.colors.brandPrimary,
        },
        passActionText: {
          fontSize: 13,
          fontFamily: theme.typography.interMedium,
          color: theme.colors.textPrimary,
        },
        passActionTextPrimary: {
          color: '#FFFFFF',
          fontFamily: theme.typography.interSemiBold,
        },
        emptyBox: {
          backgroundColor: theme.colors.surfaceSubtle,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          padding: theme.spacing.xl,
          alignItems: 'center',
          gap: 8,
          marginTop: theme.spacing.md,
        },
        emptyTitle: {
          color: theme.colors.textPrimary,
          fontFamily: theme.typography.interSemiBold,
          fontSize: 16,
        },
        emptySub: {
          color: theme.colors.textMuted,
          fontSize: 13,
          textAlign: 'center',
          lineHeight: 18,
        },
        disputesShortcut: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 12,
          backgroundColor: theme.colors.surfaceSubtle,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          marginTop: 8,
        },
        disputesShortcutText: {
          fontFamily: theme.typography.interMedium,
          fontSize: 13,
          color: theme.colors.brandText,
        },
      }),
    [theme]
  );

  return (
    <MobileShell
      title="ACTIVITY"
      scrollable={true}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.brandPrimary}
          colors={[theme.colors.brandPrimary]}
          progressBackgroundColor={theme.colors.surface}
        />
      }
    >
      {/* Top 2-Option Segmented Switcher: Upcoming | Past history */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentedNav}
        style={styles.segmentedNavScroll}
        keyboardShouldPersistTaps="handled"
        accessibilityRole="tablist"
      >
        <TouchableOpacity
          style={[styles.segmentTab, activeSection === 'UPCOMING' && styles.segmentTabActive]}
          onPress={() => {
            void haptics.selection();
            setActiveSection('UPCOMING');
          }}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeSection === 'UPCOMING' }}
          accessibilityLabel="Upcoming tickets and passes"
        >
          <Text style={[styles.segmentLabel, activeSection === 'UPCOMING' && styles.segmentLabelActive]}>
            Upcoming {passesWithEvent.length > 0 ? `(${passesWithEvent.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentTab, activeSection === 'PAST_HISTORY' && styles.segmentTabActive]}
          onPress={() => {
            void haptics.selection();
            setActiveSection('PAST_HISTORY');
          }}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeSection === 'PAST_HISTORY' }}
          accessibilityLabel="Past history attendance records"
        >
          <Text style={[styles.segmentLabel, activeSection === 'PAST_HISTORY' && styles.segmentLabelActive]}>
            Past history
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Honors Deep Link View */}
      {isHonors && (
        <View style={styles.sectionContainer}>
          <View style={{ marginBottom: 12 }}>
            <MonoLabel style={{ fontSize: 13, color: theme.colors.textMuted }}>
              HONORS & AWARDS
            </MonoLabel>
          </View>
          {isAchievementsLoading ? (
            <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
          ) : achievements.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>NO HONORS YET</Text>
              <Text style={styles.emptySub}>
                Event results and achievements will be displayed here.
              </Text>
            </View>
          ) : (
            achievements.map((ach) => (
              <View key={ach.id} style={styles.ticketCard}>
                <View style={styles.ticketHeaderRow}>
                  <Text numberOfLines={2} style={styles.ticketTitle}>
                    {ach.award_title || 'Honor'}
                  </Text>
                  {ach.placement && (
                    <StatusBadge
                      status={`#${ach.placement}`}
                      type="warning"
                    />
                  )}
                </View>
                <Text style={styles.ticketMetaText}>
                  {ach.event?.title || 'Campus Event'}
                </Text>
                {ach.linked_project && (
                  <TouchableOpacity
                    onPress={() => openProjectShowcase(ach.linked_project?.slug)}
                    style={{ marginTop: 12, paddingVertical: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Showcase project"
                  >
                    <Text style={{ color: theme.colors.brandPrimary, fontFamily: theme.typography.monoMedium }}>
                      [ SHOWCASE PROJECT ↗ ]
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* Segment 1: UPCOMING (Digital Tickets) */}
      {!isHonors && activeSection === 'UPCOMING' && (
        <View style={styles.sectionContainer}>
          {isRegsLoading ? (
            <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
          ) : passesWithEvent.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No upcoming tickets</Text>
              <Text style={styles.emptySub}>
                You haven&apos;t registered for any upcoming events yet. Explore campus events to register.
              </Text>
              <Button
                title="Explore Events"
                onPress={() => router.push('/(app)/(tabs)/explore')}
                variant="primary"
                style={{ marginTop: 8 }}
              />
            </View>
          ) : (
            passesWithEvent.map(({ registration, event }) => {
              const isWaitlisted = registration.registrationStatus === 'WAITLISTED';
              const dateStr = event?.startTime
                ? new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Date TBA';
              const timeStr = event?.startTime
                ? new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <View key={registration.id} style={styles.ticketCard}>
                  <View style={styles.ticketHeaderRow}>
                    <Text numberOfLines={2} style={styles.ticketTitle}>
                      {event?.title || 'Campus Event'}
                    </Text>
                    <StatusBadge
                      status={isWaitlisted ? 'WAITLISTED' : 'CONFIRMED'}
                      type={isWaitlisted ? 'warning' : 'success'}
                    />
                  </View>

                  <Text style={styles.ticketMetaText}>
                    {event?.locationName || 'Campus Venue'} · {dateStr} {timeStr ? `at ${timeStr}` : ''}
                  </Text>

                  {/* Phase 1 Door QR Disabled Placeholder */}
                  {!isWaitlisted ? (
                    <View style={styles.doorQrRow}>
                      <Text style={styles.doorQrLabel}>Door QR Pass</Text>
                      <Text style={styles.doorQrSubtext}>Door QR coming soon</Text>
                    </View>
                  ) : (
                    <View style={styles.waitlistBanner}>
                      <Text style={styles.waitlistText}>
                        Waitlisted — We&apos;ll notify you if a confirmed spot opens up.
                      </Text>
                    </View>
                  )}

                  {/* Ticket Action Shortcuts */}
                  <View style={styles.ticketActionsRow}>
                    <TouchableOpacity
                      style={styles.passActionBtn}
                      onPress={() => router.push(`/(app)/events/${registration.eventId}`)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.passActionText}>View Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.passActionBtn}
                      onPress={() => router.push(`/(app)/events/${registration.eventId}/teams`)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.passActionText}>Squad Hub</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.passActionBtn, styles.passActionBtnPrimary]}
                      onPress={() => router.push(`/(app)/events/${registration.eventId}/scan`)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.passActionTextPrimary}>Scan</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Segment 2: PAST_HISTORY (Verified Attendance Ledger) */}
      {!isHonors && activeSection === 'PAST_HISTORY' && (
        <View style={styles.sectionContainer}>
          {/* Direct Link to Disputes Ledger */}
          <TouchableOpacity
            style={styles.disputesShortcut}
            onPress={() => router.push('/(app)/disputes')}
            activeOpacity={0.8}
          >
            <Text style={styles.disputesShortcutText}>Have attendance issues? File or view disputes →</Text>
          </TouchableOpacity>

          <View style={{ marginBottom: 12 }}>
            <MonoLabel style={{ fontSize: 13, color: theme.colors.textMuted }}>
              VERIFIED ATTENDANCE SESSIONS
            </MonoLabel>
          </View>

          {isHistoryLoading ? (
            <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
          ) : attendanceRecords.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>NO ATTENDANCE RECORDS</Text>
              <Text style={styles.emptySub}>
                Verified session check-ins will be logged here chronologically.
              </Text>
            </View>
          ) : (
            attendanceRecords.map((record) => (
              <AttendanceHistoryRow
                key={record.id}
                item={record}
                onPress={() => {
                  router.push({
                    pathname: '/(app)/history/[id]',
                    params: { id: record.id },
                  });
                }}
              />
            ))
          )}
        </View>
      )}
    </MobileShell>
  );
}
