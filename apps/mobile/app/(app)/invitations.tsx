import React, { useMemo } from 'react';
import { View, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePendingInvitations } from '../../src/hooks/use-invitations';
import { useTeams } from '../../src/hooks/use-teams';
import { useNetworkStatus } from '../../src/infrastructure/network';
import { useAppTheme } from '../../src/store/theme-store';
import { MobileShell } from '../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono } from '../../src/ui/core/Typography';
import { StatusBadge } from '../../src/ui/core/StatusBadge';
import { Button } from '../../src/ui/Button';

export default function InvitationsScreen() {
  const { invitationId } = useLocalSearchParams<{ invitationId: string }>();
  const { data: invitations, isLoading, refetch, isRefetching } = usePendingInvitations();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();
  const theme = useAppTheme();

  const { acceptInvitation, isAccepting, declineInvitation, isDeclining } = useTeams('');
  const isActionLoading = isAccepting || isDeclining;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    offlineNotice: {
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.errorContainer,
      borderWidth: 1,
      borderColor: theme.colors.error,
      alignItems: 'center',
    },
    offlineText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.onErrorContainer,
      letterSpacing: 0.8,
    },
    loadingCard: {
      padding: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surfaceContainerLow,
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    loadingText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 0.8,
    },
    emptyCard: {
      padding: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surfaceContainerLow,
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
    },
    emptyTitle: {
      fontSize: 16,
      color: theme.colors.primary,
      textAlign: 'center',
    },
    emptyDesc: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    invitationCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      padding: theme.spacing.base,
      gap: theme.spacing.md,
    },
    invitationCardHighlighted: {
      borderColor: theme.colors.primary,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    teamName: {
      fontSize: 18,
      color: theme.colors.onSurface,
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    metaSection: {
      gap: 4,
    },
    metaLabel: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    metaValue: {
      fontSize: 13,
      color: theme.colors.primary,
    },
    expiryText: {
      fontSize: 11,
      color: theme.colors.outline,
      marginTop: 2,
    },
    expiredNotice: {
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    expiredNoticeText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.outline,
      letterSpacing: 0.8,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    actionBtn: {
      flex: 1,
      height: 44,
    },
  }), [theme]);

  const filteredInvitations = useMemo(() => {
    if (!invitations) return [];
    if (invitationId) {
      return invitations.filter((inv) => inv.invitation_id === invitationId);
    }
    return invitations;
  }, [invitations, invitationId]);

  return (
    <MobileShell
      title="INVITATIONS"
      showBackButton
      scrollable
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={async () => {
            await refetch();
          }}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.container}>
        {!isOnline && (
          <View style={styles.offlineNotice}>
            <MonoLabel style={styles.offlineText}>[OFFLINE MODE] NETWORK UNAVAILABLE</MonoLabel>
          </View>
        )}

        {isLoading && !isRefetching ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <MonoLabel style={styles.loadingText}>FETCHING PENDING INVITATIONS...</MonoLabel>
          </View>
        ) : filteredInvitations.length === 0 ? (
          <View style={styles.emptyCard}>
            <StatusBadge status="NO PENDING" type="default" />
            <Title style={styles.emptyTitle}>No Team Invitations</Title>
            <Body style={styles.emptyDesc}>
              You currently have no pending team invitations to join or review.
            </Body>
          </View>
        ) : (
          filteredInvitations.map((inv) => {
            const isExpired = new Date(inv.expires_at) < new Date();
            const isHighlighted = invitationId === inv.invitation_id;

            return (
              <View
                key={inv.invitation_id}
                style={[
                  styles.invitationCard,
                  isHighlighted && styles.invitationCardHighlighted,
                ]}
              >
                <View style={styles.cardHeader}>
                  <Title style={styles.teamName}>{inv.team.team_name.toUpperCase()}</Title>
                  <StatusBadge
                    status={isExpired ? 'EXPIRED' : 'PENDING'}
                    type={isExpired ? 'error' : 'info'}
                  />
                </View>

                <View style={styles.metaSection}>
                  <MonoLabel style={styles.metaLabel}>EVENT</MonoLabel>
                  <Body style={styles.metaValue}>{inv.event.event_title}</Body>

                  <MonoLabel style={styles.metaLabel}>INVITED BY</MonoLabel>
                  <Body style={styles.metaValue}>{inv.inviter.full_name}</Body>

                  <Mono style={styles.expiryText}>
                    EXPIRES: {new Date(inv.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(inv.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Mono>
                </View>

                {isExpired ? (
                  <View style={styles.expiredNotice}>
                    <MonoLabel style={styles.expiredNoticeText}>INVITATION EXPIRED</MonoLabel>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <Button
                      title="DECLINE"
                      variant="danger"
                      accessibilityLabel={`Decline invitation to ${inv.team.team_name}`}
                      disabled={!isOnline || isActionLoading}
                      onPress={() => declineInvitation({ teamId: inv.team.team_id, invitationId: inv.invitation_id })}
                      style={styles.actionBtn}
                    />
                    <Button
                      title="ACCEPT"
                      variant="primary"
                      accessibilityLabel={`Accept invitation to ${inv.team.team_name}`}
                      disabled={!isOnline || isActionLoading}
                      onPress={() =>
                        acceptInvitation(
                          { teamId: inv.team.team_id, invitationId: inv.invitation_id },
                          {
                            onSuccess: () => {
                              router.push(`/events/${inv.event.event_id}/teams`);
                            },
                          }
                        )
                      }
                      style={styles.actionBtn}
                    />
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </MobileShell>
  );
}
