import React, { useMemo } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, Text, Platform } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { Button } from './Button';

interface AttendanceSuccessViewProps {
  locationName: string;
  timeLogged: string;
  onReturnHome: () => void;
  flagged?: boolean;
}

export const AttendanceSuccessView: React.FC<AttendanceSuccessViewProps> = ({
  locationName,
  timeLogged,
  onReturnHome,
  flagged = false,
}) => {
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.canvas,
    },
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      justifyContent: 'space-between',
    },
    header: {
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
    },
    authVer: {
      fontFamily: theme.typography.interBold,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
    },
    contentCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      borderRadius: theme.radii.lg,
      ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
      padding: theme.spacing.xl,
      marginVertical: 'auto',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    successIconBadge: {
      width: 56,
      height: 56,
      borderRadius: theme.radii.full,
      backgroundColor: theme.colors.badgeTintEmerald,
      borderWidth: 1,
      borderColor: theme.colors.badgeTextEmerald,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    successIconText: {
      fontSize: 24,
      color: theme.colors.badgeTextEmerald,
    },
    title: {
      fontFamily: theme.typography.interBold,
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.4,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: theme.typography.interRegular,
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    detailsBox: {
      width: '100%',
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 2,
    },
    detailLabel: {
      fontFamily: theme.typography.interMedium,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textMuted,
    },
    detailValue: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textPrimary,
    },
    collisionNotice: {
      width: '100%',
      backgroundColor: theme.colors.badgeTintAmber,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.badgeTextAmber,
      padding: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    collisionText: {
      fontFamily: theme.typography.interRegular,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.badgeTextAmber,
      textAlign: 'center',
    },
    actionTray: {
      gap: theme.spacing.sm,
    },
    homeBtn: {
      height: 52,
    },
  }), [theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.canvas} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.authVer}>NST Events</Text>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.successIconBadge}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.title}>Attendance confirmed</Text>
          <Text style={styles.subtitle}>
            Your attendance has been recorded on the verified institutional ledger.
          </Text>

          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Time logged</Text>
              <Text style={styles.detailValue}>{timeLogged}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Venue</Text>
              <Text style={styles.detailValue}>{locationName}</Text>
            </View>
          </View>

          {flagged && (
            <View style={styles.collisionNotice}>
              <Text style={styles.collisionText}>
                Device conflict noted for institutional audit.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionTray}>
          <Button
            title="Return to home"
            onPress={onReturnHome}
            variant="primary"
            style={styles.homeBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AttendanceSuccessView;
