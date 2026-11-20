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
import { MaterialIcons } from '@expo/vector-icons';
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
          marginBottom: theme.spacing.base,
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
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.brandPrimary,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.08,
          shadowRadius: 4,
          elevation: 2,
        },
        segmentLabel: {
          fontFamily: theme.typography.interMedium,
          fontSize: 13,
          lineHeight: 18,
          color: theme.colors.textMuted,
        },
        segmentLabelActive: {
          fontFamily: theme.typography.interBold,
          color: theme.colors.textPrimary,
        },
        sectionContainer: {
          gap: theme.spacing.base,
        },

        // Apple Wallet Style Pass
        ticketCard: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          borderTopColor: theme.mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.12)',
          borderRadius: theme.radii.xl,
          overflow: 'hidden',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.08,
          shadowRadius: 14,
          elevation: 3,
        },
        ticketTopSection: {
          padding: theme.spacing.base,
          gap: 10,
        },
        ticketHeaderRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
        },
        ticketTitleContainer: {
          flex: 1,
          gap: 4,
        },
        ticketPassEyebrow: {
          fontSize: 12,
          fontFamily: theme.typography.monoMedium,
          color: theme.colors.brandText,
          letterSpacing: 0.8,
        },
        ticketTitle: {
          fontFamily: theme.typography.interBold,
          fontSize: 17,
          lineHeight: 23,
          letterSpacing: -0.2,
          color: theme.colors.textPrimary,
        },
        ticketMetaGrid: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 4,
        },
        ticketMetaCol: {
          flex: 1,
          gap: 2,
        },
        ticketMetaLabel: {
          fontSize: 12,
          fontFamily: theme.typography.monoMedium,
          color: theme.colors.textMuted,
          letterSpacing: 0.5,
        },
        ticketMetaValue: {
          fontSize: 13,
          fontFamily: theme.typography.interSemiBold,
          color: theme.colors.textSecondary,
        },

        // Perforated Tear-Line with Edge Cutout Notches
        perforationRow: {
          position: 'relative',
          height: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: -1,
        },
        notchLeft: {
          position: 'absolute',
          left: -10,
          width: 20,
          height: 20,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.canvas,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
        },
        notchRight: {
          position: 'absolute',
          right: -10,
          width: 20,
          height: 20,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.canvas,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
        },
        dashedTearLine: {
          flex: 1,
          height: 1,
          borderStyle: 'dashed',
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          marginHorizontal: 16,
        },

        // Ticket Bottom Section / Door Stub
        ticketBottomSection: {
          padding: theme.spacing.base,
          paddingTop: 8,
          gap: 12,
          backgroundColor: theme.colors.surfaceSubtle,
        },
        doorQrRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
        },
        doorQrLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        doorQrIconWell: {
          width: 36,
          height: 36,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.surfaceSubtle,
          justifyContent: 'center',
          alignItems: 'center',
        },
        doorQrLabel: {
          fontFamily: theme.typography.interBold,
          fontSize: 14,
          color: theme.colors.textPrimary,
        },
        doorQrSubtext: {
          fontFamily: theme.typography.interRegular,
          fontSize: 12,
          color: theme.colors.textMuted,
        },
        waitlistBanner: {
          backgroundColor: theme.colors.badgeTintAmber,
          borderRadius: theme.radii.md,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.colors.badgeTextAmber,
        },
        waitlistText: {
          fontFamily: theme.typography.interRegular,
          fontSize: 12,
          lineHeight: 18,
          color: theme.colors.badgeTextAmber,
        },

        // Pass Action Buttons Row
        ticketActionsRow: {
          flexDirection: 'row',
          gap: 8,
          marginTop: 2,
        },
        passActionBtn: {
          flex: 1,
          paddingVertical: 10,
          minHeight: 46,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          backgroundColor: theme.colors.surface,
        },
        passActionBtnPrimary: {
          backgroundColor: theme.colors.brandPrimary,
          borderColor: theme.colors.brandPrimary,
        },
        passActionText: {
          fontSize: 13,
          fontFamily: theme.typography.interSemiBold,
          color: theme.colors.textPrimary,
        },
        passActionTextPrimary: {
          color: '#FFFFFF',
          fontFamily: theme.typography.interBold,
        },

        // Empty Box
        emptyBox: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.xl,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          padding: theme.spacing.xl,
          alignItems: 'center',
          gap: 10,
          marginTop: theme.spacing.md,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 1,
        },
        emptyIconWell: {
          width: 56,
          height: 56,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.surfaceSubtle,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 4,
        },
        emptyTitle: {
          color: theme.colors.textPrimary,
          fontFamily: theme.typography.interBold,
          fontSize: 17,
        },
        emptySub: {
          color: theme.colors.textMuted,
          fontSize: 13,
          textAlign: 'center',
          lineHeight: 18,
        },

        // Disputes Shortcut
        disputesShortcut: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 14,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          borderTopColor: theme.mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.12)',
          marginBottom: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 1,
        },
        disputesShortcutLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          flex: 1,
        },
        disputesIconWell: {
          width: 32,
          height: 32,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.badgeTintAmber,
          justifyContent: 'center',
          alignItems: 'center',
        },
        disputesShortcutText: {
          fontFamily: theme.typography.interMedium,
          fontSize: 13,
          color: theme.colors.textPrimary,
          flex: 1,
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
              <View style={styles.emptyIconWell}>
                <MaterialIcons name="emoji-events" size={28} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>NO HONORS YET</Text>
              <Text style={styles.emptySub}>
                Event results and achievements will be displayed here.
              </Text>
            </View>
          ) : (
            achievements.map((ach) => (
              <View key={ach.id} style={styles.ticketCard}>
                <View style={styles.ticketTopSection}>
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
                  <Text style={styles.ticketMetaValue}>
                    {ach.event?.title || 'Campus Event'}
                  </Text>
                  {ach.linked_project && (
                    <TouchableOpacity
                      onPress={() => openProjectShowcase(ach.linked_project?.slug)}
                      style={{ marginTop: 12, paddingVertical: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Showcase project"
                    >
                      <Text style={{ color: theme.colors.brandPrimary, fontFamily: theme.typography.monoMedium, fontSize: 13 }}>
                        [ SHOWCASE PROJECT ↗ ]
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Segment 1: UPCOMING (Apple Wallet Style Digital Passes) */}
      {!isHonors && activeSection === 'UPCOMING' && (
        <View style={styles.sectionContainer}>
          {isRegsLoading ? (
            <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
          ) : passesWithEvent.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWell}>
                <MaterialIcons name="confirmation-number" size={28} color={theme.colors.brandText} />
              </View>
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
                  {/* Top Credentials Section */}
                  <View style={styles.ticketTopSection}>
                    <View style={styles.ticketHeaderRow}>
                      <View style={styles.ticketTitleContainer}>
                        <MonoLabel style={styles.ticketPassEyebrow}>CAMPUS PASS</MonoLabel>
                        <Text numberOfLines={2} style={styles.ticketTitle}>
                          {event?.title || 'Campus Event'}
                        </Text>
                      </View>
                      <StatusBadge
                        status={isWaitlisted ? 'WAITLISTED' : 'CONFIRMED'}
                        type={isWaitlisted ? 'warning' : 'success'}
                      />
                    </View>

                    {/* Metadata Grid */}
                    <View style={styles.ticketMetaGrid}>
                      <View style={styles.ticketMetaCol}>
                        <Text style={styles.ticketMetaLabel}>DATE</Text>
                        <Text style={styles.ticketMetaValue}>{dateStr}</Text>
                      </View>
                      <View style={styles.ticketMetaCol}>
                        <Text style={styles.ticketMetaLabel}>TIME</Text>
                        <Text style={styles.ticketMetaValue}>{timeStr || 'TBA'}</Text>
                      </View>
                      <View style={styles.ticketMetaCol}>
                        <Text style={styles.ticketMetaLabel}>VENUE</Text>
                        <Text numberOfLines={1} style={styles.ticketMetaValue}>
                          {event?.locationName || 'Campus Venue'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Perforation Tear-Line Divider */}
                  <View style={styles.perforationRow}>
                    <View style={styles.notchLeft} />
                    <View style={styles.dashedTearLine} />
                    <View style={styles.notchRight} />
                  </View>

                  {/* Bottom Door Pass Stub */}
                  <View style={styles.ticketBottomSection}>
                    {/* Phase 1 Door QR Disabled Placeholder */}
                    {!isWaitlisted ? (
                      <View style={styles.doorQrRow}>
                        <View style={styles.doorQrLeft}>
                          <View style={styles.doorQrIconWell}>
                            <MaterialIcons name="qr-code-2" size={20} color={theme.colors.brandText} />
                          </View>
                          <View>
                            <Text style={styles.doorQrLabel}>Door QR Pass</Text>
                            <Text style={styles.doorQrSubtext}>Door QR coming soon</Text>
                          </View>
                        </View>
                        <MaterialIcons name="lock-outline" size={18} color={theme.colors.textMuted} />
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
            <View style={styles.disputesShortcutLeft}>
              <View style={styles.disputesIconWell}>
                <MaterialIcons name="report-problem" size={18} color={theme.colors.badgeTextAmber} />
              </View>
              <Text style={styles.disputesShortcutText}>Have attendance issues? File or view disputes →</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
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
              <View style={styles.emptyIconWell}>
                <MaterialIcons name="verified-user" size={28} color={theme.colors.textMuted} />
              </View>
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
