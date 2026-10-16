import React, { useState, useMemo } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { Title, Body, MonoLabel, Mono } from './core/Typography';
import { Button } from './Button';
import { useTeams, Team, TeamMember } from '../hooks/use-teams';

interface TransferLeadershipModalProps {
  eventId: string;
  team: Team;
  isOpen: boolean;
  onClose: () => void;
}

export function TransferLeadershipModal({
  eventId,
  team,
  isOpen,
  onClose,
}: TransferLeadershipModalProps) {
  const theme = useAppTheme();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { transferLeadershipAsync, isTransferring } = useTeams(eventId);

  const eligibleMembers = (team.members || []).filter(
    (m: TeamMember) => m.user_id !== team.leader_id
  );

  const handleTransfer = async () => {
    setErrorMsg(null);
    if (!selectedMemberId) {
      setErrorMsg('Please select a member to transfer leadership to.');
      return;
    }

    try {
      await transferLeadershipAsync({ teamId: team.id, newLeaderId: selectedMemberId });
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to transfer leadership. Please try again.');
    }
  };

  const handleClose = () => {
    if (!isTransferring) {
      setSelectedMemberId(null);
      setErrorMsg(null);
      onClose();
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme.spacing.base,
        },
        card: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          width: '100%',
          maxWidth: 440,
          maxHeight: '85%',
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
          paddingBottom: theme.spacing.sm,
        },
        warningBox: {
          padding: theme.spacing.sm,
          backgroundColor: theme.colors.surfaceContainerHighest,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          gap: 4,
        },
        errorBox: {
          padding: theme.spacing.sm,
          backgroundColor: theme.colors.errorContainer,
          borderWidth: 1,
          borderColor: theme.colors.error,
        },
        memberItem: {
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        memberItemSelected: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surfaceContainerHighest,
        },
      }),
    [theme]
  );

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Title style={{ fontSize: 16 }}>TRANSFER SQUAD LEADERSHIP</Title>
            <TouchableOpacity onPress={handleClose} disabled={isTransferring}>
              <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>[CLOSE]</MonoLabel>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.md }}>
            <View style={styles.warningBox}>
              <MonoLabel style={{ color: theme.colors.primary, fontFamily: theme.typography.monoBold }}>
                WARNING: IRREVERSIBLE ACTION
              </MonoLabel>
              <Body style={{ color: theme.colors.onSurface, fontSize: 11 }}>
                If you transfer leadership, you will become a regular member and yield control of the squad roster.
              </Body>
            </View>

            {errorMsg && (
              <View style={styles.errorBox}>
                <MonoLabel style={{ color: theme.colors.onErrorContainer }}>{errorMsg}</MonoLabel>
              </View>
            )}

            <View style={{ gap: theme.spacing.xs }}>
              <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>SELECT SUCCESSOR</MonoLabel>
              {eligibleMembers.length === 0 ? (
                <View style={{ padding: theme.spacing.md, alignItems: 'center' }}>
                  <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>
                    No other confirmed members in squad.
                  </MonoLabel>
                </View>
              ) : (
                <View style={{ gap: theme.spacing.xs }}>
                  {eligibleMembers.map((member) => {
                    const isSelected = selectedMemberId === member.user_id;
                    return (
                      <TouchableOpacity
                        key={member.user_id}
                        onPress={() => setSelectedMemberId(member.user_id)}
                        disabled={isTransferring}
                        style={[styles.memberItem, isSelected && styles.memberItemSelected]}
                        activeOpacity={0.7}
                      >
                        <Mono style={{ color: theme.colors.onSurface, fontFamily: theme.typography.monoBold }}>
                          {member.full_name}
                        </Mono>
                        {isSelected && (
                          <MonoLabel style={{ color: theme.colors.primary }}>[SELECTED]</MonoLabel>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <Button
                title={isTransferring ? '[ PROCESSING... ]' : '[ CONFIRM TRANSFER ]'}
                onPress={handleTransfer}
                disabled={!selectedMemberId || isTransferring}
                loading={isTransferring}
              />
              <Button
                title="[ CANCEL ]"
                variant="secondary"
                onPress={handleClose}
                disabled={isTransferring}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
