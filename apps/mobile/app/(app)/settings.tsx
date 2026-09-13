import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../src/ui/Button';
import { useThemeStore, ThemeMode, useAppTheme } from '../../src/store/theme-store';
import { useNotificationPreferences } from '../../src/hooks/use-notification-preferences';
import { MobileShell } from '../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../src/ui/core/Typography';
import { StatusBadge } from '../../src/ui/core/StatusBadge';
import { ActivityIndicator } from '../../src/ui/core/ActivityIndicator';
import { logout } from '../../src/services/session';
import { PRIVACY_POLICY_URL } from '../../src/infrastructure/config';
import { DevClubCreditsModal } from '../../src/ui/brand/DevClubCreditsModal';
import { MOBILE_APP_VERSION } from '../../src/infrastructure/brand-config';

export default function SettingsScreen() {
  const router = useRouter();
  const { mode, setMode } = useThemeStore();
  const theme = useAppTheme();
  const {
    preferences,
    updatePreferences,
    isLoading: isPrefsLoading,
    isError: isPrefsError,
    error: prefsError,
    refetch: refetchPrefs,
  } = useNotificationPreferences();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      setShowLogoutModal(false);
      await logout();
    } catch {
      setIsLoggingOut(false);
    }
  };

  const handleSwitchAccount = async () => {
    setIsSwitchingAccount(true);
    try {
      await logout();
    } catch {
      setIsSwitchingAccount(false);
    }
  };

  const handleSelectMode = async (newMode: ThemeMode) => {
    await setMode(newMode);
  };

  const handleOpenPrivacyPolicy = async () => {
    await Linking.openURL(PRIVACY_POLICY_URL);
  };

  const styles = useMemo(() => StyleSheet.create({
    sectionHeader: {
      gap: 4,
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      color: theme.colors.outline,
    },
    sectionDesc: {
      color: theme.colors.onSurfaceVariant,
    },
    optionsList: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    optionRowActive: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.primary,
      borderBottomWidth: 2,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    toggleRowDisabled: {
      opacity: 0.38,
    },
    toggleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
    },
    toggleBadgeOn: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
    },
    toggleBadgeOff: {
      borderColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surfaceContainerHighest,
    },
    toggleTextOn: {
      color: theme.colors.primary,
    },
    toggleTextOff: {
      color: theme.colors.onSurfaceVariant,
    },
    textDisabled: {
      color: theme.colors.onSurfaceVariant,
    },
    optionContent: {
      gap: 2,
      flex: 1,
      paddingRight: 12,
    },
    optionTitleActive: {
      color: theme.colors.primary,
    },
    activeIndicator: {
      color: theme.colors.primary,
    },
    prefsLoadingBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      gap: 8,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
    },
    prefsErrorBox: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      gap: 8,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
    },
    prefsErrorTitle: {
      fontSize: 14,
    },
    prefsErrorSub: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    accountActionsList: {
      gap: theme.spacing.sm,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(9, 9, 11, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderHairline,
      borderWidth: 1,
      borderRadius: theme.borderRadius.sm,
      padding: 20,
      width: '100%',
      gap: 12,
    },
    modalTitle: {
      fontSize: 18,
    },
    modalBody: {
      fontSize: 13,
      lineHeight: 18,
    },
    modalActions: {
      gap: 8,
      marginTop: 8,
    },
    spacer: {
      flex: 1,
      minHeight: 24,
    },
  }), [theme]);

  const handleBackToProfile = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/profile');
    }
  };

  return (
    <MobileShell title="SETTINGS" showBackButton onBackPress={handleBackToProfile} scrollable={true}>
      {/* APPEARANCE SECTION */}
      <View style={styles.sectionHeader}>
        <MonoLabel style={styles.sectionTitle}>APPEARANCE</MonoLabel>
        <Body style={styles.sectionDesc}>Choose how NST Events should appear.</Body>
      </View>

      <View style={styles.optionsList}>
        <TouchableOpacity
          style={[styles.optionRow, mode === 'light' && styles.optionRowActive]}
          onPress={() => handleSelectMode('light')}
          activeOpacity={0.8}
        >
          <View style={styles.optionContent}>
            <Title style={mode === 'light' ? styles.optionTitleActive : undefined}>LIGHT</Title>
            <Mono>High contrast</Mono>
          </View>
          {mode === 'light' && <MonoLabel style={styles.activeIndicator}>[SELECTED]</MonoLabel>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionRow, mode === 'dark' && styles.optionRowActive]}
          onPress={() => handleSelectMode('dark')}
          activeOpacity={0.8}
        >
          <View style={styles.optionContent}>
            <Title style={mode === 'dark' ? styles.optionTitleActive : undefined}>DARK</Title>
            <Mono>Kinetic Noir</Mono>
          </View>
          {mode === 'dark' && <MonoLabel style={styles.activeIndicator}>[SELECTED]</MonoLabel>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionRow, mode === 'system' && styles.optionRowActive]}
          onPress={() => handleSelectMode('system')}
          activeOpacity={0.8}
        >
          <View style={styles.optionContent}>
            <Title style={mode === 'system' ? styles.optionTitleActive : undefined}>SYSTEM</Title>
            <Mono>Follow device</Mono>
          </View>
          {mode === 'system' && <MonoLabel style={styles.activeIndicator}>[SELECTED]</MonoLabel>}
        </TouchableOpacity>
      </View>

      {/* ALERTS & NOTIFICATIONS SECTION */}
      <View style={[styles.sectionHeader, { marginTop: theme.spacing.xl }]}>
        <MonoLabel style={styles.sectionTitle}>ALERTS & NOTIFICATIONS</MonoLabel>
        <Body style={styles.sectionDesc}>Configure push alerts and notification triggers.</Body>
      </View>

      {isPrefsLoading ? (
        <View style={styles.prefsLoadingBox}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <MonoLabel>LOADING PREFERENCES...</MonoLabel>
        </View>
      ) : isPrefsError ? (
        <View style={styles.prefsErrorBox}>
          <StatusBadge status="[FETCH ERROR]" type="error" />
          <Title style={styles.prefsErrorTitle}>FAILED TO LOAD PREFERENCES</Title>
          <Body style={styles.prefsErrorSub}>{(prefsError as any)?.message || 'Unable to fetch notification preferences.'}</Body>
          <Button title="RETRY FETCH" variant="secondary" onPress={() => refetchPrefs()} />
        </View>
      ) : (
        <View style={styles.optionsList}>
          {/* 1. MASTER PUSH */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => updatePreferences({ push_enabled: !preferences.push_enabled })}
            activeOpacity={0.8}
          >
            <View style={styles.optionContent}>
              <Title>MASTER PUSH (DEVICE LEVEL)</Title>
              <Mono>Overall OS push delivery gate</Mono>
            </View>
            <View style={[styles.toggleBadge, preferences.push_enabled ? styles.toggleBadgeOn : styles.toggleBadgeOff]}>
              <MonoLabel style={preferences.push_enabled ? styles.toggleTextOn : styles.toggleTextOff}>
                {preferences.push_enabled ? '[ON]' : '[OFF]'}
              </MonoLabel>
            </View>
          </TouchableOpacity>

          {/* 2. EVENT REMINDERS */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => updatePreferences({ event_reminders: !preferences.event_reminders })}
            activeOpacity={0.8}
          >
            <View style={styles.optionContent}>
              <Title>EVENT REMINDERS</Title>
              <Mono>Starting within 15–30 minutes</Mono>
            </View>
            <View style={[styles.toggleBadge, preferences.event_reminders ? styles.toggleBadgeOn : styles.toggleBadgeOff]}>
              <MonoLabel style={preferences.event_reminders ? styles.toggleTextOn : styles.toggleTextOff}>
                {preferences.event_reminders ? '[ON]' : '[OFF]'}
              </MonoLabel>
            </View>
          </TouchableOpacity>

          {/* 3. CLUB UPDATES */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => updatePreferences({ club_announcements: !preferences.club_announcements })}
            activeOpacity={0.8}
          >
            <View style={styles.optionContent}>
              <Title>CLUB UPDATES</Title>
              <Mono>Club news and broadcasts</Mono>
            </View>
            <View style={[styles.toggleBadge, preferences.club_announcements ? styles.toggleBadgeOn : styles.toggleBadgeOff]}>
              <MonoLabel style={preferences.club_announcements ? styles.toggleTextOn : styles.toggleTextOff}>
                {preferences.club_announcements ? '[ON]' : '[OFF]'}
              </MonoLabel>
            </View>
          </TouchableOpacity>

          {/* 4. ATTENDANCE & CLAIMS */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => updatePreferences({ attendance_alerts: !preferences.attendance_alerts })}
            activeOpacity={0.8}
          >
            <View style={styles.optionContent}>
              <Title>ATTENDANCE & CLAIMS</Title>
              <Mono>Window open and dispute resolutions</Mono>
            </View>
            <View style={[styles.toggleBadge, preferences.attendance_alerts ? styles.toggleBadgeOn : styles.toggleBadgeOff]}>
              <MonoLabel style={preferences.attendance_alerts ? styles.toggleTextOn : styles.toggleTextOff}>
                {preferences.attendance_alerts ? '[ON]' : '[OFF]'}
              </MonoLabel>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* LEGAL SECTION */}
      <View style={[styles.sectionHeader, { marginTop: theme.spacing.xl }]}>
        <MonoLabel style={styles.sectionTitle}>LEGAL</MonoLabel>
        <Body style={styles.sectionDesc}>Important policies and terms.</Body>
      </View>

      <View style={styles.optionsList}>
        <TouchableOpacity
          style={styles.optionRow}
          onPress={handleOpenPrivacyPolicy}
          activeOpacity={0.8}
        >
          <Title>Privacy Policy</Title>
        </TouchableOpacity>
      </View>

      {/* ENGINEERING & CREDITS SECTION */}
      <View style={[styles.sectionHeader, { marginTop: theme.spacing.xl }]}>
        <MonoLabel style={styles.sectionTitle}>ENGINEERING & ABOUT</MonoLabel>
        <Body style={styles.sectionDesc}>System architecture and development credits.</Body>
      </View>

      <View style={styles.optionsList}>
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => setShowCreditsModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.optionContent}>
            <Title>NST Developers Club</Title>
            <Mono>View architecture and official links</Mono>
          </View>
          <MonoLabel>[ CREDITS ]</MonoLabel>
        </TouchableOpacity>
        <View style={styles.optionRow}>
          <View style={styles.optionContent}>
            <Title>App Version</Title>
            <Mono>Installed release bundle</Mono>
          </View>
          <MonoLabel>v{MOBILE_APP_VERSION}</MonoLabel>
        </View>
      </View>

      {/* ACCOUNT / SESSION ACTIONS */}
      <View style={[styles.sectionHeader, { marginTop: theme.spacing.xl }]}>
        <MonoLabel style={styles.sectionTitle}>ACCOUNT / SESSION</MonoLabel>
        <Body style={styles.sectionDesc}>Manage active session or switch identity.</Body>
      </View>

      <View style={styles.accountActionsList}>
        <Button
          title={isSwitchingAccount ? 'SWITCHING ACCOUNT...' : 'SWITCH ACCOUNT'}
          variant="secondary"
          onPress={handleSwitchAccount}
          disabled={isSwitchingAccount || isLoggingOut}
          loading={isSwitchingAccount}
        />
        <Button
          title="[ LOG OUT ]"
          variant="danger"
          onPress={() => setShowLogoutModal(true)}
          disabled={isSwitchingAccount || isLoggingOut}
        />
      </View>

      <View style={styles.spacer} />

      <Button
        title="← RETURN TO PROFILE"
        variant="secondary"
        onPress={handleBackToProfile}
      />

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <StatusBadge status="[LOGOUT CONFIRMATION]" type="error" />
            
            <Title style={styles.modalTitle}>END ACTIVE SESSION?</Title>
            
            <Body style={styles.modalBody}>
              Are you sure you want to end your active student session on this device? You will need your institutional Google account to log back in.
            </Body>

            <View style={styles.modalActions}>
              <Button
                title={isLoggingOut ? 'LOGGING OUT...' : 'CONFIRM LOGOUT'}
                variant="danger"
                onPress={handleConfirmLogout}
                loading={isLoggingOut}
                disabled={isLoggingOut}
              />
              <Button
                title="CANCEL / REMAIN LOGGED IN"
                variant="secondary"
                onPress={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
              />
            </View>
          </View>
        </View>
      </Modal>

      <DevClubCreditsModal
        visible={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
      />
    </MobileShell>
  );
}
