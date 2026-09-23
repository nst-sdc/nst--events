import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Image, Modal, TouchableOpacity } from 'react-native';
import { ActivityIndicator } from '../../../../src/ui/core/ActivityIndicator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../../src/infrastructure/api';
import { useEventLive } from '../../../../src/hooks/use-event-live';
import { useEventSessions } from '../../../../src/hooks/use-events';
import { useAttendanceHistory } from '../../../../src/hooks/use-attendance-history';
import { useUserProfile } from '../../../../src/hooks/use-user-profile';
import { useRegistration } from '../../../../src/hooks/use-registration';
import { useEventFormFields } from '../../../../src/hooks/useEventFormFields';
import { useEventForms } from '../../../../src/hooks/useEventForms';
import { useNetworkStatus } from '../../../../src/infrastructure/network';
import { useAppTheme } from '../../../../src/store/theme-store';
import { Button } from '../../../../src/ui/Button';
import { MobileShell } from '../../../../src/ui/core/MobileShell';
import { Title, Display, Body, MonoLabel, Mono } from '../../../../src/ui/core/Typography';
import { StatusBadge } from '../../../../src/ui/core/StatusBadge';
import { 
  findActiveAttendanceSession, 
  isSessionAttendancePresent, 
  isEventCurrentlyLive 
} from '../../../../src/lib/home-events';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  const theme = useAppTheme();

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const {
    registerAsync,
    isRegistering,
    cancelAsync,
    isCancelling,
  } = useRegistration(id as string);

  useEventLive(id as string);

  const { data: profile } = useUserProfile();

  const { 
    data: event, 
    isLoading: isEventLoading, 
    isError: isEventError, 
    error: eventError, 
    refetch: refetchEvent 
  } = useQuery({
    queryKey: ['events', id],
    queryFn: () => apiClient(`/v1/events/${id}`),
  });

  const { data: eventFormFields } = useEventFormFields(id as string);

  const { data: registration, isLoading: isRegLoading } = useQuery({
    queryKey: ['events', id, 'registration'],
    queryFn: () => apiClient(`/v1/events/${id}/my-registration`),
  });

  const { data: sessions = [] } = useEventSessions(id as string);
  const { data: attendanceHistory } = useAttendanceHistory(id as string);

  const isLoading = isEventLoading || isRegLoading;
  
  const isFull = event?.maxCapacity ? (event.registrationCount || 0) >= event.maxCapacity : false;
  const isWaitlistCancel = (registration?.status || (registration as any)?.registrationStatus) === 'WAITLISTED';
  const isRegistered = (registration?.status || (registration as any)?.registrationStatus) === 'REGISTERED';
  const { data: standaloneForms, isLoading: isFormsLoading } = useEventForms(id as string, isRegistered);
  
  const primaryClub = event?.eventClubs?.find((ec: any) => ec.isPrimary);
  const isPrimaryClubAdmin = !!(profile?.club_memberships?.some(
    (m: any) => m.club_id === primaryClub?.clubId && (m.role === 'CLUB_ADMIN' || m.role === 'CORE_MEMBER')
  ));

  const eventAudience = (event as any)?.audience;
  const audienceBatchIds: string[] = (event as any)?.audienceBatchIds || [];
  const studentBatchId = profile?.academic_profile?.batch?.id ?? null;
  const isBatchIneligible =
    eventAudience === 'SPECIFIC_BATCHES' &&
    !!studentBatchId &&
    !audienceBatchIds.includes(studentBatchId);

  const registrationOpensAt = (event as any)?.registrationStartTime || (event as any)?.registration_start_time;
  const registrationClosesAt = (event as any)?.registrationEndTime || (event as any)?.registration_end_time;

  const now = new Date();
  const activeSession = findActiveAttendanceSession(
    sessions,
    (event as any)?.attendanceSessions,
    now
  );

  const hasAttendanceForActiveSession = isSessionAttendancePresent(
    activeSession?.id,
    attendanceHistory?.pages,
    id as string
  );

  const isSessionActive = !!activeSession;
  const isLive = isSessionActive || isEventCurrentlyLive(event, now);
  const isEventEnded = event?.endTime ? (new Date(event.endTime) < now && !isSessionActive) : false;

  const bannerUrl = event?.metadata?.banner_url as string | undefined;

  const styles = useMemo(() => StyleSheet.create({
    heroSection: {
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    heroBanner: {
      width: '100%',
      height: 200,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surfaceContainerHighest,
    },
    statusRow: {
      marginBottom: theme.spacing.sm,
    },
    title: {
      fontSize: 28,
      lineHeight: 32,
      marginBottom: 8,
    },
    location: {
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 1,
    },
    gridSection: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    gridRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    gridRowLast: {
      flexDirection: 'row',
    },
    gridCol: {
      flex: 1,
      padding: theme.spacing.base,
    },
    gridColRight: {
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.outlineVariant,
    },
    metaLabel: {
      marginBottom: 4,
    },
    successColor: {
      color: theme.colors.primaryFixed,
    },
    infoBlock: {
      gap: 6,
    },
    descriptionBlock: {
      gap: 8,
      marginBottom: 32,
    },
    actionSection: {
      width: '100%',
    },
    actionBtn: {
      width: '100%',
      minHeight: 52,
      height: 52,
    },
    cancelBtn: {
      flex: 1,
      minHeight: 52,
      height: 52,
    },
    multiActionTray: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      width: '100%',
    },
    restrictedTray: {
      backgroundColor: theme.colors.surfaceContainerHighest,
      padding: theme.spacing.base,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    restrictedText: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    successTray: {
      backgroundColor: theme.colors.surfaceContainerHighest,
      padding: theme.spacing.base,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.primaryFixed,
    },
    successText: {
      color: theme.colors.primaryFixed,
    },
    loadingContainer: {
      paddingTop: 80,
      alignItems: 'center',
      gap: 16,
    },
    errorContainer: {
      backgroundColor: theme.colors.surfaceContainerLow,
      padding: theme.spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      gap: 16,
      marginTop: 40,
    },
    errorTitle: {
      color: theme.colors.onSurface,
      fontSize: 20,
    },
    errorSub: {
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
    },
    actionTrayStack: {
      gap: theme.spacing.sm,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.82)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.base,
    },
    modalCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      width: '100%',
      maxWidth: 420,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    modalCardError: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.error,
      width: '100%',
      maxWidth: 420,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    modalMetaBox: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      padding: theme.spacing.md,
      gap: 8,
    },
    modalMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalNoticeBox: {
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    modalWarningBox: {
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.errorContainer,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    modalNoticeText: {
      fontSize: 11,
      lineHeight: 16,
      color: theme.colors.onSurfaceVariant,
    },
    modalWarningText: {
      fontSize: 11,
      lineHeight: 16,
      color: theme.colors.onErrorContainer,
      fontFamily: theme.typography.monoMedium,
    },
  }), [theme]);

  const handleConfirmRegister = async () => {
    try {
      await registerAsync(undefined);
    } catch {
      // Handled in useRegistration toast
    } finally {
      setShowRegisterModal(false);
    }
  };

  const handleConfirmCancel = async () => {
    const isWaitlist = (registration?.status || (registration as any)?.registrationStatus) === 'WAITLISTED';
    try {
      await cancelAsync({ isWaitlist });
    } catch {
      // Handled in useRegistration toast
    } finally {
      setShowCancelModal(false);
    }
  };
  
  const renderActionTray = () => {
    if (!isOnline) {
      return (
        <View style={styles.restrictedTray}>
          <MonoLabel style={styles.restrictedText}>OFFLINE — ACTIONS UNAVAILABLE</MonoLabel>
        </View>
      );
    }

    if (isPrimaryClubAdmin) {
      return (
        <View style={styles.restrictedTray}>
          <MonoLabel style={styles.restrictedText}>ORGANIZER — USE DESKTOP TO MANAGE</MonoLabel>
        </View>
      );
    }

    const lockDeadline = (event as any)?.lock_deadline
      ? new Date((event as any).lock_deadline)
      : event?.endTime
        ? new Date(new Date(event.endTime).getTime() + 24 * 60 * 60 * 1000)
        : null;
    const isPastLockDeadline = lockDeadline ? new Date() > lockDeadline : false;
    const isLocked = !!event?.isLocked || !!(event as any)?.is_locked || isPastLockDeadline;
    const registrationType = event?.registrationType || (event as any)?.registration_type;
    
    // Check locked state BEFORE session/registration logic to satisfy audit rule
    if (isLocked || event?.state !== 'PUBLISHED') {
      return (
        <View style={styles.restrictedTray}>
          <MonoLabel style={styles.restrictedText}>
            {event?.isLocked ? 'EVENT LOCKED' : isLocked ? 'EVENT LOCKED' : 'REGISTRATION CLOSED'}
          </MonoLabel>
        </View>
      );
    }

    const status = registration?.status || (registration as any)?.registrationStatus || 'NOT_REGISTERED';

    if (isBatchIneligible && (status === 'NOT_REGISTERED' || status === 'CANCELLED')) {
      return (
        <View style={[styles.restrictedTray, { borderColor: theme.colors.error, gap: 6 }]}>
          <MonoLabel style={[styles.restrictedText, { color: theme.colors.error }]}>
            YOUR BATCH CANNOT REGISTER FOR THIS EVENT
          </MonoLabel>
          <MonoLabel style={styles.restrictedText}>
            RESTRICTED TO SELECTED BATCHES
          </MonoLabel>
        </View>
      );
    }

    // TEAM events: Must route to squad management instead of invoking solo register/cancel endpoints
    if (registrationType === 'TEAM') {
      if (status === 'REGISTERED' && activeSession) {
        if (hasAttendanceForActiveSession) {
          return (
            <View style={styles.successTray}>
              <MonoLabel style={styles.successText}>ATTENDANCE MARKED</MonoLabel>
            </View>
          );
        }
        return (
          <Button
            title="[ SCAN QR / MARK ATTENDANCE ]"
            onPress={() => router.push(`/(app)/events/${id}/scan`)}
            variant="primary"
            style={styles.actionBtn}
          />
        );
      }
      return (
        <Button
          title="[ SQUAD DETAILS & RULES ]"
          onPress={() => router.push(`/(app)/events/${id}/teams`)}
          variant="secondary"
          style={styles.actionBtn}
        />
      );
    }

    if (status === 'REGISTERED') {
      if (activeSession) {
        if (hasAttendanceForActiveSession) {
          return (
            <View style={styles.successTray}>
              <MonoLabel style={styles.successText}>ATTENDANCE MARKED</MonoLabel>
            </View>
          );
        }
        return (
          <Button
            title="[ SCAN QR / MARK ATTENDANCE ]"
            onPress={() => router.push(`/(app)/events/${id}/scan`)}
            variant="primary"
            style={styles.actionBtn}
          />
        );
      }
      
      return (
        <View style={styles.actionTrayStack}>
          <View style={styles.restrictedTray}>
            <MonoLabel style={styles.restrictedText}>REGISTERED — WAITING FOR SESSION</MonoLabel>
          </View>
          {!isLocked && (
            <Button
              title="[ CANCEL REGISTRATION ]"
              onPress={() => setShowCancelModal(true)}
              variant="secondary"
              disabled={isCancelling}
              style={styles.actionBtn}
            />
          )}
        </View>
      );
    }

    if (status === 'WAITLISTED') {
      return (
        <View style={styles.actionTrayStack}>
          <View style={[styles.restrictedTray, { borderColor: '#d4a200' }]}>
            <MonoLabel style={[styles.restrictedText, { color: '#d4a200' }]}>
              WAITLISTED — POSITION: {registration?.waitlist_position ?? 'QUEUED'}
            </MonoLabel>
          </View>
          {!isLocked && (
            <Button
              title="[ LEAVE WAITLIST ]"
              onPress={() => setShowCancelModal(true)}
              variant="secondary"
              disabled={isCancelling}
              style={styles.actionBtn}
            />
          )}
        </View>
      );
    }

    if (isEventEnded && !activeSession) {
      return (
        <View style={styles.restrictedTray}>
          <MonoLabel style={styles.restrictedText}>EVENT ENDED</MonoLabel>
        </View>
      );
    }

    // Individual Event Registration (NOT_REGISTERED or CANCELLED)
    return (
      <Button
        title={isFull ? "[ JOIN EVENT WAITLIST ]" : "[ REGISTER FOR EVENT ]"}
        onPress={() => {
          if (eventFormFields && eventFormFields.length > 0) {
            router.push(`/(app)/events/${id}/register`);
          } else {
            setShowRegisterModal(true);
          }
        }}
        variant="primary"
        disabled={isRegistering}
        style={styles.actionBtn}
      />
    );
  };

  const getStatusDisplay = () => {
    if (isSessionActive || isLive) return 'LIVE NOW';
    if (isEventEnded) return 'ENDED';
    return event?.state || 'UNKNOWN';
  };

  const is404 = (eventError as any)?.status === 404;

  return (
    <MobileShell 
      title="EVENT" 
      showBackButton
      onBackPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(app)');
        }
      }}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel>LOADING EVENT DETAILS...</MonoLabel>
        </View>
      ) : (isEventError || !event) ? (
        is404 || (!isEventLoading && !event && !isEventError) ? (
          <View style={styles.errorContainer}>
            <StatusBadge status="[NOT FOUND]" type="error" />
            <Display style={styles.errorTitle}>EVENT NOT FOUND</Display>
            <Body style={styles.errorSub}>
              This event does not exist, has been removed, or is not available for your program.
            </Body>
            <Button
              title="[ RETURN ]"
              variant="secondary"
              onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')}
            />
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <StatusBadge status="[FETCH ERROR]" type="error" />
            <Display style={styles.errorTitle}>FAILED TO LOAD</Display>
            <Body style={styles.errorSub}>
              {(eventError as any)?.message || 'Unable to connect to event service.'}
            </Body>
            <Button
              title="[ RETRY FETCH ]"
              variant="secondary"
              onPress={() => refetchEvent()}
            />
          </View>
        )
      ) : (
        <>
          <View style={styles.heroSection}>
            {bannerUrl && (
              <Image source={{ uri: bannerUrl }} style={styles.heroBanner} resizeMode="cover" />
            )}
            <View style={styles.statusRow}>
              <StatusBadge 
                status={getStatusDisplay()} 
                type={isSessionActive || isLive ? 'error' : isEventEnded ? 'default' : 'info'} 
              />
            </View>
            <Title style={styles.title}>{event?.title?.toUpperCase() || 'UNTITLED EVENT'}</Title>
            <Body style={styles.location}>{event?.locationName?.toUpperCase() || 'CAMPUS VENUE'}</Body>
          </View>

          <View style={styles.gridSection}>
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <MonoLabel style={styles.metaLabel}>DATE</MonoLabel>
                <Mono>
                  {event?.startTime ? new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                </Mono>
              </View>
              <View style={[styles.gridCol, styles.gridColRight]}>
                <MonoLabel style={styles.metaLabel}>TIME</MonoLabel>
                <Mono>
                  {event?.startTime ? new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBA'}
                </Mono>
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <MonoLabel style={styles.metaLabel}>REGISTRATION</MonoLabel>
                <Mono style={registration?.status === 'REGISTERED' ? styles.successColor : {}}>
                  {registration?.status || 'NOT_REGISTERED'}
                </Mono>
              </View>
              <View style={[styles.gridCol, styles.gridColRight]}>
                <MonoLabel style={styles.metaLabel}>CAPACITY</MonoLabel>
                <Mono>
                  {event?.registrationCount || 0} / {event?.maxCapacity || '∞'}
                </Mono>
              </View>
            </View>
            <View style={styles.gridRowLast}>
              <View style={styles.gridCol}>
                <MonoLabel style={styles.metaLabel}>REGS OPEN</MonoLabel>
                <Mono>
                  {registrationOpensAt
                    ? new Date(registrationOpensAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'TBA'}
                </Mono>
              </View>
              <View style={[styles.gridCol, styles.gridColRight]}>
                <MonoLabel style={styles.metaLabel}>REGS CLOSE</MonoLabel>
                <Mono>
                  {registrationClosesAt
                    ? new Date(registrationClosesAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'NO DEADLINE'}
                </Mono>
              </View>
            </View>
          </View>

          <View style={styles.actionSection}>
            {renderActionTray()}
          </View>

          {isRegistered && (
            <View style={styles.infoBlock} testID="event-forms-section">
              <MonoLabel style={styles.metaLabel}>EVENT FORMS</MonoLabel>
              {isFormsLoading ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : standaloneForms && standaloneForms.length > 0 ? (
                <View style={{ gap: 12, marginTop: 8 }}>
                  {standaloneForms.map((f: any) => {
                    const formClosed = f.closeAt && new Date(f.closeAt) < new Date();
                    return (
                      <View
                        key={f.id}
                        style={{
                          backgroundColor: theme.colors.surfaceContainerLow,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: theme.colors.outlineVariant,
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        testID={`event-form-item-${f.id}`}
                      >
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <MonoLabel style={{ color: theme.colors.primary, fontSize: 10 }}>[{f.purpose}]</MonoLabel>
                            {formClosed && (
                              <MonoLabel style={{ color: '#FF5252', fontSize: 10 }}>[CLOSED]</MonoLabel>
                            )}
                          </View>
                          <Body style={{ color: theme.colors.onSurface, fontWeight: 'bold' }} numberOfLines={1}>
                            {f.title}
                          </Body>
                        </View>
                        <Button
                          title={formClosed ? '[ VIEW ]' : '[ OPEN FORM ]'}
                          variant="secondary"
                          style={{ minHeight: 36, height: 36, paddingHorizontal: 12 }}
                          onPress={() => router.push(`/(app)/events/${id}/forms/${f.id}`)}
                          testID={`open-form-btn-${f.id}`}
                        />
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Body style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  No additional forms released for this event.
                </Body>
              )}
            </View>
          )}

          {(event?.registrationType === 'TEAM' || (event as any)?.registration_type === 'TEAM') && (
            <View style={styles.infoBlock}>
              <MonoLabel style={styles.metaLabel}>TEAM REQUIREMENTS</MonoLabel>
              <Body>
                This is a team-based event. Form or join a squad to participate.
                {(event?.metadata?.minimum_team_size || (event?.metadata as any)?.minimumTeamSize) ? ` Minimum: ${event?.metadata?.minimum_team_size || (event?.metadata as any)?.minimumTeamSize}` : ''}
                {(event?.metadata?.maximum_team_size || (event?.metadata as any)?.maximumTeamSize) ? ` • Maximum: ${event?.metadata?.maximum_team_size || (event?.metadata as any)?.maximumTeamSize}` : ''}
              </Body>
            </View>
          )}

          <View style={styles.descriptionBlock}>
            <MonoLabel style={styles.metaLabel}>ABOUT EVENT</MonoLabel>
            <Body>
              {event?.description || 'No additional details provided.'}
            </Body>
          </View>
        </>
      )}

      {/* Registration Confirmation Modal */}
      <Modal
        visible={showRegisterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRegisterModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <StatusBadge 
              status={isFull ? '[WAITLIST QUEUE]' : '[CONFIRM REGISTRATION]'} 
              type={isFull ? 'warning' : 'info'} 
            />
            <Title style={{ fontSize: 20 }}>
              {isFull ? 'JOIN WAITING LIST' : 'CONFIRM REGISTRATION'}
            </Title>
            
            <View style={styles.modalMetaBox}>
              <View style={styles.modalMetaRow}>
                <MonoLabel>EVENT</MonoLabel>
                <Mono numberOfLines={1} style={{ maxWidth: '65%' }}>{event?.title || 'CAMPUS EVENT'}</Mono>
              </View>
              <View style={styles.modalMetaRow}>
                <MonoLabel>DATE</MonoLabel>
                <Mono>{event?.startTime ? new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'TBA'}</Mono>
              </View>
              <View style={styles.modalMetaRow}>
                <MonoLabel>VENUE</MonoLabel>
                <Mono numberOfLines={1} style={{ maxWidth: '65%' }}>{event?.locationName || 'CAMPUS VENUE'}</Mono>
              </View>
              <View style={styles.modalMetaRow}>
                <MonoLabel>CAPACITY</MonoLabel>
                <Mono>{event?.registrationCount || 0} / {event?.maxCapacity || '∞'}</Mono>
              </View>
            </View>

            <View style={isFull ? styles.modalWarningBox : styles.modalNoticeBox}>
              <Body style={isFull ? styles.modalWarningText : styles.modalNoticeText}>
                {isFull 
                  ? 'This event is at full capacity. Confirming will add you to the official waitlist. You will be automatically enrolled if an attendee cancels.'
                  : 'Confirming your entry pass reserves an individual attendance slot. Please verify your schedule before registering.'}
              </Body>
            </View>

            <View style={{ gap: 8, marginTop: 8 }}>
              <Button
                title={isRegistering ? "[ RESERVING PASS... ]" : isFull ? "[ CONFIRM WAITLIST ENTRY ]" : "[ CONFIRM & SECURE PASS ]"}
                variant="primary"
                onPress={handleConfirmRegister}
                disabled={isRegistering}
              />
              <Button
                title="[ RETURN / CANCEL ]"
                variant="secondary"
                onPress={() => setShowRegisterModal(false)}
                disabled={isRegistering}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancellation Confirmation Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={isWaitlistCancel ? styles.modalCard : styles.modalCardError}>
            <StatusBadge 
              status={isWaitlistCancel ? "[LEAVE WAITLIST]" : "[CONFIRM CANCELLATION]"} 
              type={isWaitlistCancel ? "warning" : "error"} 
            />
            <Title style={{ fontSize: 20 }}>
              {isWaitlistCancel ? "LEAVE WAITLIST QUEUE" : "CANCEL ENTRY PASS"}
            </Title>
            
            <View style={isWaitlistCancel ? styles.modalNoticeBox : styles.modalWarningBox}>
              <Body style={isWaitlistCancel ? styles.modalNoticeText : styles.modalWarningText}>
                {isWaitlistCancel
                  ? "Are you sure you want to leave the waitlist queue? You will give up your current position in line."
                  : "Are you sure you want to cancel your event registration? If the event reaches capacity, your spot cannot be restored."}
              </Body>
            </View>

            <View style={{ gap: 8, marginTop: 8 }}>
              <Button
                title={
                  isCancelling
                    ? isWaitlistCancel ? "[ LEAVING WAITLIST... ]" : "[ CANCELLING PASS... ]"
                    : isWaitlistCancel ? "[ YES, LEAVE WAITLIST ]" : "[ YES, CANCEL REGISTRATION ]"
                }
                variant="primary"
                onPress={handleConfirmCancel}
                disabled={isCancelling}
              />
              <Button
                title={isWaitlistCancel ? "[ KEEP WAITLIST POSITION ]" : "[ KEEP REGISTRATION ]"}
                variant="secondary"
                onPress={() => setShowCancelModal(false)}
                disabled={isCancelling}
              />
            </View>
          </View>
        </View>
      </Modal>
    </MobileShell>
  );
}
