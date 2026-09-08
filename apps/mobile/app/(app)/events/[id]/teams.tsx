import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../../../src/store/theme-store';
import { MobileShell } from '../../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel } from '../../../../src/ui/core/Typography';
import { StatusBadge } from '../../../../src/ui/core/StatusBadge';

export default function TeamsScreen() {
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    card: {
      padding: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surfaceContainerLow,
      alignItems: 'center',
      marginTop: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    title: {
      fontSize: 18,
      textAlign: 'center',
      color: theme.colors.onSurface,
    },
    desc: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    noticePill: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      marginTop: theme.spacing.sm,
    },
    noticeText: {
      fontSize: 10,
      color: theme.colors.outline,
      letterSpacing: 0.8,
    },
  }), [theme]);

  return (
    <MobileShell title="TEAMS" showBackButton scrollable>
      <View style={styles.card}>
        <StatusBadge status="DESKTOP PORTAL ONLY" type="warning" />
        <Title style={styles.title}>TEAM FORMATION & ROSTER</Title>
        <Body style={styles.desc}>
          Team registration, invitations, and member roster management are restricted to the desktop web application.
        </Body>
        <View style={styles.noticePill}>
          <MonoLabel style={styles.noticeText}>ACCESS VIA WEB DASHBOARD</MonoLabel>
        </View>
      </View>
    </MobileShell>
  );
}
