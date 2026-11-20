import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, Image, Text, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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

// Procedural visual theme generator for events without a custom banner
const PROCEDURAL_PALETTES = [
  { primary: '#1D4ED8', secondary: '#3B82F6', surface: '#0B152B', accent: '#60A5FA', icon: 'event' as const },
  { primary: '#4338CA', secondary: '#6366F1', surface: '#11102E', accent: '#818CF8', icon: 'terminal' as const },
  { primary: '#047857', secondary: '#10B981', surface: '#062019', accent: '#34D399', icon: 'school' as const },
  { primary: '#B45309', secondary: '#F59E0B', surface: '#281706', accent: '#FBBF24', icon: 'local-fire-department' as const },
  { primary: '#0284C7', secondary: '#38BDF8', surface: '#071F2E', accent: '#7DD3FC', icon: 'groups' as const },
  { primary: '#7C3AED', secondary: '#A855F7', surface: '#1D0D36', accent: '#C084FC', icon: 'stars' as const },
];

function getProceduralPalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PROCEDURAL_PALETTES.length;
  return PROCEDURAL_PALETTES[index];
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

  const palette = useMemo(() => getProceduralPalette(title || 'NST'), [title]);

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      borderTopColor: theme.mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.12)',
      borderRadius: theme.radii.lg,
      ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
      overflow: 'hidden',
      marginBottom: theme.spacing.base,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.mode === 'dark' ? 0.25 : 0.06,
      shadowRadius: 10,
      elevation: 2,
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
      height: '50%',
      backgroundColor: theme.colors.scrimBottom,
      opacity: 0.7,
    },
    // Procedural Geometric Mesh Banner
    proceduralBanner: {
      width: '100%',
      height: 110,
      backgroundColor: palette.surface,
      position: 'relative',
      overflow: 'hidden',
      justifyContent: 'space-between',
      padding: theme.spacing.base,
    },
    meshGlowOne: {
      position: 'absolute',
      top: -30,
      right: -20,
      width: 140,
      height: 140,
      borderRadius: theme.radii.full,
      backgroundColor: palette.primary,
      opacity: 0.35,
    },
    meshGlowTwo: {
      position: 'absolute',
      bottom: -40,
      left: -20,
      width: 120,
      height: 120,
      borderRadius: theme.radii.full,
      backgroundColor: palette.secondary,
      opacity: 0.22,
    },
    meshAccentBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: palette.accent,
      opacity: 0.7,
    },
    proceduralTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 2,
    },
    proceduralIconWell: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.sm,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    proceduralDatePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radii.full,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    proceduralDateText: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 12,
      lineHeight: 16,
      color: '#FFFFFF',
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
      fontFamily: theme.typography.interBold,
      fontSize: 17,
      lineHeight: 23,
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
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    location: {
      fontFamily: theme.typography.interRegular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      flex: 1,
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
    dateTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    dateTime: {
      fontFamily: theme.typography.interMedium,
      fontSize: 12,
      lineHeight: 16,
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
  }), [theme, statusColor, isAlmostFull, palette]);

  const capacityRatio =
    typeof registrationCount === 'number' && typeof maxCapacity === 'number' && maxCapacity > 0
      ? Math.min(registrationCount / maxCapacity, 1)
      : 0;

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.85}>
      {bannerUrl ? (
        <View style={styles.bannerContainer}>
          <Image source={{ uri: bannerUrl }} style={styles.banner} resizeMode="cover" />
          <View style={styles.bannerScrim} />
        </View>
      ) : (
        <View style={styles.proceduralBanner}>
          <View style={styles.meshAccentBar} />
          <View style={styles.meshGlowOne} />
          <View style={styles.meshGlowTwo} />
          <View style={styles.proceduralTopRow}>
            <View style={styles.proceduralIconWell}>
              <MaterialIcons name={palette.icon} size={18} color="#FFFFFF" />
            </View>
            <View style={styles.proceduralDatePill}>
              <MaterialIcons name="schedule" size={12} color={palette.accent} />
              <Text style={styles.proceduralDateText}>{date}</Text>
            </View>
          </View>
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

        <View style={styles.locationRow}>
          <MaterialIcons name="place" size={14} color={theme.colors.textMuted} />
          <Text style={styles.location} numberOfLines={1}>{location}</Text>
        </View>

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
          <View style={styles.dateTimeRow}>
            <MaterialIcons name="access-time" size={13} color={theme.colors.textMuted} />
            <Text style={styles.dateTime}>{date} · {time}</Text>
          </View>
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
      borderWidth: 1.5,
      borderColor: isMarked ? theme.colors.badgeTextEmerald : theme.colors.brandPrimary,
      borderRadius: theme.radii.xl,
      ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
      padding: theme.spacing.base,
      marginBottom: theme.spacing.xl,
      gap: theme.spacing.sm,
      shadowColor: isMarked ? theme.colors.solidEmerald : theme.colors.brandPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 14,
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
      paddingVertical: 4,
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
    countdownContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.surfaceSubtle,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radii.full,
    },
    countdownText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 12,
      lineHeight: 16,
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
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    location: {
      fontFamily: theme.typography.interRegular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dateTime: {
      fontFamily: theme.typography.interRegular,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textMuted,
    },
    actionBtn: {
      backgroundColor: isMarked ? theme.colors.surfaceSubtle : theme.colors.brandPrimary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: theme.radii.md,
      borderWidth: isMarked ? 1 : 0,
      borderColor: theme.colors.borderSubtle,
      marginTop: theme.spacing.xs,
    },
    actionText: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 14,
      lineHeight: 18,
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
          <View style={styles.countdownContainer}>
            <MaterialIcons name="timer" size={13} color={theme.colors.brandText} />
            <Text style={styles.countdownText}>{countdownText}</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>
      <View style={styles.locationRow}>
        <MaterialIcons name="place" size={14} color={theme.colors.textMuted} />
        <Text style={styles.location} numberOfLines={1}>{location}</Text>
      </View>
      <Text style={styles.dateTime}>{date} · {time}</Text>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={isMarked ? onPressCard : onPressAction}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name={isMarked ? 'verified' : 'qr-code-scanner'}
          size={18}
          color={isMarked ? theme.colors.badgeTextEmerald : theme.colors.onSolidText}
        />
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
