import React, { useState, useEffect, useMemo } from 'react';
import { View, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../store/theme-store';
import { Title, Body, MonoLabel, Mono } from './core/Typography';
import { Button } from './Button';
import { TextField } from './core/TextField';
import { DynamicFieldInput } from './DynamicFieldInput';
import { StatusBadge } from './core/StatusBadge';
import { ActivityIndicator } from './core/ActivityIndicator';
import { useTeams, useTeamsList, Team } from '../hooks/use-teams';
import { useEventFormFields } from '../hooks/useEventFormFields';
import { useProfileValues, ProfileValue } from '../hooks/useProfileValues';
import {
  validateFormResponses,
  toResponsePayload,
  isFieldValueEmpty,
} from '../lib/form-utils';

interface TeamGatewayModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  isTeamCapacityFull?: boolean;
  isParticipantCapacityFull?: boolean;
  onSuccess?: () => void;
}

export function TeamGatewayModal({
  eventId,
  isOpen,
  onClose,
  isTeamCapacityFull = false,
  isParticipantCapacityFull = false,
  onSuccess,
}: TeamGatewayModalProps) {
  const router = useRouter();
  const theme = useAppTheme();

  const [view, setView] = useState<'GATEWAY' | 'CREATE' | 'JOIN' | 'CONFIRM_JOIN'>('GATEWAY');
  const [teamName, setTeamName] = useState('');
  const [teamNameError, setTeamNameError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Questionnaire state
  const { data: eventFormFields, isLoading: isLoadingFields } = useEventFormFields(eventId);
  const { data: profileValues } = useProfileValues();

  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const {
    createTeamAsync,
    isCreating,
    joinTeamAsync,
    isJoining,
  } = useTeams(eventId);

  const { data: teamsData, isLoading: isLoadingTeams, refetch: refetchTeams } = useTeamsList(eventId);

  // Pre-fill profile values when fields or profile values are loaded
  useEffect(() => {
    if (isOpen && eventFormFields && profileValues) {
      const initial: Record<string, string> = {};
      eventFormFields.forEach((f) => {
        const profileMatch = profileValues.find(
          (p: ProfileValue) => p.fieldDefinitionId === f.fieldDefinitionId
        );
        if (profileMatch && profileMatch.value) {
          initial[f.fieldDefinitionId] = profileMatch.value;
        }
      });
      setFormResponses((prev) => ({ ...initial, ...prev }));
    }
  }, [isOpen, eventFormFields, profileValues]);

  const handleFieldResponseChange = (fieldDefId: string, value: string) => {
    setFormResponses((prev) => ({ ...prev, [fieldDefId]: value }));
    if (fieldErrors[fieldDefId]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldDefId];
        return next;
      });
    }
    if (registrationError) {
      setRegistrationError(null);
    }
  };

  const reset = () => {
    setView('GATEWAY');
    setTeamName('');
    setTeamNameError(null);
    setSelectedTeam(null);
    setFieldErrors({});
    setRegistrationError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (isParticipantCapacityFull) {
      setRegistrationError('Event participant capacity is full.');
      return;
    }
    if (!teamName.trim()) {
      setTeamNameError('Squad name is required.');
      return;
    }

    const normalizedInput = teamName.trim().toLowerCase();
    if (teamsData?.data) {
      if (teamsData.data.some((t: Team) => t.name.trim().toLowerCase() === normalizedInput)) {
        setTeamNameError('This team name is already taken.');
        return;
      }
    }

    // Validate registration questionnaire responses
    if (eventFormFields && eventFormFields.length > 0) {
      const validation = validateFormResponses(eventFormFields, formResponses);
      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        const firstMissing = eventFormFields.find(
          (f) => f.isRequired && isFieldValueEmpty(formResponses[f.fieldDefinitionId])
        );
        if (firstMissing) {
          setRegistrationError(`Please answer required question: "${firstMissing.fieldDefinition.label}"`);
        } else {
          setRegistrationError(validation.firstError || 'Please fill in all required fields.');
        }
        return;
      }
    }

    setFieldErrors({});
    setRegistrationError(null);

    const responses = eventFormFields && eventFormFields.length > 0 ? toResponsePayload(formResponses) : undefined;

    try {
      await createTeamAsync({ name: teamName.trim(), responses });
      handleClose();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/(app)/events/${eventId}/teams`);
      }
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes('TEAM_NAME_TAKEN') || err?.message?.includes('taken')) {
        setTeamNameError('This team name is already taken for this event.');
      } else {
        setRegistrationError(err?.message || 'Failed to create team. Please try again.');
      }
    }
  };

  const handleJoin = async () => {
    if (isParticipantCapacityFull) {
      setRegistrationError('Event participant capacity is full.');
      return;
    }
    if (!selectedTeam) return;

    // Validate registration questionnaire responses
    if (eventFormFields && eventFormFields.length > 0) {
      const validation = validateFormResponses(eventFormFields, formResponses);
      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        const firstMissing = eventFormFields.find(
          (f) => f.isRequired && isFieldValueEmpty(formResponses[f.fieldDefinitionId])
        );
        if (firstMissing) {
          setRegistrationError(`Please answer required question: "${firstMissing.fieldDefinition.label}"`);
        } else {
          setRegistrationError(validation.firstError || 'Please fill in all required fields.');
        }
        return;
      }
    }

    setFieldErrors({});
    setRegistrationError(null);

    const responses = eventFormFields && eventFormFields.length > 0 ? toResponsePayload(formResponses) : undefined;

    try {
      await joinTeamAsync({ teamId: selectedTeam.id, responses });
      handleClose();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/(app)/events/${eventId}/teams`);
      }
    } catch (err: any) {
      setRegistrationError(err?.message || 'Failed to join team. Please try again.');
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
          maxWidth: 480,
          maxHeight: '90%',
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
        alertBoxError: {
          padding: theme.spacing.sm,
          backgroundColor: theme.colors.errorContainer,
          borderWidth: 1,
          borderColor: theme.colors.error,
          gap: 4,
        },
        alertBoxWarning: {
          padding: theme.spacing.sm,
          backgroundColor: theme.colors.surfaceContainerHighest,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          gap: 4,
        },
        choiceCard: {
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          gap: 4,
        },
        choiceCardDisabled: {
          opacity: 0.45,
        },
        choiceTitle: {
          color: theme.colors.onSurface,
          fontSize: 14,
          fontFamily: theme.typography.monoBold,
        },
        choiceSubtitle: {
          color: theme.colors.onSurfaceVariant,
          fontSize: 11,
        },
        teamItem: {
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        teamSelectedCard: {
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surfaceContainerHighest,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          gap: 4,
        },
      }),
    [theme]
  );

  if (!isOpen) return null;

  const hasQuestions = eventFormFields && eventFormFields.length > 0;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Title style={{ fontSize: 18 }}>
              {view === 'CREATE'
                ? 'CREATE SQUAD'
                : view === 'JOIN'
                ? 'JOIN SQUAD'
                : view === 'CONFIRM_JOIN'
                ? 'ENLIST IN SQUAD'
                : 'SQUAD GATEWAY'}
            </Title>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>[CLOSE]</MonoLabel>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.md }}>
            {/* GATEWAY VIEW */}
            {view === 'GATEWAY' && (
              <View style={{ gap: theme.spacing.md }}>
                {isParticipantCapacityFull && (
                  <View style={styles.alertBoxError}>
                    <MonoLabel style={{ color: theme.colors.error, fontFamily: theme.typography.monoBold }}>
                      PARTICIPANT CAPACITY REACHED
                    </MonoLabel>
                    <Body style={{ color: theme.colors.onErrorContainer, fontSize: 11 }}>
                      This event has reached its maximum participant limit. Squad creation and joining are currently disabled.
                    </Body>
                  </View>
                )}

                {isTeamCapacityFull && !isParticipantCapacityFull && (
                  <View style={styles.alertBoxWarning}>
                    <MonoLabel style={{ color: theme.colors.primary, fontFamily: theme.typography.monoBold }}>
                      TEAM CAPACITY REACHED
                    </MonoLabel>
                    <Body style={{ color: theme.colors.onSurface, fontSize: 11 }}>
                      Maximum registered teams reached. New squads will enter the waitlist queue, but you can still join existing squads with open spots.
                    </Body>
                  </View>
                )}

                <Body style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                  This event operates under squad registration. Form a new team as leader or enlist in an existing roster.
                </Body>

                <TouchableOpacity
                  disabled={isParticipantCapacityFull}
                  onPress={() => {
                    setRegistrationError(null);
                    setFieldErrors({});
                    setView('CREATE');
                  }}
                  style={[styles.choiceCard, isParticipantCapacityFull && styles.choiceCardDisabled]}
                  activeOpacity={0.7}
                  testID="btn-gateway-create"
                >
                  <Mono style={styles.choiceTitle}>+ CREATE A SQUAD</Mono>
                  <Body style={styles.choiceSubtitle}>
                    {isTeamCapacityFull
                      ? 'Waitlist only (Team capacity reached)'
                      : 'You will be appointed squad leader'}
                  </Body>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isParticipantCapacityFull}
                  onPress={() => {
                    setRegistrationError(null);
                    setFieldErrors({});
                    setView('JOIN');
                    refetchTeams();
                  }}
                  style={[styles.choiceCard, isParticipantCapacityFull && styles.choiceCardDisabled]}
                  activeOpacity={0.7}
                  testID="btn-gateway-join"
                >
                  <Mono style={styles.choiceTitle}>→ JOIN EXISTING SQUAD</Mono>
                  <Body style={styles.choiceSubtitle}>
                    {isTeamCapacityFull
                      ? 'Open roster spots available to join'
                      : 'Browse and join an open roster'}
                  </Body>
                </TouchableOpacity>
              </View>
            )}

            {/* CREATE VIEW */}
            {view === 'CREATE' && (
              <View style={{ gap: theme.spacing.md }}>
                {registrationError && (
                  <View style={styles.alertBoxError}>
                    <MonoLabel style={{ color: theme.colors.error, fontFamily: theme.typography.monoBold }}>
                      VALIDATION NOTICE
                    </MonoLabel>
                    <Body style={{ color: theme.colors.onErrorContainer, fontSize: 11 }}>
                      {registrationError}
                    </Body>
                  </View>
                )}

                <TextField
                  label="Squad Name"
                  required
                  error={teamNameError}
                  editable={!isCreating}
                  value={teamName}
                  onChangeText={(val) => {
                    setTeamName(val);
                    setTeamNameError(null);
                  }}
                  placeholder="Enter squad identifier..."
                  autoCapitalize="words"
                />

                {isLoadingFields && (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <MonoLabel style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                      Loading registration questionnaire...
                    </MonoLabel>
                  </View>
                )}

                {hasQuestions && (
                  <View style={{ gap: theme.spacing.sm, marginTop: 4 }}>
                    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant, paddingBottom: 4 }}>
                      <MonoLabel style={{ color: theme.colors.primary, fontFamily: theme.typography.monoBold }}>
                        REQUIRED REGISTRATION DETAILS
                      </MonoLabel>
                    </View>
                    <View style={{ gap: theme.spacing.md }}>
                      {eventFormFields.map((field) => (
                        <DynamicFieldInput
                          key={field.fieldDefinitionId}
                          field={field}
                          value={formResponses[field.fieldDefinitionId] || ''}
                          onChange={(val) => handleFieldResponseChange(field.fieldDefinitionId, val)}
                          disabled={isCreating}
                          error={fieldErrors[field.fieldDefinitionId]}
                        />
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  <Button
                    title={isCreating ? '[ CREATING SQUAD... ]' : '[ CONFIRM & CREATE SQUAD ]'}
                    onPress={handleCreate}
                    disabled={!teamName.trim() || isCreating}
                    loading={isCreating}
                  />
                  <Button
                    title="[ BACK ]"
                    variant="secondary"
                    onPress={() => {
                      setRegistrationError(null);
                      setFieldErrors({});
                      setView('GATEWAY');
                    }}
                    disabled={isCreating}
                  />
                </View>
              </View>
            )}

            {/* JOIN VIEW */}
            {view === 'JOIN' && (
              <View style={{ gap: theme.spacing.md }}>
                {isLoadingTeams ? (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <MonoLabel style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                      LOADING AVAILABLE SQUADS...
                    </MonoLabel>
                  </View>
                ) : !teamsData?.data || teamsData.data.length === 0 ? (
                  <View style={{ padding: theme.spacing.xl, alignItems: 'center', gap: 8 }}>
                    <MonoLabel style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                      NO OPEN SQUADS FOUND.
                    </MonoLabel>
                    <Body style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, textAlign: 'center' }}>
                      Be the first to create one for this event!
                    </Body>
                  </View>
                ) : (
                  <View style={{ gap: theme.spacing.sm }}>
                    {teamsData.data.map((team: Team) => {
                      const isCancelled = team.status === 'CANCELLED';
                      return (
                        <TouchableOpacity
                          key={team.id}
                          disabled={isCancelled}
                          onPress={() => {
                            setSelectedTeam(team);
                            setRegistrationError(null);
                            setFieldErrors({});
                            setView('CONFIRM_JOIN');
                          }}
                          style={[styles.teamItem, isCancelled && { opacity: 0.4 }]}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Mono style={{ color: theme.colors.onSurface, fontFamily: theme.typography.monoBold }}>
                              {team.name}
                            </Mono>
                            <MonoLabel style={{ color: theme.colors.onSurfaceVariant, fontSize: 10, marginTop: 2 }}>
                              Leader: {team.leader_name} • {team.member_count} members
                            </MonoLabel>
                          </View>
                          <MonoLabel style={{ color: theme.colors.primary }}>[SELECT]</MonoLabel>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <Button
                  title="[ BACK ]"
                  variant="secondary"
                  onPress={() => {
                    setRegistrationError(null);
                    setFieldErrors({});
                    setView('GATEWAY');
                  }}
                />
              </View>
            )}

            {/* CONFIRM JOIN VIEW */}
            {view === 'CONFIRM_JOIN' && selectedTeam && (
              <View style={{ gap: theme.spacing.md }}>
                {registrationError && (
                  <View style={styles.alertBoxError}>
                    <MonoLabel style={{ color: theme.colors.error, fontFamily: theme.typography.monoBold }}>
                      VALIDATION NOTICE
                    </MonoLabel>
                    <Body style={{ color: theme.colors.onErrorContainer, fontSize: 11 }}>
                      {registrationError}
                    </Body>
                  </View>
                )}

                <View style={styles.teamSelectedCard}>
                  <MonoLabel style={{ color: theme.colors.primary, fontSize: 10 }}>SELECTED SQUAD</MonoLabel>
                  <Title style={{ fontSize: 18 }}>{selectedTeam.name}</Title>
                  <MonoLabel style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                    Leader: {selectedTeam.leader_name} • Current Members: {selectedTeam.member_count}
                  </MonoLabel>
                </View>

                {isLoadingFields && (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <MonoLabel style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                      Loading registration questionnaire...
                    </MonoLabel>
                  </View>
                )}

                {hasQuestions && (
                  <View style={{ gap: theme.spacing.sm, marginTop: 4 }}>
                    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant, paddingBottom: 4 }}>
                      <MonoLabel style={{ color: theme.colors.primary, fontFamily: theme.typography.monoBold }}>
                        YOUR REGISTRATION DETAILS
                      </MonoLabel>
                    </View>
                    <View style={{ gap: theme.spacing.md }}>
                      {eventFormFields.map((field) => (
                        <DynamicFieldInput
                          key={field.fieldDefinitionId}
                          field={field}
                          value={formResponses[field.fieldDefinitionId] || ''}
                          onChange={(val) => handleFieldResponseChange(field.fieldDefinitionId, val)}
                          disabled={isJoining}
                          error={fieldErrors[field.fieldDefinitionId]}
                        />
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  <Button
                    title={isJoining ? '[ JOINING SQUAD... ]' : '[ CONFIRM SQUAD ENLISTMENT ]'}
                    onPress={handleJoin}
                    disabled={isJoining}
                    loading={isJoining}
                  />
                  <Button
                    title="[ BACK TO SQUADS ]"
                    variant="secondary"
                    onPress={() => {
                      setRegistrationError(null);
                      setFieldErrors({});
                      setView('JOIN');
                    }}
                    disabled={isJoining}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
