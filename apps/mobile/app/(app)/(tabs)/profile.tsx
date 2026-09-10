import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { ActivityIndicator } from '../../../src/ui/core/ActivityIndicator';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/store/theme-store';
import { StatusBadge } from '../../../src/ui/core/StatusBadge';
import { Button } from '../../../src/ui/Button';
import { useUserProfile } from '../../../src/hooks/use-user-profile';
import { logout } from '../../../src/services/session';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';
import { DevClubBadge } from '../../../src/ui/brand/DevClubBadge';
import { DevClubCreditsModal } from '../../../src/ui/brand/DevClubCreditsModal';
import { MOBILE_APP_VERSION } from '../../../src/infrastructure/brand-config';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { data: profile, isLoading, isError, error, refetch } = useUserProfile();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const fullName = profile?.full_name || profile?.email || '';
  const email = profile?.email || '';
  const globalRole = profile?.global_role || '';
  const programCode = profile?.academic_profile?.batch?.program?.code;
  const gradYear = profile?.academic_profile?.batch?.graduation_year;
  const academicRoleLabel = programCode && gradYear
    ? `${globalRole} / ${programCode} / ${gradYear}`
    : globalRole;

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      setShowLogoutModal(false);
      await logout();
    } catch {
      setIsLoggingOut(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    mainContainer: {
      padding: theme.spacing.base,
      gap: theme.spacing.lg,
    },
    loadingBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      gap: 12,
    },
    errorContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
    },
    errorTitle: {
      fontSize: 16,
    },
    errorSub: {
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      lineHeight: 16,
    },
    identitySection: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      padding: theme.spacing.base,
    },
    identityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    avatarBox: {
      width: 48,
      height: 48,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      color: theme.colors.onPrimary,
      fontSize: 20,
    },
    identityInfo: {
      flex: 1,
      gap: 2,
    },
    studentName: {
      fontSize: 16,
      textTransform: 'uppercase',
    },
    emailText: {
      fontSize: 12,
    },
    roleText: {
      textTransform: 'uppercase',
      marginTop: 2,
    },
    clubsSection: {
      gap: theme.spacing.sm,
    },
    sectionTitle: {
      color: theme.colors.outline,
    },
    clubBadgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    clubBadge: {
      paddingVertical: 4,
    },
    clubBadgeText: {
      fontSize: 10,
      color: theme.colors.onSurface,
    },
    emptyClubsText: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
    },
    menuContainer: {
      gap: theme.spacing.sm,
    },
    menuList: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    menuRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    menuRowTitle: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 12,
    },
    menuRowArrow: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    bottomSection: {
      marginTop: theme.spacing.lg,
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
    modalBadge: {
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
  }), [theme]);

  return (
    <MobileShell title="PROFILE">
      <View style={styles.mainContainer}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <MonoLabel>LOADING PROFILE DATA...</MonoLabel>
          </View>
        ) : isError || !profile ? (
          <View style={styles.errorContainer}>
            <StatusBadge status="[FETCH ERROR]" type="error" />
            <Display style={styles.errorTitle}>FAILED TO LOAD PROFILE</Display>
            <Body style={styles.errorSub}>{(error as any)?.message || 'Unable to connect to profile service.'}</Body>
            <Button title="RETRY FETCH" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <>
            <View style={styles.identitySection}>
              <View style={styles.identityHeader}>
                <View style={styles.avatarBox}>
                  <Display style={styles.avatarInitial}>{fullName.charAt(0).toUpperCase()}</Display>
                </View>
                <View style={styles.identityInfo}>
                  <Title style={styles.studentName} numberOfLines={1}>{fullName.toUpperCase()}</Title>
                  <Body style={styles.emailText} numberOfLines={1}>{email}</Body>
                  <MonoLabel style={styles.roleText} numberOfLines={1}>
                    {academicRoleLabel}
                  </MonoLabel>
                </View>
              </View>
            </View>

            <View style={styles.clubsSection}>
              <MonoLabel style={styles.sectionTitle}>AFFILIATIONS</MonoLabel>
              {profile.club_memberships && profile.club_memberships.length > 0 ? (
                <View style={styles.clubBadgesRow}>
                  {profile.club_memberships.map((m) => (
                    <View key={m.club_id} style={styles.clubBadge}>
                      <Mono style={styles.clubBadgeText}>[ {m.club_name.toUpperCase()} / {m.role} ]</Mono>
                    </View>
                  ))}
                </View>
              ) : (
                <Mono style={styles.emptyClubsText}>NO ACTIVE CLUB AFFILIATIONS</Mono>
              )}
            </View>

            <View style={styles.menuContainer}>
              <MonoLabel style={styles.sectionTitle}>ACCOUNT SETTINGS</MonoLabel>

              <View style={styles.menuList}>
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.push('/(app)/settings')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="settings" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>PREFERENCES</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.push('/(app)/notifications')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="notifications" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>NOTIFICATIONS</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.navigate('/(app)/history')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="history" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>ATTENDANCE LOGS</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.push('/(app)/disputes')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="assignment" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>CLAIMS & DISPUTES</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ marginTop: 12, padding: 14, backgroundColor: theme.colors.surfaceContainerLow, borderWidth: 1, borderColor: theme.colors.borderHairline, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <DevClubBadge
                  variant="signature"
                  size="sm"
                  onPress={() => setShowCreditsModal(true)}
                />
                <MonoLabel>v{MOBILE_APP_VERSION}</MonoLabel>
              </View>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: theme.colors.borderHairline, paddingVertical: 8, alignItems: 'center', backgroundColor: theme.colors.surface }}
                onPress={() => setShowCreditsModal(true)}
                activeOpacity={0.8}
              >
                <MonoLabel style={{ color: theme.colors.primary }}>[ VIEW DEVELOPERS CLUB CREDITS ]</MonoLabel>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSection}>
              <Button
                title="[ LOG OUT ]"
                variant="secondary"
                onPress={() => setShowLogoutModal(true)}
              />
            </View>
          </>
        )}
      </View>

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
