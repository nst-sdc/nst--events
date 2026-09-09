import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
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
    detailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    location: {
      flex: 1,
    },
    dateTime: {
      flexShrink: 0,
    },
  }), [theme, statusColor]);

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Title style={styles.title}>{title}</Title>
      </View>
      <View style={styles.detailsRow}>
        <Body style={styles.location} numberOfLines={1} ellipsizeMode="tail">{location}</Body>
        <Mono style={styles.dateTime}>{date} · {time}</Mono>
      </View>
      {statusText && <MonoLabel style={styles.statusLabel}>[{statusText}]</MonoLabel>}
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
}

export function ActiveAttendanceCard({
  title,
  location,
  date,
  time,
  status,
  onPressAction,
  onPressCard,
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
    detailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    location: {
      flex: 1,
    },
    dateTime: {
      flexShrink: 0,
    },
  }), [theme, status]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPressCard} activeOpacity={0.7}>
      <View style={styles.headerRow}>
        <Title style={styles.title}>{title}</Title>
        <MonoLabel style={styles.liveBadge}>[ LIVE NOW ]</MonoLabel>
      </View>
      <View style={styles.detailsRow}>
        <Body style={styles.location} numberOfLines={1} ellipsizeMode="tail">{location}</Body>
        <Mono style={styles.dateTime}>{date} · {time}</Mono>
      </View>
      <TouchableOpacity 
        style={styles.actionBtn} 
        onPress={status === 'SCAN_QR' ? onPressAction : undefined} 
        activeOpacity={0.8}
        disabled={status === 'ATTENDANCE_MARKED'}
      >
        <MonoLabel style={styles.actionText}>
          {status === 'SCAN_QR' ? '[ MARK ATTENDANCE ]' : 'ATTENDANCE MARKED'}
        </MonoLabel>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
