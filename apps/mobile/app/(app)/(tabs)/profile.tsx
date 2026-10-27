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
import { useStudentAchievements, StudentAchievementItem } from '../../../src/hooks/use-event-results';
import { useMyStudentProfile } from '../../../src/hooks/use-student-profiles';
import { ProfileVisibilityModal } from '../../../src/ui/ProfileVisibilityModal';
import { logout } from '../../../src/services/session';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';
import { DevClubBadge } from '../../../src/ui/brand/DevClubBadge';
import { DevClubCreditsModal } from '../../../src/ui/brand/DevClubCreditsModal';
import { MOBILE_APP_VERSION } from '../../../src/infrastructure/brand-config';
import { openProjectShowcase } from '../../../src/lib/project-showcase';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { data: profile, isLoading, isError, error, refetch } = useUserProfile();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: myProfileData } = useMyStudentProfile();
  const mySlug = myProfileData?.profile?.slug;

  const { data: achievementsData, isLoading: isAchievementsLoading } = useStudentAchievements(profile?.id, !!profile?.id);
  const achievements = achievementsData?.achievements || [];

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
    achievementsSection: {
      gap: theme.spacing.sm,
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

            {/* PUBLIC DOSSIER & PORTFOLIO */}
            <View style={{
              backgroundColor: theme.colors.surfaceContainerLow,
              borderWidth: 1,
              borderColor: theme.colors.primary,
              padding: theme.spacing.base,
              gap: theme.spacing.sm,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <MonoLabel style={{ color: theme.colors.primary }}>PUBLIC STUDENT PORTFOLIO</MonoLabel>
                {mySlug && (
                  <Mono style={{ fontSize: 10, color: theme.colors.primary }}>@{mySlug}</Mono>
                )}
              </View>

              <Body style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>
                Control which projects, honors, and verified credentials appear on your public web portfolio.
              </Body>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                {mySlug && (
                  <TouchableOpacity
                    onPress={() => router.push(`/students/${mySlug}` as any)}
                    style={{
                      flex: 1,
                      backgroundColor: theme.colors.primary,
                      paddingVertical: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Mono style={{ fontSize: 11, fontFamily: theme.typography.monoBold, color: theme.colors.onPrimary }}>
                      VIEW DOSSIER ↗
                    </Mono>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowVisibilityModal(true)}
                  style={{
                    flex: 1,
                    backgroundColor: theme.colors.surfaceContainerHighest,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Mono style={{ fontSize: 11, fontFamily: theme.typography.monoBold, color: theme.colors.onSurface }}>
                    VISIBILITY ⚙
                  </Mono>
                </TouchableOpacity>
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

            {/* OFFICIAL HONORS & ACHIEVEMENTS */}
            <View style={styles.achievementsSection} testID="profile-achievements-section">
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <MonoLabel style={styles.sectionTitle}>OFFICIAL HONORS & ACHIEVEMENTS</MonoLabel>
                <MonoLabel style={{ color: theme.colors.success, fontSize: 9 }}>[VERIFIED RECORD]</MonoLabel>
              </View>

              {isAchievementsLoading ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : achievements && achievements.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {achievements.map((ach: StudentAchievementItem) => {
                    const isPodium = ach.placement && ach.placement <= 3;
                    const rankText = ach.placement
                      ? ach.placement === 1
                        ? '🥇 1ST PLACE'
                        : ach.placement === 2
                        ? '🥈 2ND PLACE'
                        : ach.placement === 3
                        ? '🥉 3RD PLACE'
                        : `RANK #${ach.placement}`
                      : 'AWARD';

                    return (
                      <View
                        key={ach.id}
                        style={{
                          backgroundColor: theme.colors.surfaceContainerLow,
                          borderWidth: 1,
                          borderColor: isPodium ? theme.colors.podiumGold : theme.colors.outlineVariant,
                          padding: 12,
                          gap: 6,
                        }}
                        testID={`achievement-card-${ach.id}`}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <MonoLabel style={{ color: theme.colors.primary, fontSize: 10 }}>
                            {rankText}
                          </MonoLabel>
                          <Mono style={{ fontSize: 9, color: theme.colors.outline }}>
                            {new Date(ach.published_at).getFullYear()}
                          </Mono>
                        </View>

                        <Title style={{ fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', color: theme.colors.onSurface }}>
                          {ach.award_title}
                        </Title>

                        <Body style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>
                          {ach.event.title}
                          {ach.is_team_award && ach.team_name ? ` • Team: ${ach.team_name}` : ''}
                        </Body>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.borderHairline }}>
                          <TouchableOpacity
                            onPress={() => router.push(`/(app)/events/${ach.event.id}/results`)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                          >
                            <Mono style={{ fontSize: 10, color: theme.colors.primary, fontWeight: 'bold' }}>
                              [ VIEW RESULTS ]
                            </Mono>
                          </TouchableOpacity>

                          {ach.linked_project && (
                            <TouchableOpacity
                              onPress={() => openProjectShowcase(ach.linked_project?.slug)}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                              <Mono style={{ fontSize: 10, color: theme.colors.secondary, fontWeight: 'bold' }}>
                                [ SHOWCASE PROJECT ↗ ]
                              </Mono>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: theme.colors.surfaceContainerLow,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: theme.colors.outlineVariant,
                    padding: 16,
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Body style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                    No official event honors or podium rankings recorded yet.
                  </Body>
                  <MonoLabel style={{ fontSize: 9, color: theme.colors.outline }}>
                    PARTICIPATE IN CAMPUS HACKATHONS & JAM COMPETITIONS TO EARN OFFICIAL CREDENTIALS.
                  </MonoLabel>
                </View>
              )}
            </View>

            <View style={styles.menuContainer}>
              <MonoLabel style={styles.sectionTitle}>CAMPUS DIRECTORY</MonoLabel>

              <View style={styles.menuList}>
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.push('/(app)/clubs')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="groups" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>STUDENT CLUBS</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.push('/(app)/students')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="person-search" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>STUDENT DIRECTORY</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => router.push('/(app)/leaderboard')}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuRowLeft}>
                    <MaterialIcons name="leaderboard" size={16} color={theme.colors.primary} />
                    <Body style={styles.menuRowTitle}>CAMPUS LEADERBOARD</Body>
                  </View>
                  <MonoLabel style={styles.menuRowArrow}>→</MonoLabel>
                </TouchableOpacity>
              </View>
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
                  onPress={() => router.navigate('/(app)/(tabs)/activity?tab=attendance')}
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

      <ProfileVisibilityModal
        visible={showVisibilityModal}
        onClose={() => setShowVisibilityModal(false)}
      />
    </MobileShell>
  );
}
