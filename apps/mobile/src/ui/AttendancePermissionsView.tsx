import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar, Linking, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../store/theme-store';
import { Title, Body, MonoLabel, Mono, Display } from './core/Typography';

export interface AttendancePermissionsViewProps {
  onRequestPermissions: () => void | Promise<void>;
  onCancel?: () => void;
  cameraGranted?: boolean;
  locationGranted?: boolean;
}

export const AttendancePermissionsView: React.FC<AttendancePermissionsViewProps> = ({
  onRequestPermissions,
  onCancel,
  cameraGranted = false,
  locationGranted = false,
}) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0, 12);
  const bottomInset = Math.max(insets.bottom, 16);

  const buttonLabel = useMemo(() => {
    if (!cameraGranted && !locationGranted) {
      return 'GRANT CAMERA & LOCATION ACCESS';
    }
    if (!cameraGranted) {
      return 'GRANT CAMERA ACCESS';
    }
    return 'GRANT LOCATION ACCESS';
  }, [cameraGranted, locationGranted]);

  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.md,
      justifyContent: 'space-between',
    },
    topSection: {
      flexShrink: 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.sm,
    },
    headerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.surfaceContainerHigh,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 0,
    },
    pingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.secondary,
    },
    headerMonoText: {
      color: theme.colors.primary,
    },
    reqId: {
      color: theme.colors.onSurfaceVariant,
    },
    viewfinderBox: {
      height: 180,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 18,
    },
    reticleFrame: {
      width: 150,
      height: 110,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cornerBracket: {
      position: 'absolute',
      width: 16,
      height: 16,
      borderColor: theme.colors.secondary,
    },
    topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
    topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
    bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
    bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
    dualIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 0,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
    },
    syncLabel: {
      marginTop: 8,
      color: theme.colors.secondary,
      letterSpacing: 1,
    },
    contentSection: {
      gap: 8,
      marginVertical: theme.spacing.sm,
    },
    sectionTag: {
      color: theme.colors.secondary,
      letterSpacing: 0.8,
    },
    title: {
      fontSize: 22,
      color: theme.colors.primary,
    },
    body: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 20,
    },
    checklistCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: theme.spacing.sm,
      gap: 10,
      marginTop: 6,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    checkLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 8,
    },
    checkIcon: {
      color: theme.colors.secondary,
      marginRight: 8,
      fontWeight: '700',
    },
    checkText: {
      color: theme.colors.primary,
      fontSize: 13,
    },
    checkTag: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 11,
    },
    actionSection: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    mainBtn: {
      height: 52,
      borderRadius: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingsBtn: {
      alignItems: 'center',
      paddingVertical: 6,
    },
    settingsText: {
      color: theme.colors.onSurfaceVariant,
    },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: 4,
    },
    cancelText: {
      color: theme.colors.error,
    },
  }), [theme]);

  return (
    <View style={[styles.safeArea, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <View style={styles.topSection}>
          {/* Top Header Badge */}
          <View style={styles.header}>
            <View style={styles.headerBadge}>
              <View style={styles.pingDot} />
              <MonoLabel style={styles.headerMonoText}>[PERMISSION_GATE // SYS_ATTENDANCE]</MonoLabel>
            </View>
            <Mono style={styles.reqId}>REQ_ID: 0x91F4</Mono>
          </View>

          {/* Reticle / Dual Sensor Viewfinder */}
          <View style={styles.viewfinderBox}>
            <View style={styles.reticleFrame}>
              <View style={[styles.cornerBracket, styles.topLeft]} />
              <View style={[styles.cornerBracket, styles.topRight]} />
              <View style={[styles.cornerBracket, styles.bottomLeft]} />
              <View style={[styles.cornerBracket, styles.bottomRight]} />
              <View style={styles.dualIconRow}>
                <View style={styles.iconBox}>
                  <MaterialIcons name="camera-alt" size={24} color={cameraGranted ? theme.colors.secondary : theme.colors.primary} />
                </View>
                <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>+</MonoLabel>
                <View style={styles.iconBox}>
                  <Display style={{ fontSize: 20 }}>📍</Display>
                </View>
              </View>
              <MonoLabel style={styles.syncLabel}>[SYS_SENSORS // CAM + GPS]</MonoLabel>
            </View>
          </View>

          {/* Rationale Content */}
          <View style={styles.contentSection}>
            <MonoLabel style={styles.sectionTag}>SENSOR AUTHORIZATIONS // PROTOCOL</MonoLabel>
            <Title style={styles.title}>Camera & Location Access</Title>
            <Body style={styles.body}>
              To verify session attendance, high-accuracy foreground location confirms your physical presence inside the auditorium geofence, and camera access is required to scan the dynamic QR code.
            </Body>
          </View>

          {/* Checklist Card */}
          <View style={styles.checklistCard}>
            <View style={styles.checkRow}>
              <View style={styles.checkLeft}>
                <MonoLabel style={styles.checkIcon}>{cameraGranted ? '[✓]' : '[•]'}</MonoLabel>
                <Body style={styles.checkText}>Camera QR Scanner</Body>
              </View>
              <MonoLabel style={styles.checkTag}>{cameraGranted ? 'AUTHORIZED' : 'OPTICAL_FEED'}</MonoLabel>
            </View>
            <View style={styles.checkRow}>
              <View style={styles.checkLeft}>
                <MonoLabel style={styles.checkIcon}>{locationGranted ? '[✓]' : '[•]'}</MonoLabel>
                <Body style={styles.checkText}>Foreground Geofence</Body>
              </View>
              <MonoLabel style={styles.checkTag}>{locationGranted ? 'AUTHORIZED' : 'PERIMETER_CHECK'}</MonoLabel>
            </View>
            <View style={styles.checkRow}>
              <View style={styles.checkLeft}>
                <MonoLabel style={styles.checkIcon}>[✓]</MonoLabel>
                <Body style={styles.checkText}>Privacy & Security Guard</Body>
              </View>
              <MonoLabel style={styles.checkTag}>NO_BG_TRACKING</MonoLabel>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.mainBtn, { backgroundColor: theme.colors.primary }]}
            onPress={onRequestPermissions}
            activeOpacity={0.9}
          >
            <MonoLabel style={{ color: theme.colors.onPrimary }}>{buttonLabel}</MonoLabel>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => Linking.openSettings()}
          >
            <MonoLabel style={styles.settingsText}>DENIED / OPEN SYSTEM SETTINGS</MonoLabel>
          </TouchableOpacity>
          {onCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <MonoLabel style={styles.cancelText}>CANCEL SCAN</MonoLabel>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
