import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, Image } from 'react-native';
import { MonoLabel, Title, Body, Mono } from './Typography';
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
}: EventCardProps) {
  const theme = useAppTheme();
  
  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    title: {
      flex: 1,
    },
    statusLabel: {
      color: statusColor || theme.colors.primary,
    },
    locationRow: {
      width: '100%',
    },
    location: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      lineHeight: 18,
    },
    metaFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },
    dateTime: {
      fontSize: 11,
      color: theme.colors.onSurface,
    },
    banner: {
      width: '100%',
      height: 120,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surfaceContainerHighest,
    },
  }), [theme, statusColor]);

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.7}>
      {bannerUrl && (
        <Image source={{ uri: bannerUrl }} style={styles.banner} resizeMode="cover" />
      )}
      <View style={styles.header}>
        <Title style={styles.title}>{title}</Title>
      </View>
      <View style={styles.locationRow}>
        <Body style={styles.location} numberOfLines={2}>{location}</Body>
      </View>
      <View style={styles.metaFooterRow}>
        <Mono style={styles.dateTime}>{date} · {time}</Mono>
        {statusText && <MonoLabel style={styles.statusLabel}>[{statusText}]</MonoLabel>}
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
}: ActiveAttendanceCardProps) {
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    title: {
      flex: 1,
    },
    liveBadge: {
      color: theme.colors.error,
      flexShrink: 0,
      marginTop: 2,
    },
    actionBtn: {
      backgroundColor: status === 'ATTENDANCE_MARKED' ? theme.colors.surfaceContainerLowest : theme.colors.primary,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      borderWidth: status === 'ATTENDANCE_MARKED' ? 1 : 0,
      borderColor: theme.colors.outlineVariant,
    },
    actionText: {
      color: status === 'ATTENDANCE_MARKED' ? theme.colors.primary : theme.colors.onPrimary,
    },
    locationRow: {
      width: '100%',
    },
    location: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      lineHeight: 18,
    },
    metaFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dateTime: {
      fontSize: 11,
      color: theme.colors.onSurface,
    },
    banner: {
      width: '100%',
      height: 140,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.surfaceContainerHighest,
    },
  }), [theme, status]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPressCard} activeOpacity={0.7}>
      {bannerUrl && (
        <Image source={{ uri: bannerUrl }} style={styles.banner} resizeMode="cover" />
      )}
      <View style={styles.headerRow}>
        <Title style={styles.title}>{title}</Title>
        <MonoLabel style={styles.liveBadge}>[ LIVE NOW ]</MonoLabel>
      </View>
      <View style={styles.locationRow}>
        <Body style={styles.location} numberOfLines={2}>{location}</Body>
      </View>
      <View style={styles.metaFooterRow}>
        <Mono style={styles.dateTime}>{date} · {time}</Mono>
      </View>
      <TouchableOpacity 
        style={styles.actionBtn} 
        onPress={status === 'SCAN_QR' ? onPressAction : undefined} 
        activeOpacity={0.8}
        disabled={status === 'ATTENDANCE_MARKED'}
      >
        <MonoLabel style={styles.actionText}>
          {status === 'SCAN_QR' ? '[ MARK ATTENDANCE ]' : '[ ATTENDANCE MARKED ]'}
        </MonoLabel>
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
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
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
          padding: theme.spacing.sm,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: theme.colors.outlineVariant,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <MonoLabel style={{ fontSize: 9, color: theme.colors.onSurfaceVariant }}>
        {label}
      </MonoLabel>
      {typeof value === 'string' ? (
        <Mono style={{ fontSize: 11, color: valueColor || theme.colors.primary, fontFamily: theme.typography.monoMedium }}>
          {value}
        </Mono>
      ) : (
        value
      )}
    </View>
  );
}
