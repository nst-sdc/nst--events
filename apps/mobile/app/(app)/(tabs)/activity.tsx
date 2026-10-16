import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Linking,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { ActivityIndicator } from '../../../src/ui/core/ActivityIndicator';
import { useUserProfile } from '../../../src/hooks/use-user-profile';
import { useMyRegistrations, MyRegistrationItem } from '../../../src/hooks/use-registration';
import { useEvents } from '../../../src/hooks/use-events';
import { useAttendanceHistory, AttendanceRecordItem } from '../../../src/hooks/use-attendance-history';
import { usePendingInvitations, PendingInvitation } from '../../../src/hooks/use-invitations';
import { useMyDisputes, AttendanceDisputeItem } from '../../../src/hooks/use-disputes';
import { useStudentAchievements, StudentAchievementItem } from '../../../src/hooks/use-event-results';
import { useTeams } from '../../../src/hooks/use-teams';
import { useNetworkStatus } from '../../../src/infrastructure/network';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { AttendanceHistoryRow } from '../../../src/ui/AttendanceHistoryRow';
import { DisputeRow } from '../../../src/ui/DisputeRow';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';
import { StatusBadge } from '../../../src/ui/core/StatusBadge';
import { Button } from '../../../src/ui/Button';

type ActivitySection = 'PASSES' | 'INVITES' | 'ATTENDANCE' | 'DISPUTES' | 'HONORS';

export default function ActivityScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { isOnline } = useNetworkStatus();
  const [activeSection, setActiveSection] = useState<ActivitySection>('PASSES');
  const [refreshing, setRefreshing] = useState(false);

  // Data Hooks
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
  const {
    data: invitations = [],
    isLoading: isInvitesLoading,
    refetch: refetchInvites,
  } = usePendingInvitations();
  const {
    data: disputesData,
    isLoading: isDisputesLoading,
    refetch: refetchDisputes,
  } = useMyDisputes();
  const {
    data: achievementsData,
    isLoading: isAchievementsLoading,
    refetch: refetchAchievements,
  } = useStudentAchievements(profile?.id, !!profile?.id);

  // Team actions for invitations
  const { acceptInvitation, isAccepting, declineInvitation, isDeclining } = useTeams('');

  // Selected invitation for modal confirmation
  const [selectedInvite, setSelectedInvite] = useState<{ invite: PendingInvitation; action: 'ACCEPT' | 'DECLINE' } | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchRegs(),
      refetchEvents(),
      refetchHistory(),
      refetchInvites(),
      refetchDisputes(),
      refetchAchievements(),
    ]);
    setRefreshing(false);
  };

  const allEvents = eventsData?.pages.flatMap((page) => page.data) || [];
  const attendanceRecords = historyData?.pages.flatMap((page) => page.data) || [];
  const disputes = disputesData?.pages.flatMap((page) => page.data) || [];
  const achievements = achievementsData?.achievements || [];

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

  const handleConfirmInviteAction = async () => {
    if (!selectedInvite) return;
    try {
      if (selectedInvite.action === 'ACCEPT') {
        await acceptInvitation({
          teamId: selectedInvite.invite.team.team_id,
          invitationId: selectedInvite.invite.invitation_id,
        });
      } else {
        await declineInvitation({
          teamId: selectedInvite.invite.team.team_id,
          invitationId: selectedInvite.invite.invitation_id,
        });
      }
      setSelectedInvite(null);
      refetchInvites();
    } catch {
      setSelectedInvite(null);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        segmentedNav: {
          flexDirection: 'row',
          backgroundColor: theme.colors.surfaceContainerLowest,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          marginBottom: theme.spacing.md,
        },
        segmentTab: {
          flex: 1,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          borderRightWidth: 1,
          borderRightColor: theme.colors.borderHairline,
        },
        segmentTabLast: {
          borderRightWidth: 0,
        },
        segmentTabActive: {
          backgroundColor: theme.colors.surfaceContainerHigh,
        },
        segmentLabel: {
          fontFamily: theme.typography.monoBold,
          fontSize: 9,
          letterSpacing: 0.5,
          color: theme.colors.onSurfaceVariant,
        },
        segmentLabelActive: {
          color: theme.colors.primary,
        },
        badgeBubble: {
          backgroundColor: theme.colors.primary,
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderRadius: 2,
          marginLeft: 4,
        },
        badgeText: {
          color: theme.colors.onPrimary,
          fontSize: 8,
          fontFamily: theme.typography.monoBold,
        },
        sectionContainer: {
          gap: theme.spacing.md,
        },
        passCard: {
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          padding: theme.spacing.base,
          gap: theme.spacing.sm,
        },
        passHeaderRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
        },
        passTitle: {
          flex: 1,
          fontSize: 16,
          color: theme.colors.onSurface,
        },
        passDetailsRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginTop: 2,
        },
        passActionsRow: {
          flexDirection: 'row',
          gap: 8,
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderHairline,
        },
        passActionBtn: {
          flex: 1,
          paddingVertical: 8,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surface,
        },
        passActionText: {
          fontSize: 10,
          fontFamily: theme.typography.monoBold,
          color: theme.colors.primary,
        },
        inviteCard: {
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          padding: theme.spacing.base,
          gap: theme.spacing.sm,
        },
        inviteHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        },
        inviteActions: {
          flexDirection: 'row',
          gap: 8,
          marginTop: 8,
        },
        inviteBtnAccept: {
          flex: 1,
          backgroundColor: theme.colors.primary,
          paddingVertical: 8,
          alignItems: 'center',
        },
        inviteBtnDecline: {
          flex: 1,
          backgroundColor: theme.colors.surfaceContainerLowest,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          paddingVertical: 8,
          alignItems: 'center',
        },
        summaryBar: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderHairline,
          marginBottom: theme.spacing.sm,
        },
        emptyBox: {
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          padding: theme.spacing.xl,
          alignItems: 'center',
          gap: 8,
          marginTop: theme.spacing.md,
        },
        emptyTitle: {
          color: theme.colors.primary,
          fontSize: 16,
        },
        emptySub: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 12,
          textAlign: 'center',
        },
        loadingBox: {
          padding: theme.spacing.xl,
          alignItems: 'center',
          gap: 8,
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(9, 9, 11, 0.7)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        },
        modalCard: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          padding: 20,
          width: '100%',
          gap: 12,
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
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          progressBackgroundColor={theme.colors.surface}
        />
      }
    >
      {/* Top Segmented Navigation */}
      <View style={styles.segmentedNav}>
        <TouchableOpacity
          style={[styles.segmentTab, activeSection === 'PASSES' && styles.segmentTabActive]}
          onPress={() => setActiveSection('PASSES')}
          activeOpacity={0.8}
        >
          <Mono style={[styles.segmentLabel, activeSection === 'PASSES' && styles.segmentLabelActive]}>
            PASSES
          </Mono>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentTab, activeSection === 'INVITES' && styles.segmentTabActive]}
          onPress={() => setActiveSection('INVITES')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Mono style={[styles.segmentLabel, activeSection === 'INVITES' && styles.segmentLabelActive]}>
              INVITES
            </Mono>
            {invitations.length > 0 && (
              <View style={styles.badgeBubble}>
                <Mono style={styles.badgeText}>{invitations.length}</Mono>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentTab, activeSection === 'ATTENDANCE' && styles.segmentTabActive]}
          onPress={() => setActiveSection('ATTENDANCE')}
          activeOpacity={0.8}
        >
          <Mono style={[styles.segmentLabel, activeSection === 'ATTENDANCE' && styles.segmentLabelActive]}>
            ATTENDANCE
          </Mono>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentTab, activeSection === 'DISPUTES' && styles.segmentTabActive]}
          onPress={() => setActiveSection('DISPUTES')}
          activeOpacity={0.8}
        >
          <Mono style={[styles.segmentLabel, activeSection === 'DISPUTES' && styles.segmentLabelActive]}>
            DISPUTES
          </Mono>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentTab, styles.segmentTabLast, activeSection === 'HONORS' && styles.segmentTabActive]}
          onPress={() => setActiveSection('HONORS')}
          activeOpacity={0.8}
        >
          <Mono style={[styles.segmentLabel, activeSection === 'HONORS' && styles.segmentLabelActive]}>
            HONORS
          </Mono>
        </TouchableOpacity>
      </View>

      {/* SECTION 1: PASSES & REGISTRATIONS */}
      {activeSection === 'PASSES' && (
        <View style={styles.sectionContainer}>
          <View style={styles.summaryBar}>
            <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>ACTIVE PASSES & TICKETS</MonoLabel>
            <MonoLabel style={{ color: theme.colors.primary }}>
              {passesWithEvent.length} {passesWithEvent.length === 1 ? 'PASS' : 'PASSES'}
            </MonoLabel>
          </View>

          {isRegsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <MonoLabel>LOADING REGISTERED PASSES...</MonoLabel>
            </View>
          ) : passesWithEvent.length === 0 ? (
            <View style={styles.emptyBox}>
              <Display style={styles.emptyTitle}>NO ACTIVE PASSES</Display>
              <Body style={styles.emptySub}>
                You have not registered for any events yet. Explore published events to claim your pass!
              </Body>
              <Button
                title="[ EXPLORE EVENTS ]"
                variant="primary"
                onPress={() => router.push('/(app)/(tabs)/explore')}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : (
            passesWithEvent.map(({ registration, event }) => {
              const isWaitlisted = registration.registrationStatus === 'WAITLISTED';
              const dateStr = event ? new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'CAMPUS';
              const timeStr = event ? new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const title = event?.title || 'CAMPUS EVENT';
              const location = event?.locationName || 'CAMPUS VENUE';
              const isTeam = !!registration.teamId || event?.registrationType === 'TEAM';

              return (
                <View key={registration.id} style={styles.passCard}>
                  <View style={styles.passHeaderRow}>
                    <Title style={styles.passTitle} numberOfLines={1}>{title}</Title>
                    <StatusBadge
                      status={isWaitlisted ? '[WAITLISTED]' : '[REGISTERED]'}
                      type={isWaitlisted ? 'warning' : 'success'}
                    />
                  </View>

                  <View style={styles.passDetailsRow}>
                    <Body style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, flex: 1 }} numberOfLines={1}>
                      {location}
                    </Body>
                    <Mono style={{ fontSize: 11, color: theme.colors.onSurface }}>
                      {dateStr} · {timeStr}
                    </Mono>
                  </View>

                  <View style={styles.passActionsRow}>
                    <TouchableOpacity
                      style={styles.passActionBtn}
                      onPress={() => router.push(`/(app)/events/${registration.eventId}`)}
                      activeOpacity={0.8}
                    >
                      <Mono style={styles.passActionText}>[ EVENT DETAILS ]</Mono>
                    </TouchableOpacity>

                    {isTeam && (
                      <TouchableOpacity
                        style={styles.passActionBtn}
                        onPress={() => router.push(`/(app)/events/${registration.eventId}/teams`)}
                        activeOpacity={0.8}
                      >
                        <Mono style={styles.passActionText}>[ SQUAD HUB ]</Mono>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.passActionBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() => router.push(`/(app)/events/${registration.eventId}/scan`)}
                      activeOpacity={0.8}
                    >
                      <Mono style={[styles.passActionText, { color: theme.colors.onPrimary }]}>
                        [ SCAN QR ]
                      </Mono>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* SECTION 2: TEAM INVITATIONS */}
      {activeSection === 'INVITES' && (
        <View style={styles.sectionContainer}>
          <View style={styles.summaryBar}>
            <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>PENDING SQUAD INVITATIONS</MonoLabel>
            <MonoLabel style={{ color: theme.colors.primary }}>
              {invitations.length} {invitations.length === 1 ? 'INVITE' : 'INVITES'}
            </MonoLabel>
          </View>

          {isInvitesLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <MonoLabel>LOADING PENDING INVITATIONS...</MonoLabel>
            </View>
          ) : invitations.length === 0 ? (
            <View style={styles.emptyBox}>
              <Display style={styles.emptyTitle}>NO PENDING INVITATIONS</Display>
              <Body style={styles.emptySub}>
                When a teammate invites you to their squad, the invite will appear here for you to accept.
              </Body>
            </View>
          ) : (
            invitations.map((inv) => (
              <View key={inv.invitation_id} style={styles.inviteCard}>
                <View style={styles.inviteHeader}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Title style={{ fontSize: 16 }}>{inv.team.team_name}</Title>
                    <Mono style={{ fontSize: 11, color: theme.colors.primary }}>
                      EVENT: {inv.event.event_title}
                    </Mono>
                    <Body style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                      Invited by: {inv.inviter.full_name}
                    </Body>
                  </View>
                  <StatusBadge status="[PENDING]" type="warning" />
                </View>

                <View style={styles.inviteActions}>
                  <TouchableOpacity
                    style={styles.inviteBtnAccept}
                    onPress={() => setSelectedInvite({ invite: inv, action: 'ACCEPT' })}
                    activeOpacity={0.8}
                  >
                    <Mono style={{ color: theme.colors.onPrimary, fontFamily: theme.typography.monoBold, fontSize: 11 }}>
                      [ ACCEPT SQUAD ]
                    </Mono>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.inviteBtnDecline}
                    onPress={() => setSelectedInvite({ invite: inv, action: 'DECLINE' })}
                    activeOpacity={0.8}
                  >
                    <Mono style={{ color: theme.colors.onSurface, fontFamily: theme.typography.monoBold, fontSize: 11 }}>
                      [ DECLINE ]
                    </Mono>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* SECTION 3: ATTENDANCE HISTORY */}
      {activeSection === 'ATTENDANCE' && (
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: theme.colors.surfaceContainerLow,
              borderWidth: 1,
              borderColor: theme.colors.borderHairline,
              padding: 12,
              marginBottom: 4,
            }}
            onPress={() => router.push('/(app)/disputes')}
            activeOpacity={0.8}
          >
            <MonoLabel style={{ color: theme.colors.primary }}>ATTENDANCE DISPUTES & CLAIMS</MonoLabel>
            <MonoLabel style={{ color: theme.colors.primary }}>→</MonoLabel>
          </TouchableOpacity>

          <View style={styles.summaryBar}>
            <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>VERIFIED ATTENDANCE SESSIONS</MonoLabel>
            <MonoLabel style={{ color: theme.colors.primary }}>
              {attendanceRecords.length < 10 ? `0${attendanceRecords.length}` : attendanceRecords.length} RECORDS
            </MonoLabel>
          </View>

          {isHistoryLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <MonoLabel>FETCHING ATTENDANCE LOGS...</MonoLabel>
            </View>
          ) : attendanceRecords.length === 0 ? (
            <View style={styles.emptyBox}>
              <Display style={styles.emptyTitle}>NO ATTENDANCE RECORDS</Display>
              <Body style={styles.emptySub}>
                Scan a QR code at an active event to record verified attendance.
              </Body>
            </View>
          ) : (
            attendanceRecords.map((record: AttendanceRecordItem) => (
              <AttendanceHistoryRow
                key={record.id}
                item={record}
                onPress={() => {
                  if (record.session?.eventId) {
                    router.push({
                      pathname: '/(app)/history/[id]',
                      params: { id: record.session.eventId },
                    });
                  }
                }}
              />
            ))
          )}
        </View>
      )}

      {/* SECTION 4: DISPUTES & CLAIMS */}
      {activeSection === 'DISPUTES' && (
        <View style={styles.sectionContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>ATTENDANCE CLAIMS</MonoLabel>
            <TouchableOpacity
              onPress={() => router.push('/(app)/disputes/new')}
              style={{
                backgroundColor: theme.colors.primary,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
              activeOpacity={0.8}
            >
              <Mono style={{ fontSize: 10, fontFamily: theme.typography.monoBold, color: theme.colors.onPrimary }}>
                + FILE CLAIM
              </Mono>
            </TouchableOpacity>
          </View>

          {isDisputesLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <MonoLabel>LOADING DISPUTES...</MonoLabel>
            </View>
          ) : disputes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Display style={styles.emptyTitle}>NO ACTIVE CLAIMS</Display>
              <Body style={styles.emptySub}>
                If you were present at an event but missed check-in due to technical reasons, file a claim within the dispute window.
              </Body>
              <Button
                title="[ FILE DISPUTE CLAIM ]"
                variant="secondary"
                onPress={() => router.push('/(app)/disputes/new')}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : (
            disputes.map((item: AttendanceDisputeItem) => (
              <DisputeRow
                key={item.id}
                item={item}
                onPress={() => router.push(`/(app)/disputes/${item.id}`)}
              />
            ))
          )}
        </View>
      )}

      {/* SECTION 5: HONORS & RESULTS */}
      {activeSection === 'HONORS' && (
        <View style={styles.sectionContainer}>
          <View style={styles.summaryBar}>
            <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>OFFICIAL HONORS & PODIUM FINISHES</MonoLabel>
            <MonoLabel style={{ color: theme.colors.success, fontSize: 9 }}>[VERIFIED RECORD]</MonoLabel>
          </View>

          {isAchievementsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <MonoLabel>LOADING OFFICIAL HONORS...</MonoLabel>
            </View>
          ) : achievements.length === 0 ? (
            <View style={styles.emptyBox}>
              <Display style={styles.emptyTitle}>NO OFFICIAL HONORS</Display>
              <Body style={styles.emptySub}>
                Participate in campus hackathons, competitions, and seminars to earn verified honors and credentials.
              </Body>
              <Button
                title="[ EXPLORE COMPETITIONS ]"
                variant="primary"
                onPress={() => router.push('/(app)/(tabs)/explore')}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : (
            achievements.map((ach: StudentAchievementItem) => {
              const isPodium = ach.placement && ach.placement <= 3;
              const rankText = ach.placement
                ? ach.placement === 1
                  ? '🥇 1ST PLACE'
                  : ach.placement === 2
                  ? '🥈 2ND PLACE'
                  : ach.placement === 3
                  ? '🥉 3RD PLACE'
                  : `RANK #${ach.placement}`
                : 'AWARD';

              return (
                <View
                  key={ach.id}
                  style={{
                    backgroundColor: theme.colors.surfaceContainerLow,
                    borderWidth: 1,
                    borderColor: isPodium ? theme.colors.podiumGold : theme.colors.outlineVariant,
                    padding: 14,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <MonoLabel style={{ color: theme.colors.primary, fontSize: 10 }}>{rankText}</MonoLabel>
                    <Mono style={{ fontSize: 9, color: theme.colors.outline }}>
                      {new Date(ach.published_at).getFullYear()}
                    </Mono>
                  </View>

                  <Title style={{ fontSize: 14, textTransform: 'uppercase' }}>{ach.award_title}</Title>
                  <Body style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>
                    {ach.event.title}
                    {ach.is_team_award && ach.team_name ? ` • Team: ${ach.team_name}` : ''}
                  </Body>

                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 6,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: theme.colors.borderHairline,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/(app)/events/${ach.event.id}/results`)}
                    >
                      <Mono style={{ fontSize: 10, color: theme.colors.primary, fontFamily: theme.typography.monoBold }}>
                        [ VIEW RESULTS ]
                      </Mono>
                    </TouchableOpacity>

                    {ach.linked_project && (
                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(`https://events.nstsdc.org/projects/${ach.linked_project?.slug}`).catch(() => {})
                        }
                      >
                        <Mono style={{ fontSize: 10, color: theme.colors.secondary, fontFamily: theme.typography.monoBold }}>
                          [ SHOWCASE PROJECT ↗ ]
                        </Mono>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Confirmation Modal for Accepting / Declining Team Invites */}
      <Modal
        visible={!!selectedInvite}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedInvite(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <StatusBadge
              status={selectedInvite?.action === 'ACCEPT' ? '[JOIN SQUAD]' : '[DECLINE SQUAD]'}
              type={selectedInvite?.action === 'ACCEPT' ? 'success' : 'error'}
            />
            <Title style={{ fontSize: 18 }}>
              {selectedInvite?.action === 'ACCEPT' ? 'CONFIRM SQUAD MEMBERSHIP' : 'DECLINE INVITATION'}
            </Title>
            <Body style={{ fontSize: 13, color: theme.colors.onSurfaceVariant }}>
              {selectedInvite?.action === 'ACCEPT'
                ? `Join "${selectedInvite.invite.team.team_name}" for ${selectedInvite.invite.event.event_title}? You will register under this squad.`
                : `Are you sure you want to decline the invitation to join "${selectedInvite?.invite.team.team_name}"?`}
            </Body>

            <View style={{ gap: 8, marginTop: 8 }}>
              <Button
                title={
                  isAccepting || isDeclining
                    ? 'PROCESSING...'
                    : selectedInvite?.action === 'ACCEPT'
                    ? 'CONFIRM JOIN'
                    : 'CONFIRM DECLINE'
                }
                variant={selectedInvite?.action === 'ACCEPT' ? 'primary' : 'danger'}
                onPress={handleConfirmInviteAction}
                disabled={isAccepting || isDeclining}
              />
              <Button
                title="CANCEL"
                variant="secondary"
                onPress={() => setSelectedInvite(null)}
                disabled={isAccepting || isDeclining}
              />
            </View>
          </View>
        </View>
      </Modal>
    </MobileShell>
  );
}
