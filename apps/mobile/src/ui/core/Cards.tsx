import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, Image, Text, Platform } from 'react-native';
import { useAppTheme } from '../../store/theme-store';

interface EventCardProps {
  title: string;
  location: string;
  date: string;
  time: string;
  statusText?: string;
  statusColor?: string;
  onPress: () => void;
  style?: ViewStyle;
  bannerUrl?: string;
  registrationCount?: number;
  maxCapacity?: number | null;
}

export function EventCard({
  title,
  location,
  date,
  time,
  statusText,
  statusColor,
  onPress,
  style,
  bannerUrl,
  registrationCount,
  maxCapacity,
}: EventCardProps) {
  const theme = useAppTheme();

  const isAlmostFull =
    typeof registrationCount === 'number' &&
    typeof maxCapacity === 'number' &&
    maxCapacity > 0 &&
    (registrationCount / maxCapacity) >= 0.8;

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      borderRadius: theme.radii.lg,
      ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
      overflow: 'hidden',
      marginBottom: theme.spacing.base,
    },
    bannerContainer: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: theme.colors.surfaceSubtle,
      position: 'relative',
    },
    banner: {
      width: '100%',
      height: '100%',
    },
    bannerScrim: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '40%',
      backgroundColor: theme.colors.scrimBottom,
      opacity: 0.6,
    },
    content: {
      padding: theme.spacing.base,
      gap: theme.spacing.xs,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    title: {
      flex: 1,
      fontFamily: theme.typography.interSemiBold,
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.2,
      color: theme.colors.textPrimary,
    },
    almostFullBadge: {
      backgroundColor: theme.colors.badgeTintAmber,
      borderRadius: theme.radii.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
      alignSelf: 'flex-start',
    },
    almostFullText: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.badgeTextAmber,
    },
    location: {
      fontFamily: theme.typography.interRegular,
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    metaFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSubtle,
    },
    dateTime: {
      fontFamily: theme.typography.interRegular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textMuted,
    },
    statusBadge: {
      borderRadius: theme.radii.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    statusLabel: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 12,
      lineHeight: 16,
      color: statusColor || theme.colors.brandText,
    },
    capacityContainer: {
      marginTop: 6,
      gap: 4,
    },
    capacityBarBg: {
      height: 4,
      backgroundColor: theme.colors.surfaceSubtle,
      borderRadius: theme.radii.full,
      overflow: 'hidden',
    },
    capacityBarFill: {
      height: '100%',
      backgroundColor: isAlmostFull ? theme.colors.solidAmber : theme.colors.brandPrimary,
      borderRadius: theme.radii.full,
    },
    capacityText: {
      fontFamily: theme.typography.interRegular,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textMuted,
    },
  }), [theme, statusColor, isAlmostFull]);

  const capacityRatio =
    typeof registrationCount === 'number' && typeof maxCapacity === 'number' && maxCapacity > 0
      ? Math.min(registrationCount / maxCapacity, 1)
      : 0;

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.85}>
      {bannerUrl && (
        <View style={styles.bannerContainer}>
          <Image source={{ uri: bannerUrl }} style={styles.banner} resizeMode="cover" />
          <View style={styles.bannerScrim} />
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {isAlmostFull && (
            <View style={styles.almostFullBadge}>
              <Text style={styles.almostFullText}>Almost full</Text>
            </View>
          )}
        </View>
        <Text style={styles.location} numberOfLines={1}>{location}</Text>

        {typeof registrationCount === 'number' && (
          <View style={styles.capacityContainer}>
            {typeof maxCapacity === 'number' && maxCapacity > 0 ? (
              <>
                <View style={styles.capacityBarBg}>
                  <View style={[styles.capacityBarFill, { width: `${capacityRatio * 100}%` }]} />
                </View>
                <Text style={styles.capacityText}>
                  {registrationCount} / {maxCapacity} registered
                </Text>
              </>
            ) : (
              <Text style={styles.capacityText}>
                {registrationCount} registered
              </Text>
            )}
          </View>
        )}

        <View style={styles.metaFooterRow}>
          <Text style={styles.dateTime}>{date} · {time}</Text>
          {statusText && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusLabel}>{statusText}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface ActiveAttendanceCardProps {
  title: string;
  location: string;
  date: string;
  time: string;
  status: 'SCAN_QR' | 'ATTENDANCE_MARKED';
  onPressAction: () => void;
  onPressCard: () => void;
  bannerUrl?: string;
  countdownText?: string;
}

export function ActiveAttendanceCard({
  title,
  location,
  date,
  time,
  status,
  onPressAction,
  onPressCard,
  bannerUrl,
  countdownText,
}: ActiveAttendanceCardProps) {
  const theme = useAppTheme();
  const isMarked = status === 'ATTENDANCE_MARKED';

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: isMarked ? theme.colors.badgeTextEmerald : theme.colors.brandPrimary,
      borderRadius: theme.radii.xl,
      ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
      padding: theme.spacing.base,
      marginBottom: theme.spacing.xl,
      gap: theme.spacing.sm,
      shadowColor: theme.colors.brandGlow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    topHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    liveBeaconContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isMarked ? theme.colors.badgeTintEmerald : theme.colors.badgeTintRed,
      borderRadius: theme.radii.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    beaconDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radii.full,
      backgroundColor: isMarked ? theme.colors.solidEmerald : theme.colors.solidRed,
    },
    liveBadgeText: {
      fontFamily: theme.typography.interBold,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: isMarked ? theme.colors.badgeTextEmerald : theme.colors.badgeTextRed,
    },
    countdownText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 13,
      lineHeight: 18,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textPrimary,
    },
    title: {
      fontFamily: theme.typography.interBold,
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.2,
      color: theme.colors.textPrimary,
      marginTop: 2,
    },
    location: {
      fontFamily: theme.typography.interRegular,
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dateTime: {
      fontFamily: theme.typography.interRegular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textMuted,
    },
    actionBtn: {
      backgroundColor: isMarked ? theme.colors.surfaceSubtle : theme.colors.brandPrimary,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: theme.radii.md,
      borderWidth: isMarked ? 1 : 0,
      borderColor: theme.colors.borderSubtle,
      marginTop: theme.spacing.xs,
    },
    actionText: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 15,
      lineHeight: 20,
      color: isMarked ? theme.colors.badgeTextEmerald : theme.colors.onSolidText,
    },
  }), [theme, isMarked]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPressCard} activeOpacity={0.85}>
      <View style={styles.topHeaderRow}>
        <View style={styles.liveBeaconContainer}>
          <View style={styles.beaconDot} />
          <Text style={styles.liveBadgeText}>
            {isMarked ? 'CHECKED IN' : 'LIVE RADAR'}
          </Text>
        </View>
        {countdownText && !isMarked && (
          <Text style={styles.countdownText}>{countdownText}</Text>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.location} numberOfLines={1}>{location}</Text>
      <Text style={styles.dateTime}>{date} · {time}</Text>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={isMarked ? onPressCard : onPressAction}
        activeOpacity={0.8}
      >
        <Text style={styles.actionText}>
          {isMarked ? 'View check-in receipt' : 'Scan to mark attendance'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export interface MatrixCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function MatrixCard({ children, style }: MatrixCardProps) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.base,
          ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface LedgerRowProps {
  label: string;
  value: React.ReactNode;
  isLast?: boolean;
  valueColor?: string;
  style?: ViewStyle;
}

export function LedgerRow({ label, value, isLast = false, valueColor, style }: LedgerRowProps) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        {
          paddingVertical: 10,
          paddingHorizontal: theme.spacing.sm,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: theme.colors.borderSubtle,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: theme.typography.interRegular, fontSize: 13, lineHeight: 18, color: theme.colors.textSecondary }}>
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text style={{ fontFamily: theme.typography.monoMedium, fontSize: 13, lineHeight: 18, color: valueColor || theme.colors.brandText }}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}
