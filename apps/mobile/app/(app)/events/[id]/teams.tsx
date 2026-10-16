import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../../src/infrastructure/api';
import { useAppTheme } from '../../../../src/store/theme-store';
import { useAuthStore } from '../../../../src/store/auth';
import { useUserProfile } from '../../../../src/hooks/use-user-profile';
import { useToast } from '../../../../src/hooks/use-toast';
import { useTeams, useTeamLookup, TeamMember } from '../../../../src/hooks/use-teams';
import { MobileShell } from '../../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono } from '../../../../src/ui/core/Typography';
import { StatusBadge } from '../../../../src/ui/core/StatusBadge';
import { Button } from '../../../../src/ui/Button';
import { TextField } from '../../../../src/ui/core/TextField';
import { ActivityIndicator } from '../../../../src/ui/core/ActivityIndicator';
import { TransferLeadershipModal } from '../../../../src/ui/TransferLeadershipModal';

export default function TeamsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const toast = useToast();
  const currentUserId = useAuthStore((s) => s.userId);
  const { data: profile } = useUserProfile();

  const effectiveUserId = currentUserId || profile?.id || (profile as any)?.user_id;

  // Query event details
  const {
    data: event,
    isLoading: isEventLoading,
    refetch: refetchEvent,
  } = useQuery({
    queryKey: ['events', id],
    queryFn: () => apiClient(`/v1/events/${id}`),
    enabled: !!id,
  });

  // Query my registration
  const {
    data: registration,
    isLoading: isRegLoading,
    refetch: refetchReg,
  } = useQuery({
    queryKey: ['events', id, 'registration'],
    queryFn: () => apiClient(`/v1/events/${id}/my-registration`),
    enabled: !!id,
  });

  const teamId = registration?.team_id || (registration as any)?.teamId;

  // Query team details
  const {
    data: team,
    isLoading: isTeamLoading,
    isError: isTeamError,
    refetch: refetchTeam,
  } = useTeamLookup(teamId);

  // Team mutations
  const {
    leaveTeamAsync,
    isLeaving,
    removeMemberAsync,
    isRemoving,
    inviteMemberAsync,
    isInviting,
  } = useTeams(id as string);

  // Modal states
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteeId, setInviteeId] = useState('');
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  const isLoading = isEventLoading || isRegLoading || (!!teamId && isTeamLoading);

  // Locks and Status
  const dbNow = new Date();
  const lockDeadline = (event as any)?.lock_deadline
    ? new Date((event as any).lock_deadline)
    : event?.endTime
    ? new Date(new Date(event.endTime).getTime() + 24 * 60 * 60 * 1000)
    : null;
  const isPermanentLock = lockDeadline ? dbNow > lockDeadline : false;
  const isLocked =
    !!event?.isLocked ||
    !!(event as any)?.is_locked ||
    isPermanentLock ||
    (event?.endTime ? new Date(event.endTime) <= dbNow : false);

  const isLeader = team ? team.leader_id === effectiveUserId : false;
  const minTeamSize =
    typeof event?.metadata?.minimum_team_size === 'number'
      ? event.metadata.minimum_team_size
      : typeof (event?.metadata as any)?.minimumTeamSize === 'number'
      ? (event?.metadata as any).minimumTeamSize
      : 1;
  const maxTeamSize =
    typeof event?.metadata?.maximum_team_size === 'number'
      ? event.metadata.maximum_team_size
      : typeof (event?.metadata as any)?.maximumTeamSize === 'number'
      ? (event?.metadata as any).maximumTeamSize
      : null;

  const teamStatus = team?.status || 'UNKNOWN';
  const isBelowMinimum = team
    ? (teamStatus === 'REGISTERED' && (team?.member_count || 0) < minTeamSize) ||
      team.below_minimum === true
    : false;

  const handleCopySquadId = () => {
    if (team?.id) {
      toast.show(`Squad ID: ${team.id}`, 'info', 'Squad Identifier');
    }
  };

  const handleBackToEvent = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/(app)/events/${id}`);
    }
  };

  const handleConfirmLeave = async () => {
    if (!team) return;
    try {
      await leaveTeamAsync(team.id);
      setShowLeaveModal(false);
      handleBackToEvent();
    } catch {
      // Handled in useTeams
    }
  };

  const handleConfirmRemove = async () => {
    if (!team || !memberToRemove) return;
    try {
      await removeMemberAsync({ teamId: team.id, userId: memberToRemove.user_id });
      setMemberToRemove(null);
    } catch {
      // Handled in useTeams
    }
  };

  const handleSendInvite = async () => {
    if (!team || !inviteeId.trim()) return;
    try {
      await inviteMemberAsync({ teamId: team.id, inviteeId: inviteeId.trim() });
      setInviteeId('');
      setShowInviteModal(false);
    } catch {
      // Handled in useTeams
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing.xl,
        },
        loadingContainer: {
          paddingTop: 80,
          alignItems: 'center',
          gap: 16,
        },
        emptyCard: {
          padding: theme.spacing.xl,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surfaceContainerLow,
          alignItems: 'center',
          gap: theme.spacing.md,
          marginTop: theme.spacing.xl,
        },
        headerCard: {
          padding: theme.spacing.lg,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surfaceContainerLow,
          gap: theme.spacing.xs,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        },
        sectionCard: {
          padding: theme.spacing.lg,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surfaceContainerLow,
          gap: theme.spacing.md,
        },
        sectionTitleRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
          paddingBottom: theme.spacing.sm,
        },
        warningBanner: {
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surfaceContainerHighest,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          gap: 4,
        },
        dangerCard: {
          padding: theme.spacing.lg,
          borderWidth: 1,
          borderColor: theme.colors.error,
          backgroundColor: theme.colors.surfaceContainerLow,
          gap: theme.spacing.md,
        },
        memberRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surfaceContainerLowest,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        memberInfo: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          flex: 1,
        },
        memberAvatar: {
          width: 36,
          height: 36,
          backgroundColor: theme.colors.surfaceContainerHighest,
          borderWidth: 1,
          borderColor: theme.colors.outline,
          alignItems: 'center',
          justifyContent: 'center',
        },
        memberBadges: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        specRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme.spacing.base,
        },
        modalCard: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          width: '100%',
          maxWidth: 440,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        copyBtn: {
          paddingVertical: 4,
          paddingHorizontal: 8,
          backgroundColor: theme.colors.surfaceContainerHighest,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
      }),
    [theme]
  );

  return (
    <MobileShell
      title="SQUAD HUB"
      showBackButton
      scrollable
      onBackPress={handleBackToEvent}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel>LOADING SQUAD COMMAND...</MonoLabel>
        </View>
      ) : !team ? (
        <View style={styles.emptyCard}>
          <StatusBadge status="[NOT ENROLLED]" type="warning" />
          <Title style={{ fontSize: 18, textAlign: 'center' }}>NO SQUAD ENROLLMENT</Title>
          <Body style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', fontSize: 12 }}>
            You are not currently registered with a squad for this event.
          </Body>
          <Button
            title="[ RETURN TO EVENT ]"
            variant="primary"
            onPress={handleBackToEvent}
            style={{ width: '100%', marginTop: 8 }}
          />
        </View>
      ) : (
        <View style={styles.container}>
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <MonoLabel style={{ color: theme.colors.primary, fontSize: 10 }}>
                  SQUAD HEADQUARTERS // {team.member_count} OPERATIVES
                </MonoLabel>
                <Title style={{ fontSize: 24, marginTop: 4 }}>{team.name.toUpperCase()}</Title>
                <MonoLabel style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  Target Event: {event?.title || 'CAMPUS EVENT'}
                </MonoLabel>
              </View>
              <StatusBadge
                status={teamStatus}
                type={teamStatus === 'REGISTERED' ? 'info' : teamStatus === 'WAITLISTED' ? 'warning' : 'default'}
              />
            </View>
          </View>

          {/* Locked Status Notice */}
          {isLocked && (
            <View style={styles.warningBanner}>
              <MonoLabel style={{ color: theme.colors.primary, fontFamily: theme.typography.monoBold }}>
                ROSTER LOCKED
              </MonoLabel>
              <Body style={{ color: theme.colors.onSurface, fontSize: 11 }}>
                This event is locked. Squad rosters are in read-only mode and cannot be modified.
              </Body>
            </View>
          )}

          {/* Below Minimum Alert */}
          {isBelowMinimum && (
            <View style={[styles.warningBanner, { borderColor: theme.colors.warning }]}>
              <MonoLabel style={{ color: theme.colors.warning, fontFamily: theme.typography.monoBold }}>
                BELOW MINIMUM REQUIRED SIZE
              </MonoLabel>
              <Body style={{ color: theme.colors.onSurface, fontSize: 11 }}>
                Additional operatives must enlist to validate your squad entry before check-in begins. Required: {minTeamSize} minimum.
              </Body>
            </View>
          )}

          {/* Squad Specifications */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MonoLabel style={{ color: theme.colors.onSurface, fontFamily: theme.typography.monoBold }}>
                SQUAD SPECIFICATIONS
              </MonoLabel>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <View style={styles.specRow}>
                <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>SQUAD IDENTIFIER</MonoLabel>
                <TouchableOpacity onPress={handleCopySquadId} style={styles.copyBtn} activeOpacity={0.7}>
                  <Mono numberOfLines={1} style={{ fontSize: 10, maxWidth: 180 }}>
                    {team.id}
                  </Mono>
                </TouchableOpacity>
              </View>

              <View style={styles.specRow}>
                <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>TOTAL CAPACITY</MonoLabel>
                <Mono>
                  {team.member_count} {maxTeamSize ? `/ ${maxTeamSize}` : ''} Members
                </Mono>
              </View>

              <View style={styles.specRow}>
                <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>REQUIRED THRESHOLD</MonoLabel>
                <Mono style={{ color: theme.colors.primary }}>{minTeamSize} members minimum</Mono>
              </View>

              <View style={styles.specRow}>
                <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>SQUAD STATUS</MonoLabel>
                <Mono style={{ fontFamily: theme.typography.monoBold }}>{teamStatus}</Mono>
              </View>
            </View>
          </View>

          {/* Squad Roster */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MonoLabel style={{ color: theme.colors.onSurface, fontFamily: theme.typography.monoBold }}>
                SQUAD ROSTER ({team.member_count}{maxTeamSize ? `/${maxTeamSize}` : ''})
              </MonoLabel>
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              {(team.members || []).map((member) => {
                const isMemberLeader = member.user_id === team.leader_id;
                const isCurrent = member.user_id === effectiveUserId;
                const canRemove = isLeader && !isMemberLeader && !isLocked;

                return (
                  <View key={member.user_id} style={styles.memberRow} testID={`team-member-${member.user_id}`}>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberAvatar}>
                        <MonoLabel style={{ fontFamily: theme.typography.monoBold }}>
                          {member.full_name ? member.full_name.charAt(0).toUpperCase() : 'U'}
                        </MonoLabel>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Mono style={{ color: theme.colors.onSurface, fontFamily: theme.typography.monoBold }}>
                          {member.full_name || 'Anonymous Operative'}
                        </Mono>
                        <View style={styles.memberBadges}>
                          {isMemberLeader && (
                            <MonoLabel style={{ color: theme.colors.primary, fontSize: 9 }}>
                              [LEADER]
                            </MonoLabel>
                          )}
                          {isCurrent && (
                            <MonoLabel style={{ color: theme.colors.onSurfaceVariant, fontSize: 9 }}>
                              [YOU]
                            </MonoLabel>
                          )}
                        </View>
                      </View>
                    </View>

                    {canRemove && (
                      <TouchableOpacity
                        onPress={() => setMemberToRemove(member)}
                        disabled={isRemoving}
                        style={{ padding: 6 }}
                        testID={`btn-remove-member-${member.user_id}`}
                      >
                        <MonoLabel style={{ color: theme.colors.error, fontSize: 10 }}>[REMOVE]</MonoLabel>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Leader Actions */}
          {isLeader && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <MonoLabel style={{ color: theme.colors.onSurface, fontFamily: theme.typography.monoBold }}>
                  COMMAND CONTROLS
                </MonoLabel>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <Button
                  title="[ INVITE OPERATIVE ]"
                  variant="secondary"
                  disabled={isLocked || (!!maxTeamSize && team.member_count >= maxTeamSize)}
                  onPress={() => setShowInviteModal(true)}
                  testID="btn-invite-operative"
                />

                <Button
                  title="[ TRANSFER LEADERSHIP ]"
                  variant="secondary"
                  disabled={isLocked || team.member_count <= 1}
                  onPress={() => setShowTransferModal(true)}
                  testID="btn-transfer-leadership"
                />
              </View>
            </View>
          )}

          {/* Danger Zone Actions */}
          <View style={styles.dangerCard}>
            <View style={styles.sectionTitleRow}>
              <MonoLabel style={{ color: theme.colors.error, fontFamily: theme.typography.monoBold }}>
                DANGER CORRIDOR
              </MonoLabel>
            </View>

            <Body style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
              Abandoning the squad will vacate your reserved seat and return you to unregistered status.
            </Body>

            <Button
              title="[ LEAVE SQUAD ]"
              variant="secondary"
              disabled={isLocked}
              onPress={() => setShowLeaveModal(true)}
              style={{ borderColor: theme.colors.error }}
              testID="btn-leave-squad"
            />
          </View>
        </View>
      )}

      {/* Transfer Leadership Modal */}
      {team && (
        <TransferLeadershipModal
          eventId={id as string}
          team={team}
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
        />
      )}

      {/* Leave Squad Confirmation Modal */}
      <Modal visible={showLeaveModal} transparent animationType="fade" onRequestClose={() => !isLeaving && setShowLeaveModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: theme.colors.error }]}>
            <StatusBadge status="[CONFIRM LEAVE]" type="error" />
            <Title style={{ fontSize: 18 }}>LEAVE SQUAD</Title>
            <Body style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
              {isLeader && team && team.member_count > 1
                ? 'You are the squad leader. You must transfer leadership before you can leave, or disband the squad if you are the sole member.'
                : `Are you sure you want to abandon squad "${team?.name}"? Your slot will be vacated immediately.`}
            </Body>

            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <Button
                title={isLeaving ? '[ LEAVING SQUAD... ]' : '[ CONFIRM LEAVE ]'}
                variant="primary"
                onPress={handleConfirmLeave}
                disabled={isLeaving || (isLeader && !!team && team.member_count > 1)}
                loading={isLeaving}
              />
              <Button
                title="[ CANCEL ]"
                variant="secondary"
                onPress={() => setShowLeaveModal(false)}
                disabled={isLeaving}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove Member Confirmation Modal */}
      <Modal visible={!!memberToRemove} transparent animationType="fade" onRequestClose={() => !isRemoving && setMemberToRemove(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: theme.colors.error }]}>
            <StatusBadge status="[REMOVE OPERATIVE]" type="error" />
            <Title style={{ fontSize: 18 }}>REMOVE MEMBER</Title>
            <Body style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
              Are you sure you want to remove operative "{memberToRemove?.full_name}" from squad "{team?.name}"?
            </Body>

            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <Button
                title={isRemoving ? '[ REMOVING... ]' : '[ CONFIRM REMOVAL ]'}
                variant="primary"
                onPress={handleConfirmRemove}
                disabled={isRemoving}
                loading={isRemoving}
              />
              <Button
                title="[ CANCEL ]"
                variant="secondary"
                onPress={() => setMemberToRemove(null)}
                disabled={isRemoving}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Operative Modal */}
      <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => !isInviting && setShowInviteModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Title style={{ fontSize: 18 }}>INVITE OPERATIVE</Title>
            <Body style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
              Enter the student ID or institutional account identifier to dispatch an official squad invitation.
            </Body>

            <TextField
              label="Student ID / Invitee ID"
              required
              value={inviteeId}
              onChangeText={setInviteeId}
              placeholder="e.g. student-uuid"
              editable={!isInviting}
              autoCapitalize="none"
            />

            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <Button
                title={isInviting ? '[ DISPATCHING... ]' : '[ SEND INVITATION ]'}
                variant="primary"
                onPress={handleSendInvite}
                disabled={!inviteeId.trim() || isInviting}
                loading={isInviting}
              />
              <Button
                title="[ CANCEL ]"
                variant="secondary"
                onPress={() => setShowInviteModal(false)}
                disabled={isInviting}
              />
            </View>
          </View>
        </View>
      </Modal>
    </MobileShell>
  );
}
