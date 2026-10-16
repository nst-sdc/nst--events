import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useAppTheme } from '../../src/store/theme-store';
import { Button } from '../../src/ui/Button';
import { ActivityIndicator } from '../../src/ui/core/ActivityIndicator';
import { useUserProfile } from '../../src/hooks/use-user-profile';
import { useAuthStore } from '../../src/store/auth';
import { logout } from '../../src/services/session';

export default function AppLayout() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0, 12);
  const bottomInset = Math.max(insets.bottom, 16);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const initSession = useAuthStore((state) => state.initSession);
  const { data: profile, isLoading, isError } = useUserProfile();

  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    centerContainer: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.base,
    },
    loadingCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      padding: theme.spacing.xl,
      alignItems: 'center',
      gap: theme.spacing.md,
      width: '100%',
    },
    loadingTitle: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.primary,
      letterSpacing: 0.8,
    },
    loadingSub: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 9,
      color: theme.colors.onSurfaceVariant,
    },
    accessDeniedContainer: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      justifyContent: 'space-between',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    errorDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.error,
    },
    headerMonoText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.primary,
      letterSpacing: 0.8,
    },
    restrictedPill: {
      backgroundColor: theme.colors.errorContainer,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    restrictedPillText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 9,
      color: theme.colors.onErrorContainer,
    },
    deniedCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.error,
      padding: theme.spacing.base,
      gap: theme.spacing.sm,
      marginVertical: 'auto',
    },
    deniedTitle: {
      fontFamily: theme.typography.syneExtraBold,
      fontSize: 24,
      color: theme.colors.primary,
    },
    deniedSubtitle: {
      fontFamily: theme.typography.interRegular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.onSurfaceVariant,
    },
    ledgerBox: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      marginTop: 6,
    },
    ledgerRow: {
      padding: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    ledgerRowLast: {
      padding: theme.spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    ledgerLabel: {
      fontFamily: theme.typography.monoBold,
      fontSize: 9,
      color: theme.colors.onSurfaceVariant,
    },
    ledgerValue: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 11,
      color: theme.colors.primary,
    },
    ledgerValueTag: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.error,
    },
    ledgerValueTagActive: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.secondary,
    },
    noticeBody: {
      fontFamily: theme.typography.interMedium,
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
      marginTop: 4,
    },
    actionTray: {
      gap: theme.spacing.sm,
    },
    actionButton: {
      height: 52,
    },
  }), [theme]);

  React.useEffect(() => {
    if (!isInitialized) {
      initSession();
    }
  }, [isInitialized, initSession]);

  React.useEffect(() => {
    if (!isInitialized) return;
    if (!isLoggedIn) {
      router.replace('/(auth)');
    } else if (isError) {
      logout();
    }
  }, [isInitialized, isLoggedIn, isError, router]);

  // 1. Loading State: Render Credential Validator
  if (!isInitialized || isLoading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <StatusBar 
          barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} 
          backgroundColor="transparent"
          translucent={Platform.OS === 'android'}
        />
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingTitle}>VERIFYING STUDENT CREDENTIALS...</Text>
          <Text style={styles.loadingSub}>AUTHENTICATING STUDENT ACCOUNT...</Text>
        </View>
      </View>
    );
  }

  // 2. Non-Student Role Access Denied State (FACULTY_ADMIN / PLATFORM_ADMIN / FACULTY_MENTOR)
  if (profile && profile.global_role !== 'STUDENT') {
    const handleSwitchAccount = async () => {
      await logout();
    };

    return (
      <View style={[styles.safeArea, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <StatusBar 
          barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} 
          backgroundColor="transparent"
          translucent={Platform.OS === 'android'}
        />
        <View style={styles.accessDeniedContainer}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={styles.errorDot} />
              <Text style={styles.headerMonoText}>NST EVENTS // MOBILE ACCESS</Text>
            </View>
            <View style={styles.restrictedPill}>
              <Text style={styles.restrictedPillText}>[ACCESS_RESTRICTED]</Text>
            </View>
          </View>

          {/* Center Card */}
          <View style={styles.deniedCard}>
            <Text style={styles.deniedTitle}>Student Access Required</Text>
            <Text style={styles.deniedSubtitle}>
              The NST-Events Student Mobile application is restricted to enrolled student accounts.
            </Text>

            <View style={styles.ledgerBox}>
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>AUTHENTICATED USER</Text>
                <Text style={styles.ledgerValue}>{profile.email}</Text>
              </View>
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerLabel}>DETECTED GLOBAL ROLE</Text>
                <Text style={styles.ledgerValueTag}>[{profile.global_role}]</Text>
              </View>
              <View style={styles.ledgerRowLast}>
                <Text style={styles.ledgerLabel}>REQUIRED GLOBAL ROLE</Text>
                <Text style={styles.ledgerValueTagActive}>[STUDENT]</Text>
              </View>
            </View>

            <Text style={styles.noticeBody}>
              Administrative and faculty users must access the desktop web dashboard to manage events and approvals.
            </Text>
          </View>

          {/* Action Tray */}
          <View style={styles.actionTray}>
            <Button
              title="SWITCH ACCOUNT / LOG OUT"
              onPress={handleSwitchAccount}
              variant="primary"
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    );
  }

  // 3. Allowed Student Mobile Shell (global_role === 'STUDENT')
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="events/[id]/index" />
      <Stack.Screen name="events/[id]/register" />
      <Stack.Screen name="events/[id]/teams" />
      <Stack.Screen name="events/[id]/results" />
      <Stack.Screen name="events/[id]/forms/[formId]" />
      <Stack.Screen name="events/[id]/scan" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="history/[id]" />
      <Stack.Screen name="disputes/index" />
      <Stack.Screen name="disputes/new" />
      <Stack.Screen name="disputes/submitted" />
      <Stack.Screen name="disputes/[id]" />
      <Stack.Screen name="clubs/index" />
      <Stack.Screen name="students/index" />
      <Stack.Screen name="students/[slug]" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
