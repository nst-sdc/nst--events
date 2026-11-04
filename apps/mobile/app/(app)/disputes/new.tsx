import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { StatusBadge } from '../../../src/ui/core/StatusBadge';
import { Button } from '../../../src/ui/Button';
import { useSubmitDispute } from '../../../src/hooks/use-disputes';
import { useAttendanceHistory } from '../../../src/hooks/use-attendance-history';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';
import { ActivityIndicator } from '../../../src/ui/core/ActivityIndicator';

export default function SubmitDisputeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const params = useLocalSearchParams<{
    sessionId?: string;
    eventId?: string;
    title?: string;
  }>();

  const [selectedSessionId, setSelectedSessionId] = useState<string>(params.sessionId || '');
  const [selectedTitle, setSelectedTitle] = useState<string>(params.title || '');

  const sessionId = selectedSessionId;
  const eventTitle = selectedTitle || params.title || 'EVENT ATTENDANCE';

  // If no session ID was provided via params, check attendance records for eligible absent sessions
  const { data: attendanceData, isLoading: isLoadingAttendance } = useAttendanceHistory(undefined, {
    enabled: !selectedSessionId,
  });

  const allRecords = attendanceData?.pages.flatMap((page) => page.data) || [];

  // Eligible absent sessions: where attendance wasn't marked or is ABSENT, and within 24h
  const eligibleRecords = useMemo(() => {
    const now = Date.now();
    return allRecords.filter((r) => {
      if (r.status === 'PRESENT' || r.status === 'EXCUSED') return false;
      const endTime = r.session?.endTime || r.session?.closeAt;
      if (!endTime) return true;
      const expireTime = new Date(endTime).getTime() + 24 * 60 * 60 * 1000;
      return now <= expireTime;
    });
  }, [allRecords]);

  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { mutate: submitDispute, isPending } = useSubmitDispute();

  const isValid = sessionId.length > 0 && reason.trim().length >= 10;

  const handleSubmit = () => {
    if (!isValid || isPending || !sessionId) return;
    setErrorMessage(null);

    submitDispute(
      {
        session_id: sessionId,
        reason: reason.trim(),
      },
      {
        onSuccess: (data) => {
          router.replace({
            pathname: '/(app)/disputes/submitted',
            params: {
              disputeId: data.id,
              eventTitle,
              sessionId,
            },
          });
        },
        onError: (err: any) => {
          let userMsg = err.message || 'Failed to submit dispute claim.';

          if (userMsg.includes('ATTENDANCE_ALREADY_RECORDED') || userMsg.includes('U0054')) {
            userMsg = 'A dispute or attendance record for this session has already been submitted.';
          } else if (userMsg.includes('DISPUTE_WINDOW_EXPIRED') || userMsg.includes('U0048')) {
            userMsg = 'The 24-hour dispute window for this session has expired.';
          } else if (userMsg.includes('SESSION_CLOSED') || userMsg.includes('U0049')) {
            userMsg = 'This attendance session is closed or no longer accepts claims.';
          } else if (userMsg.includes('NOT_REGISTERED') || userMsg.includes('U0003')) {
            userMsg = 'You are not registered for this event.';
          } else if (userMsg.includes('P2002') || userMsg.includes('23505')) {
            userMsg = 'A dispute for this session has already been submitted.';
          }

          setErrorMessage(userMsg);
        },
      }
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    keyboardAvoid: {
      flex: 1,
    },
    mainContainer: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
      paddingBottom: 24,
      justifyContent: 'space-between',
    },
    contextCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 16,
      marginTop: 16,
    },
    contextCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    contextLabel: {
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 0.5,
    },
    eventTitle: {
      fontSize: 16,
      color: theme.colors.onSurface,
      lineHeight: 20,
    },
    changeSessionBtn: {
      marginTop: 8,
    },
    changeSessionText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontFamily: theme.typography.monoBold,
    },
    formContainer: {
      flex: 1,
      marginTop: 16,
    },
    formLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    inputLabel: {
      color: theme.colors.onSurface,
      letterSpacing: 0.5,
    },
    charCount: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    textArea: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 14,
      fontFamily: theme.typography.interRegular,
      fontSize: 13,
      color: theme.colors.onSurface,
      height: 140,
    },
    validationText: {
      fontSize: 10,
      color: theme.colors.error,
      marginTop: 6,
    },
    errorBox: {
      backgroundColor: theme.colors.errorContainer,
      borderColor: theme.colors.error,
      borderWidth: 1,
      padding: 12,
      marginTop: 12,
      gap: 6,
    },
    errorText: {
      color: theme.colors.onErrorContainer,
    },
    actionContainer: {
      gap: 10,
    },
    disclaimerText: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    emptyGuardBox: {
      padding: 24,
      alignItems: 'center',
      gap: 16,
      marginTop: 40,
    },
    emptyGuardTitle: {
      fontSize: 18,
      textAlign: 'center',
      color: theme.colors.onSurface,
    },
    emptyGuardSub: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 18,
    },
    pickerContainer: {
      padding: theme.spacing.base,
      gap: 12,
      paddingBottom: 40,
    },
    pickerHeader: {
      gap: 8,
      marginBottom: 8,
    },
    pickerTitle: {
      fontSize: 18,
      color: theme.colors.onSurface,
    },
    pickerSub: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
    },
    eligibleCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      padding: 14,
      gap: 8,
    },
    eligibleCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    eligibleCardId: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    eligibleCardTitle: {
      fontSize: 15,
      color: theme.colors.onSurface,
    },
    eligibleCardDate: {
      fontSize: 11,
      color: theme.colors.outline,
    },
    selectBtnText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontFamily: theme.typography.monoBold,
      marginTop: 4,
    },
    loadingBox: {
      paddingVertical: 60,
      alignItems: 'center',
      gap: 12,
    },
  }), [theme]);

  // If no session ID is active, render the session selection or ineligible notice
  if (!sessionId) {
    return (
      <MobileShell
        title="SUBMIT DISPUTE"
        showBackButton
        onBackPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)/activity?tab=attendance');
          }
        }}
        scrollable={false}
      >
        {isLoadingAttendance ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <MonoLabel>FETCHING ATTENDANCE SESSIONS...</MonoLabel>
          </View>
        ) : eligibleRecords.length > 0 ? (
          <ScrollView contentContainerStyle={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <StatusBadge status="[ACTION REQUIRED]" type="warning" />
              <Title style={styles.pickerTitle}>SELECT SESSION TO DISPUTE</Title>
              <Body style={styles.pickerSub}>
                Select an attendance session from the last 24 hours where your check-in was not recorded.
              </Body>
            </View>

            {eligibleRecords.map((item) => (
              <TouchableOpacity
                key={item.id || item.sessionId}
                style={styles.eligibleCard}
                onPress={() => {
                  setSelectedSessionId(item.sessionId);
                  setSelectedTitle(item.session?.event?.title || item.session?.title || 'EVENT ATTENDANCE');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.eligibleCardTop}>
                  <MonoLabel style={styles.eligibleCardId}>
                    SESSION #{item.sessionId.slice(0, 8).toUpperCase()}
                  </MonoLabel>
                  <StatusBadge status={item.status || 'ABSENT'} type="warning" />
                </View>
                <Title style={styles.eligibleCardTitle}>
                  {item.session?.event?.title || item.session?.title || 'EVENT SESSION'}
                </Title>
                {item.session?.startTime && (
                  <Mono style={styles.eligibleCardDate}>
                    {new Date(item.session.startTime).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Mono>
                )}
                <MonoLabel style={styles.selectBtnText}>[ SELECT THIS SESSION → ]</MonoLabel>
              </TouchableOpacity>
            ))}

            <Button
              title="RETURN TO ATTENDANCE HISTORY"
              variant="secondary"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(app)/(tabs)/activity?tab=attendance');
                }
              }}
              style={{ marginTop: 12 }}
            />
          </ScrollView>
        ) : (
          <View style={styles.emptyGuardBox}>
            <StatusBadge status="[TARGET SESSION REQUIRED]" type="warning" />
            <Display style={styles.emptyGuardTitle}>NO ELIGIBLE SESSIONS</Display>
            <Body style={styles.emptyGuardSub}>
              Attendance disputes can only be filed for specific event sessions you were registered for where check-in failed or was marked absent within the last 24 hours.
            </Body>
            <Button
              title="GO TO ATTENDANCE HISTORY"
              variant="secondary"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(app)/(tabs)/activity?tab=attendance');
                }
              }}
              style={{ marginTop: 12, width: '100%' }}
            />
          </View>
        )}
      </MobileShell>
    );
  }

  return (
    <MobileShell 
      title="SUBMIT DISPUTE" 
      showBackButton 
      onBackPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(app)/(tabs)/activity?tab=attendance');
        }
      }}
      scrollable={false}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.mainContainer}>
            {/* Context Card */}
            <View style={styles.contextCard}>
              <View style={styles.contextCardHeader}>
                <MonoLabel style={styles.contextLabel}>TARGET SESSION</MonoLabel>
                <StatusBadge status={`#${sessionId.slice(0, 8).toUpperCase()}`} type="default" />
              </View>
              <Title style={styles.eventTitle}>{eventTitle}</Title>
              {!params.sessionId && (
                <TouchableOpacity onPress={() => setSelectedSessionId('')} style={styles.changeSessionBtn}>
                  <MonoLabel style={styles.changeSessionText}>← SELECT DIFFERENT SESSION</MonoLabel>
                </TouchableOpacity>
              )}
            </View>

            {/* Form Area */}
            <View style={styles.formContainer}>
              <View style={styles.formLabelRow}>
                <MonoLabel style={styles.inputLabel}>REASON FOR DISPUTE</MonoLabel>
                <Mono style={styles.charCount}>{reason.length}/1000 CHARACTERS</Mono>
              </View>

              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={5}
                placeholder="Describe why your attendance failed to record (e.g. Present in room, scan camera timeout, geofence sync error)..."
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={reason}
                onChangeText={(val) => {
                  if (val.length <= 1000) setReason(val);
                }}
                textAlignVertical="top"
              />

              {reason.length > 0 && !isValid && (
                <Mono style={styles.validationText}>Reason must be at least 10 characters long.</Mono>
              )}

              {errorMessage && (
                <View style={styles.errorBox}>
                  <StatusBadge status="[SUBMISSION ERROR]" type="error" />
                  <Body style={styles.errorText}>{errorMessage}</Body>
                </View>
              )}
            </View>

            {/* Submit Action */}
            <View style={styles.actionContainer}>
              <Button
                title={isPending ? 'SUBMITTING CLAIM...' : 'SUBMIT ATTENDANCE DISPUTE'}
                variant="primary"
                onPress={handleSubmit}
                loading={isPending}
                disabled={!isValid || isPending}
              />
              <Mono style={styles.disclaimerText}>
                Disputes are sent directly to course instructors and recorded in audit logs.
              </Mono>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </MobileShell>
  );
}

