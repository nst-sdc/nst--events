import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/store/theme-store';
import { Button } from '../../src/ui/Button';
import { NstLogo } from '../../src/ui/NstLogo';
import { useAuthStore } from '../../src/store/auth';
import { apiClient } from '../../src/infrastructure/api';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, SUPPORT_EMAIL, PRIVACY_POLICY_URL } from '../../src/infrastructure/config';
import { DevClubBadge } from '../../src/ui/brand/DevClubBadge';
import { DevClubCreditsModal } from '../../src/ui/brand/DevClubCreditsModal';

import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
});

interface AuthError {
  type: 'INSTITUTIONAL_DOMAIN_NOT_ALLOWED' | 'STUDENT_ACCESS_NOT_AUTHORIZED' | 'GENERIC';
  title: string;
  message: string;
  email?: string;
}

export default function LoginGatewayScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0, 12);
  const bottomInset = Math.max(insets.bottom, 16);
  const setSession = useAuthStore((state) => state.setSession);
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const [attemptedEmail, setAttemptedEmail] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setAuthError(null);
    let currentEmail = attemptedEmail;

    if (!GOOGLE_WEB_CLIENT_ID) {
      setAuthError({
        type: 'GENERIC',
        title: 'CONFIGURATION ERROR',
        message: 'Google Web Client ID is not configured (missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID). Authentication cannot proceed.',
      });
      setLoading(false);
      return;
    }

    if (Platform.OS === 'web') {
      setAuthError({
        type: 'GENERIC',
        title: 'NATIVE GOOGLE SIGN-IN REQUIRED',
        message: 'Google Sign-In requires native iOS/Android runtime. In Chrome/browser, please use the [ DEV: TEST AS STUDENT ] button below.',
      });
      setLoading(false);
      return;
    }

    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || (userInfo as any).idToken;
      const userEmail = userInfo.data?.user?.email || (userInfo as any).user?.email || '';

      if (userEmail) {
        currentEmail = userEmail;
        setAttemptedEmail(userEmail);
      }

      if (!idToken) {
        setAuthError({
          type: 'GENERIC',
          title: 'AUTHENTICATION FAILED',
          message: 'No ID token received from Google',
        });
        return;
      }

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[Auth] Attempting token exchange with id_token...');
        console.log('[Auth] ID Token Exchange Target Endpoint:', '/auth/mobile/login-id-token');
      }
      // Send id_token directly to backend
      const exchangeRes: any = await apiClient('/auth/mobile/login-id-token', {
        method: 'POST',
        body: JSON.stringify({ id_token: idToken }),
      });

      if (!exchangeRes?.access_token || !exchangeRes?.refresh_token) {
        useAuthStore.getState().setPendingDeepLink(null);
        setAuthError({
          type: 'GENERIC',
          title: 'AUTHENTICATION FAILED',
          message: 'Token exchange failed',
        });
        return;
      }

      // Fetch user profile to resolve user ID and global role
      const userProfile: any = await apiClient('/users/me', {
        headers: { Authorization: `Bearer ${exchangeRes.access_token}` },
      });

      if (userProfile?.id) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('[Auth] Authentication handshake complete for user ID:', userProfile.id);
        }
        await setSession(userProfile.id, exchangeRes.access_token, exchangeRes.refresh_token);

        const pendingDeepLink = useAuthStore.getState().pendingDeepLink;
        if (pendingDeepLink) {
          useAuthStore.getState().setPendingDeepLink(null);
          router.replace(pendingDeepLink as any);
        } else {
          router.replace('/(app)');
        }
        return;
      } else {
        useAuthStore.getState().setPendingDeepLink(null);
        setAuthError({
          type: 'GENERIC',
          title: 'AUTHENTICATION FAILED',
          message: 'Failed to verify user profile',
        });
        return;
      }
    } catch (err: any) {
      useAuthStore.getState().setPendingDeepLink(null);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error('[Auth] OAuth initiation error:', err);
      }
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('[Auth] User cancelled OAuth flow');
        }
        return;
      }

      const errorCode = err?.body?.detail || err?.message;

      if (errorCode === 'INSTITUTIONAL_DOMAIN_NOT_ALLOWED') {
        setAuthError({
          type: 'INSTITUTIONAL_DOMAIN_NOT_ALLOWED',
          title: 'INSTITUTIONAL DOMAIN NOT ALLOWED',
          message:
            'NST Events is restricted to institutional accounts. Please sign in with your @adypu.edu.in or @newtonschool.co Google account.',
        });
      } else if (errorCode === 'STUDENT_ACCESS_NOT_AUTHORIZED') {
        const emailToShow = currentEmail || 'Your account';
        setAuthError({
          type: 'STUDENT_ACCESS_NOT_AUTHORIZED',
          title: 'STUDENT NOT ENROLLED IN DIRECTORY',
          message: `Account Recognized, but Not Enrolled: ${emailToShow} is not listed in the active NST Student Directory.`,
          email: currentEmail,
        });
      } else {
        setAuthError({
          type: 'GENERIC',
          title: 'AUTHENTICATION FAILED',
          message: err?.message || 'Failed to complete Google authentication',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[Auth] Google sign-out error during account switch:', e);
      }
    }
    setAuthError(null);
    await handleGoogleLogin();
  };

  const handleContactCoordinator = async () => {
    const emailToReport = authError?.email || attemptedEmail || '';
    const subject = encodeURIComponent(`Student Directory Inquiry - ${emailToReport}`);
    const body = encodeURIComponent(
      'Student Name:\nProgram:\nBatch Year:\nStudent ID:\nProblem: Institutional account not authorized in NST Events.'
    );
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(mailtoUrl);
    } catch (e) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error('[Auth] Failed to open mail client:', e);
      }
    }
  };

  const devToken = process.env.EXPO_PUBLIC_DEV_AUTH_TOKEN;
  const devUserId = process.env.EXPO_PUBLIC_DEV_USER_ID;

  const handleDevStudentLogin = async () => {
    if (!devToken || !devUserId) {
      setAuthError({
        type: 'GENERIC',
        title: 'DEV LOGIN UNAVAILABLE',
        message: 'EXPO_PUBLIC_DEV_AUTH_TOKEN and EXPO_PUBLIC_DEV_USER_ID must be configured in local environment.',
      });
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      await setSession(devUserId, devToken, devToken);
      const pendingDeepLink = useAuthStore.getState().pendingDeepLink;
      if (pendingDeepLink) {
        useAuthStore.getState().setPendingDeepLink(null);
        router.replace(pendingDeepLink as any);
      } else {
        router.replace('/(app)');
      }
    } catch (e: any) {
      useAuthStore.getState().setPendingDeepLink(null);
      setAuthError({
        type: 'GENERIC',
        title: 'DEV LOGIN FAILED',
        message: e?.message || 'Failed to initialize dev student session',
      });
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.secondary,
    },
    headerMonoText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      letterSpacing: 0.8,
      color: theme.colors.primary,
      textTransform: 'uppercase',
    },
    statusPill: {
      backgroundColor: theme.colors.surfaceContainerHigh,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 0,
    },
    statusPillText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      letterSpacing: 0.8,
      color: theme.colors.primary,
    },
    bodySection: {
      marginVertical: 'auto',
      width: '100%',
      gap: theme.spacing.md,
    },
    sectionTagRow: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    sectionTagText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.secondary,
      letterSpacing: 0.8,
    },
    sectionTagCode: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    headline: {
      fontFamily: theme.typography.syneBold,
      fontSize: 30,
      lineHeight: 34,
      color: theme.colors.primary,
      letterSpacing: -0.5,
    },
    bodyText: {
      fontFamily: theme.typography.interRegular,
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.onSurfaceVariant,
    },
    monoHighlight: {
      fontFamily: theme.typography.monoMedium,
      color: theme.colors.primary,
      backgroundColor: theme.colors.surfaceContainerHigh,
    },
    matrixCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      padding: theme.spacing.base,
      marginTop: 4,
    },
    matrixHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      paddingBottom: 6,
      marginBottom: 10,
    },
    matrixHeaderTag: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    matrixHeaderStatus: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.secondary,
    },
    matrixGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    matrixItem: {
      flex: 1,
      backgroundColor: theme.colors.surfaceContainerLow,
      padding: 8,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    matrixItemLabel: {
      fontFamily: theme.typography.monoBold,
      fontSize: 9,
      color: theme.colors.onSurfaceVariant,
    },
    matrixItemValue: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.primary,
      marginTop: 2,
    },
    matrixItemValueActive: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.secondary,
      marginTop: 2,
    },
    errorBox: {
      backgroundColor: theme.colors.errorContainer,
      borderWidth: 1,
      borderColor: theme.colors.error,
      padding: theme.spacing.md,
      marginTop: 8,
    },
    errorTitle: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.onErrorContainer,
    },
    errorBody: {
      fontFamily: theme.typography.interRegular,
      fontSize: 12,
      color: theme.colors.onErrorContainer,
      marginTop: 4,
    },
    errorBtn: {
      marginTop: 8,
      backgroundColor: theme.colors.error,
      paddingVertical: 8,
      alignItems: 'center',
    },
    errorBtnText: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 11,
      color: theme.colors.onError,
    },
    stateBActionContainer: {
      gap: 6,
      marginTop: 8,
    },
    contactBtn: {
      paddingVertical: 6,
      alignItems: 'center',
    },
    contactBtnText: {
      fontFamily: theme.typography.interMedium,
      fontSize: 11,
      color: theme.colors.onErrorContainer,
      textDecorationLine: 'underline',
    },
    footer: {
      gap: theme.spacing.md,
    },
    ctaButton: {
      height: 56,
    },
    noticeBox: {
      alignItems: 'center',
      gap: 2,
    },
    noticeText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
      textTransform: 'uppercase',
    },
    noticeSub: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 9,
      color: theme.colors.outline,
      textTransform: 'uppercase',
    },
  }), [theme]);

  return (
    <View style={[styles.safeArea, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <StatusBar 
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent"
        translucent={Platform.OS === 'android'}
      />
      <View style={styles.container}>
        {/* Header Metadata */}
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <View style={styles.pingDot} />
            <Text style={styles.headerMonoText}>AUTH GATEWAY // NST-NET</Text>
          </View>
        </View>

        {/* Editorial Section */}
        <View style={styles.bodySection}>
          <NstLogo size="md" style={{ marginBottom: 4 }} />

          <View style={styles.sectionTagRow}>
            <Text style={styles.sectionTagText}>IDENTITY VERIFICATION</Text>
            <Text style={styles.sectionTagCode}>// SEC-02</Text>
          </View>

          <Text style={styles.headline}>Access Attendance Enclave</Text>

          <Text style={styles.bodyText}>
            Use your institutional <Text style={styles.monoHighlight}>@adypu.edu.in</Text> or <Text style={styles.monoHighlight}>@newtonschool.co</Text> identity to synchronize attendance records, session logs, and dispute claims.
          </Text>

          {/* Ledger Identity Matrix Card */}
          <View style={styles.matrixCard}>
            <View style={styles.matrixHeader}>
              <Text style={styles.matrixHeaderTag}>SESSION HANDSHAKE MATRIX</Text>
              <Text style={styles.matrixHeaderStatus}>READY FOR SSO</Text>
            </View>

            <View style={styles.matrixGrid}>
              <View style={styles.matrixItem}>
                <Text style={styles.matrixItemLabel}>CLEARANCE</Text>
                <Text style={styles.matrixItemValue}>LEVEL-03</Text>
              </View>
              <View style={styles.matrixItem}>
                <Text style={styles.matrixItemLabel}>CLUSTER</Text>
                <Text style={styles.matrixItemValue}>AI-DEV-ENG</Text>
              </View>
              <View style={styles.matrixItem}>
                <Text style={styles.matrixItemLabel}>DEVICE BOUND</Text>
                <Text style={styles.matrixItemValueActive}>ACTIVE</Text>
              </View>
            </View>
          </View>

          {authError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>{authError.title}</Text>
              <Text style={styles.errorBody}>{authError.message}</Text>

              {authError.type === 'INSTITUTIONAL_DOMAIN_NOT_ALLOWED' && (
                <TouchableOpacity
                  style={styles.errorBtn}
                  onPress={handleSwitchAccount}
                  activeOpacity={0.8}
                >
                  <Text style={styles.errorBtnText}>SWITCH GOOGLE ACCOUNT</Text>
                </TouchableOpacity>
              )}

              {authError.type === 'STUDENT_ACCESS_NOT_AUTHORIZED' && (
                <View style={styles.stateBActionContainer}>
                  <TouchableOpacity
                    style={styles.errorBtn}
                    onPress={handleSwitchAccount}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.errorBtnText}>SWITCH ACCOUNT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={handleContactCoordinator}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.contactBtnText}>Contact Academic Coordinator</Text>
                  </TouchableOpacity>
                </View>
              )}

              {authError.type === 'GENERIC' && (
                <TouchableOpacity
                  style={styles.errorBtn}
                  onPress={() => setAuthError(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.errorBtnText}>DISMISS</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Action Enclosure */}
        <View style={styles.footer}>
          <Button
            title="CONTINUE WITH GOOGLE"
            onPress={handleGoogleLogin}
            loading={loading}
            variant="primary"
            style={styles.ctaButton}
          />

          {Platform.OS === 'web' && typeof __DEV__ !== 'undefined' && __DEV__ && !!devToken && !!devUserId && (
            <Button
              title="[ DEV: TEST AS STUDENT (ARJUN MEHTA) ]"
              onPress={handleDevStudentLogin}
              loading={loading}
              variant="secondary"
              style={[styles.ctaButton, { marginTop: 8 }]}
            />
          )}


          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>RESTRICTED TO ENROLLED NST STUDENTS & FACULTY</Text>
            <Text style={styles.noticeSub}>SINGLE DEVICE BOUND // HARDWARE KEY VERIFIED</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              activeOpacity={0.7}
              style={{ marginTop: 4 }}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
            >
              <Text style={{ fontFamily: theme.typography.monoMedium, fontSize: 10, color: theme.colors.primary, textDecorationLine: 'underline', letterSpacing: 0.5 }}>
                [ PRIVACY POLICY ]
              </Text>
            </TouchableOpacity>
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.borderHairline, alignItems: 'center' }}>
              <DevClubBadge
                variant="signature"
                size="sm"
                onPress={() => setIsCreditsOpen(true)}
              />
            </View>
          </View>
        </View>
      </View>
      <DevClubCreditsModal
        visible={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
      />
    </View>
  );
}
