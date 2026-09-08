import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { useEvent, useEventSessions } from '../../../src/hooks/use-events';
import { useAttendanceHistory } from '../../../src/hooks/use-attendance-history';
import { useMyDisputes } from '../../../src/hooks/use-disputes';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono } from '../../../src/ui/core/Typography';

export default function AttendanceDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = params.id || '';

  const { data: event, isLoading: loadingEvent } = useEvent(eventId);
  const { data: sessions, isLoading: loadingSessions } = useEventSessions(eventId);
  const { data: attendanceHistory, isLoading: loadingHistory } = useAttendanceHistory(eventId);
  const { data: disputes, isLoading: loadingDisputes } = useMyDisputes(eventId);

  const isLoading = loadingEvent || loadingSessions || loadingHistory || loadingDisputes;

  const eventTitle = event?.title || 'LOADING EVENT...';
  const venue = event?.locationName || 'UNSPECIFIED VENUE';
  const eventDate = event?.startTime 
    ? new Date(event.startTime).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()
    : 'N/A';
  const eventTime = event?.startTime
    ? new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase()
    : 'N/A';

  const allRecords = attendanceHistory?.pages.flatMap((page) => page.data) || [];
  const allDisputes = disputes?.pages.flatMap((page) => page.data) || [];

  const styles = useMemo(() => StyleSheet.create({
    loadingContainer: {
      marginTop: 40,
      alignItems: 'center',
    },
    eventHeader: {
      marginBottom: 32,
    },
    eventTitle: {
      fontSize: 20,
      marginBottom: 12,
    },
    eventDetailText: {
      fontSize: 13,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    attendanceSection: {
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 12,
      color: theme.colors.onSurface,
      letterSpacing: 1,
      marginBottom: 8,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.borderHairline,
      marginBottom: 16,
    },
    sessionCard: {
      marginBottom: 20,
    },
    sessionTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    checkIcon: {
      fontSize: 14,
      color: theme.colors.primary,
      marginRight: 8,
    },
    sessionTitle: {
      fontSize: 14,
      color: theme.colors.onSurface,
      textTransform: 'uppercase',
      flex: 1,
    },
    sessionDateTime: {
      fontSize: 11,
      color: theme.colors.outline,
      marginLeft: 26,
      marginBottom: 6,
    },
    statusPresent: {
      fontSize: 12,
      color: theme.colors.primary,
      marginLeft: 26,
    },
    statusNotMarked: {
      fontSize: 12,
      color: theme.colors.outline,
      marginLeft: 26,
      marginBottom: 6,
    },
    disputeActionBox: {
      marginLeft: 26,
      marginTop: 2,
    },
    disputeActionText: {
      fontSize: 11,
      color: theme.colors.primary,
    },
  }), [theme]);

  return (
    <MobileShell title="ATTENDANCE" showBackButton scrollable={true}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <>
          {/* Event Context Header */}
          <View style={styles.eventHeader}>
            <Title style={styles.eventTitle}>{eventTitle}</Title>
            <Body style={styles.eventDetailText}>{venue}</Body>
            <Body style={styles.eventDetailText}>{eventDate}</Body>
            <Body style={styles.eventDetailText}>{eventTime}</Body>
          </View>

          {/* Attendance Sessions List */}
          <View style={styles.attendanceSection}>
            <MonoLabel style={styles.sectionTitle}>ATTENDANCE</MonoLabel>
            <View style={styles.divider} />
            
            {sessions?.map((session) => {
              const record = allRecords.find((r) => r.sessionId === session.id);
              const dispute = allDisputes.find((d) => d.sessionId === session.id);
              const isPresentOrExcused = record && (record.status === 'PRESENT' || record.status === 'EXCUSED');

              const sessionDate = new Date(session.startTime).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
              const sessionTime = new Date(session.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase();
              
              return (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionTopRow}>
                    <MonoLabel style={styles.checkIcon}>{isPresentOrExcused ? '[✓]' : '[ ]'}</MonoLabel>
                    <Body style={styles.sessionTitle} numberOfLines={1}>{session.title}</Body>
                  </View>
                  <Mono style={styles.sessionDateTime}>{sessionDate} / {sessionTime}</Mono>
                  
                  {isPresentOrExcused ? (
                    <MonoLabel style={styles.statusPresent}>{record.status}</MonoLabel>
                  ) : (
                    <>
                      <MonoLabel style={styles.statusNotMarked}>{record ? record.status : 'NOT MARKED'}</MonoLabel>
                      
                      {dispute ? (
                        <TouchableOpacity 
                          style={styles.disputeActionBox}
                          onPress={() => router.push(`/disputes/submitted?disputeId=${dispute.id}&eventTitle=${encodeURIComponent(eventTitle)}&sessionId=${session.id}`)}
                        >
                          <MonoLabel style={styles.disputeActionText}>DISPUTE {dispute.status}</MonoLabel>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          style={styles.disputeActionBox}
                          onPress={() => router.push({
                            pathname: '/disputes/new',
                            params: {
                              sessionId: session.id,
                              eventId: session.eventId,
                              title: eventTitle,
                            }
                          })}
                        >
                          <MonoLabel style={styles.disputeActionText}>[ FILE DISPUTE ]</MonoLabel>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}
    </MobileShell>
  );
}
