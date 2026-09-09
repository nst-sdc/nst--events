import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { ActivityIndicator } from '../../../src/ui/core/ActivityIndicator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { StatusBadge } from '../../../src/ui/core/StatusBadge';
import { Button } from '../../../src/ui/Button';
import { DisputeStatusBadge } from '../../../src/ui/DisputeStatusBadge';
import { DisputeStatus, useDisputeDetail } from '../../../src/hooks/use-disputes';
import { useEvent } from '../../../src/hooks/use-events';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';

export default function DisputeDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const params = useLocalSearchParams<{
    id?: string;
    sessionId?: string;
    eventId?: string;
    reason?: string;
    status?: string;
    submittedAt?: string;
    reviewedAt?: string;
    reviewNotes?: string;
    eventTitle?: string;
  }>();

  const targetId = params.id || '';
  const { dispute, isLoading, isError, error, refetch } = useDisputeDetail(targetId);
  const { data: eventData } = useEvent(dispute?.eventId || params.eventId || '');

  const disputeId = dispute?.id || params.id || '';
  const status = (dispute?.status || params.status || 'PENDING') as DisputeStatus;
  const eventTitle = dispute?.session?.event?.title || dispute?.session?.title || eventData?.title || params.eventTitle || 'ATTENDANCE SESSION';
  const sessionId = dispute?.sessionId || params.sessionId || '';
  const reason = dispute?.reason || params.reason || '';
  const reviewNotes = dispute?.reviewNotes || params.reviewNotes || '';

  const submittedAtRaw = dispute?.submittedAt || dispute?.createdAt || params.submittedAt;
  const reviewedAtRaw = dispute?.reviewedAt || params.reviewedAt;

  const submittedFormatted = submittedAtRaw
    ? new Date(submittedAtRaw).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'N/A';

  const reviewedFormatted = reviewedAtRaw
    ? new Date(reviewedAtRaw).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const styles = useMemo(() => StyleSheet.create({
    mainContainer: {
      flex: 1,
      padding: theme.spacing.base,
      justifyContent: 'space-between',
    },
    scrollContent: {
      flex: 1,
      gap: 16,
    },
    statusCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 16,
    },
    statusCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    claimIdText: {
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 0.5,
    },
    eventTitle: {
      fontSize: 16,
      color: theme.colors.onSurface,
      marginBottom: 6,
    },
    sessionIdText: {
      color: theme.colors.onSurfaceVariant,
    },
    sectionCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      padding: 14,
      gap: 8,
    },
    sectionLabel: {
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 0.8,
    },
    reasonText: {
      color: theme.colors.onSurface,
      fontStyle: 'italic',
      lineHeight: 18,
    },
    timeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
      paddingTop: 6,
      marginTop: 4,
    },
    timeLabel: {
      color: theme.colors.onSurfaceVariant,
    },
    timeValue: {
      color: theme.colors.onSurface,
    },
    pendingBox: {
      gap: 8,
    },
    pendingText: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 17,
    },
    resolvedBox: {
      gap: 8,
    },
    resolvedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reviewedTime: {
      color: theme.colors.onSurfaceVariant,
    },
    notesLabel: {
      color: theme.colors.onSurface,
      marginTop: 4,
    },
    notesText: {
      color: theme.colors.onSurface,
      lineHeight: 17,
    },
    approvedBanner: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.primaryFixed,
      borderWidth: 1,
      padding: 8,
      marginTop: 4,
    },
    approvedBannerText: {
      color: theme.colors.primaryFixed,
      textAlign: 'center',
    },
    actionContainer: {
      paddingTop: 16,
      gap: 8,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    },
    errorTitle: {
      fontSize: 18,
      textAlign: 'center',
      color: theme.colors.onSurface,
    },
    errorSub: {
      textAlign: 'center',
      lineHeight: 18,
      color: theme.colors.onSurfaceVariant,
    },
  }), [theme]);

  return (
    <MobileShell 
      title="CLAIM DETAIL" 
      showBackButton
      onBackPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(app)/disputes');
        }
      }}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel>FETCHING CLAIM DETAILS...</MonoLabel>
        </View>
      ) : isError ? (
        <View style={styles.errorContainer}>
          <StatusBadge status="[FETCH ERROR]" type="error" />
          <Display style={styles.errorTitle}>FAILED TO LOAD CLAIM</Display>
          <Body style={styles.errorSub}>{error?.message || 'Unable to load dispute details.'}</Body>
          <Button title="RETRY FETCH" variant="secondary" onPress={() => refetch()} style={{ marginTop: 8 }} />
        </View>
      ) : !dispute && targetId ? (
        <View style={styles.errorContainer}>
          <StatusBadge status="[NOT FOUND]" type="error" />
          <Display style={styles.errorTitle}>DISPUTE NOT FOUND</Display>
          <Body style={styles.errorSub}>The requested dispute claim could not be found or you do not have permission to view it.</Body>
          <Button
            title="RETURN TO MY DISPUTES"
            variant="secondary"
            onPress={() => router.push('/(app)/disputes')}
            style={{ marginTop: 8 }}
          />
        </View>
      ) : (
        /* Main Single Viewport Container */
        <View style={styles.mainContainer}>
          <View style={styles.scrollContent}>
            {/* Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusCardHeader}>
                <MonoLabel style={styles.claimIdText}>
                  CLAIM #{disputeId ? disputeId.slice(0, 8).toUpperCase() : 'PENDING'}
                </MonoLabel>
                <DisputeStatusBadge status={status} />
              </View>
              <Title style={styles.eventTitle}>{eventTitle}</Title>
              <Mono style={styles.sessionIdText}>SESSION: {sessionId || 'UNSPECIFIED'}</Mono>
            </View>

            {/* Reason Section */}
            <View style={styles.sectionCard}>
              <MonoLabel style={styles.sectionLabel}>SUBMITTED REASON</MonoLabel>
              <Body style={styles.reasonText}>{reason ? `"${reason}"` : 'No reason details recorded.'}</Body>
              <View style={styles.timeRow}>
                <MonoLabel style={styles.timeLabel}>FILED ON:</MonoLabel>
                <Mono style={styles.timeValue}>{submittedFormatted}</Mono>
              </View>
            </View>

          {/* Resolution Section */}
          <View style={styles.sectionCard}>
            <MonoLabel style={styles.sectionLabel}>INSTRUCTOR RESOLUTION</MonoLabel>

            {status === 'PENDING' ? (
              <View style={styles.pendingBox}>
                <StatusBadge status="[REVIEW IN PROGRESS]" type="warning" />
                <Body style={styles.pendingText}>
                  Your claim is currently queued for review. Course instructors or faculty mentors will evaluate the claim details and update your attendance status.
                </Body>
              </View>
            ) : (
              <View style={styles.resolvedBox}>
                <View style={styles.resolvedHeader}>
                  <DisputeStatusBadge status={status} />
                  {reviewedFormatted && (
                    <Mono style={styles.reviewedTime}>RESOLVED: {reviewedFormatted}</Mono>
                  )}
                </View>

                <MonoLabel style={styles.notesLabel}>REVIEWER NOTES:</MonoLabel>
                <Body style={styles.notesText}>
                  {reviewNotes ? `"${reviewNotes}"` : 'No reviewer notes were attached.'}
                </Body>

                {status === 'APPROVED' && (
                  <View style={styles.approvedBanner}>
                    <MonoLabel style={styles.approvedBannerText}>
                      STATUS EXCUSED RECORDED IN OFFICIAL LOGS (0 PTS AWARDED BY DESIGN)
                    </MonoLabel>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.actionContainer}>
          <Button
            title="RETURN TO MY DISPUTES"
            variant="secondary"
            onPress={() => router.push('/(app)/disputes')}
          />
        </View>
      </View>
      )}
    </MobileShell>
  );
}
