import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { haptics } from '../lib/haptics';

interface ScannerOverlayProps {
  onClose: () => void;
  onToggleTorch?: () => void;
  torchActive?: boolean;
  eventTitle?: string;
  gpsState?: 'ACQUIRING' | 'READY' | 'WEAK' | 'ERROR';
  gpsAccuracy?: number | null;
  showTelemetry?: boolean;
}

// Invariant dark tokens per Prism v3.6.0 Section 3.3
const DARK_TOKENS = {
  canvas: '#0B0F17',
  surface: '#141C2E',
  surfaceSubtle: '#0F1523',
  surfaceElevated: '#1E293F',
  surfaceGlass: 'rgba(20, 28, 46, 0.85)',
  borderSubtle: 'rgba(255, 255, 255, 0.10)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  brandPrimary: '#2563EB',
  brandText: '#60A5FA',
  badgeTintEmerald: 'rgba(16, 185, 129, 0.16)',
  badgeTextEmerald: '#34D399',
  badgeTintAmber: 'rgba(245, 158, 11, 0.16)',
  badgeTextAmber: '#FBBF24',
  badgeTintRed: 'rgba(239, 68, 68, 0.16)',
  badgeTextRed: '#F87171',
  scrimTop: 'rgba(11, 15, 23, 0.85)',
  scrimBottom: 'rgba(11, 15, 23, 0.95)',
};

export const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  onClose,
  onToggleTorch,
  torchActive = false,
  eventTitle,
  gpsState = 'ACQUIRING',
  gpsAccuracy = null,
  showTelemetry = true,
}) => {
  const insets = useSafeAreaInsets();
  const [showAssistedModal, setShowAssistedModal] = useState(false);

  const topScrimHeight = insets.top + 96;
  const bottomScrimHeight = Math.max(insets.bottom, 16) + 160;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'space-between',
        },
        topScrim: {
          backgroundColor: DARK_TOKENS.scrimTop,
          paddingTop: Math.max(insets.top, 12),
          paddingHorizontal: 16,
          paddingBottom: 12,
          minHeight: topScrimHeight,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: DARK_TOKENS.borderSubtle,
          zIndex: 10,
        },
        headerNav: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 44,
        },
        navButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 44,
          minHeight: 44,
          paddingHorizontal: 8,
          borderRadius: 9999,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        },
        navButtonActive: {
          backgroundColor: DARK_TOKENS.brandPrimary,
        },
        navButtonText: {
          fontFamily: 'Inter_500Medium',
          fontSize: 13,
          color: DARK_TOKENS.textPrimary,
          marginLeft: 4,
        },
        titleContainer: {
          flex: 1,
          alignItems: 'center',
          paddingHorizontal: 8,
        },
        headerTitle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 15,
          color: DARK_TOKENS.textPrimary,
        },
        gpsPillContainer: {
          alignItems: 'center',
          marginTop: 8,
        },
        gpsPill: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 4,
          paddingHorizontal: 12,
          borderRadius: 9999,
          borderWidth: 1,
        },
        gpsPillText: {
          fontFamily: 'Inter_500Medium',
          fontSize: 12,
          marginLeft: 6,
        },
        gpsPillReady: {
          backgroundColor: DARK_TOKENS.badgeTintEmerald,
          borderColor: DARK_TOKENS.badgeTextEmerald,
        },
        gpsPillReadyText: {
          color: DARK_TOKENS.badgeTextEmerald,
        },
        gpsPillWarning: {
          backgroundColor: DARK_TOKENS.badgeTintAmber,
          borderColor: DARK_TOKENS.badgeTextAmber,
        },
        gpsPillWarningText: {
          color: DARK_TOKENS.badgeTextAmber,
        },
        gpsPillError: {
          backgroundColor: DARK_TOKENS.badgeTintRed,
          borderColor: DARK_TOKENS.badgeTextRed,
        },
        gpsPillErrorText: {
          color: DARK_TOKENS.badgeTextRed,
        },
        reticleContainer: {
          alignItems: 'center',
          justifyContent: 'center',
          marginVertical: 'auto',
        },
        reticleBox: {
          width: 270,
          height: 270,
          position: 'relative',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(96, 165, 250, 0.25)',
          ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
        },
        corner: {
          position: 'absolute',
          width: 24,
          height: 24,
          borderColor: DARK_TOKENS.brandPrimary,
        },
        topLeft: {
          top: -2,
          left: -2,
          borderTopWidth: 3,
          borderLeftWidth: 3,
          borderTopLeftRadius: 8,
        },
        topRight: {
          top: -2,
          right: -2,
          borderTopWidth: 3,
          borderRightWidth: 3,
          borderTopRightRadius: 8,
        },
        bottomLeft: {
          bottom: -2,
          left: -2,
          borderBottomWidth: 3,
          borderLeftWidth: 3,
          borderBottomLeftRadius: 8,
        },
        bottomRight: {
          bottom: -2,
          right: -2,
          borderBottomWidth: 3,
          borderRightWidth: 3,
          borderBottomRightRadius: 8,
        },
        reticleInstruction: {
          marginTop: 18,
          backgroundColor: 'rgba(11, 15, 23, 0.85)',
          paddingHorizontal: 16,
          paddingVertical: 7,
          borderRadius: 9999,
          borderWidth: 1,
          borderColor: DARK_TOKENS.borderSubtle,
        },
        instructionText: {
          color: DARK_TOKENS.textSecondary,
          fontSize: 13,
          fontFamily: 'Inter_500Medium',
        },
        bottomScrim: {
          backgroundColor: DARK_TOKENS.scrimBottom,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: DARK_TOKENS.borderSubtle,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom, 16),
          minHeight: bottomScrimHeight,
          justifyContent: 'space-between',
        },
        telemetryRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        },
        telemetryCol: {
          flex: 1,
        },
        telemetryLabel: {
          fontFamily: 'Inter_500Medium',
          fontSize: 12,
          color: DARK_TOKENS.textMuted,
          marginBottom: 2,
        },
        telemetryValue: {
          fontFamily: 'JetBrainsMono_600SemiBold',
          fontSize: 13,
          color: DARK_TOKENS.textPrimary,
        },
        actionsContainer: {
          gap: 8,
          alignItems: 'center',
        },
        assistedBtn: {
          paddingVertical: 10,
          paddingHorizontal: 16,
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
        },
        assistedBtnText: {
          fontFamily: 'Inter_500Medium',
          fontSize: 13,
          color: DARK_TOKENS.brandText,
          textDecorationLine: 'underline',
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        },
        modalCard: {
          width: '100%',
          backgroundColor: DARK_TOKENS.surfaceElevated,
          borderRadius: 16,
          padding: 24,
          borderWidth: 1,
          borderColor: DARK_TOKENS.borderStrong,
          gap: 16,
        },
        modalTitle: {
          fontFamily: 'Inter_700Bold',
          fontSize: 18,
          color: DARK_TOKENS.textPrimary,
        },
        modalBody: {
          fontFamily: 'Inter_400Regular',
          fontSize: 14,
          lineHeight: 20,
          color: DARK_TOKENS.textSecondary,
        },
        modalCloseBtn: {
          backgroundColor: DARK_TOKENS.brandPrimary,
          borderRadius: 12,
          height: 48,
          justifyContent: 'center',
          alignItems: 'center',
        },
        modalCloseBtnText: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 15,
          color: '#FFFFFF',
        },
      }),
    [insets, topScrimHeight, bottomScrimHeight]
  );

  let gpsPillStyle = styles.gpsPillReady;
  let gpsPillTextStyle = styles.gpsPillReadyText;
  let gpsPillLabel = "You're at the venue · Ready";
  let gpsIcon: keyof typeof MaterialIcons.glyphMap = 'location-on';

  if (gpsState === 'READY') {
    gpsPillStyle = styles.gpsPillReady;
    gpsPillTextStyle = styles.gpsPillReadyText;
    gpsPillLabel = gpsAccuracy ? `You're at the venue (±${gpsAccuracy}m)` : "You're at the venue · Ready";
    gpsIcon = 'location-on';
  } else if (gpsState === 'WEAK') {
    gpsPillStyle = styles.gpsPillWarning;
    gpsPillTextStyle = styles.gpsPillWarningText;
    gpsPillLabel = (gpsAccuracy && gpsAccuracy > 100)
      ? 'Weak GPS signal · Move near window'
      : 'Location is approximate';
    gpsIcon = 'location-searching';
  } else if (gpsState === 'ERROR') {
    gpsPillStyle = styles.gpsPillError;
    gpsPillTextStyle = styles.gpsPillErrorText;
    gpsPillLabel = "Outside the venue · Move closer";
    gpsIcon = 'location-off';
  } else {
    // ACQUIRING
    gpsPillStyle = styles.gpsPillWarning;
    gpsPillTextStyle = styles.gpsPillWarningText;
    gpsPillLabel = 'Acquiring venue location...';
    gpsIcon = 'my-location';
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Top Scrim */}
      <View style={styles.topScrim}>
        <View style={styles.headerNav}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.navButton}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <MaterialIcons name="arrow-back" size={20} color={DARK_TOKENS.textPrimary} />
            <Text style={styles.navButtonText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text numberOfLines={1} style={styles.headerTitle}>
              Attendance Radar
            </Text>
          </View>

          {onToggleTorch ? (
            <TouchableOpacity
              style={[styles.navButton, torchActive && styles.navButtonActive]}
              onPress={() => {
                void haptics.selection();
                onToggleTorch();
              }}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={torchActive ? 'Turn off torch' : 'Turn on torch'}
            >
              <MaterialIcons
                name={torchActive ? 'flash-on' : 'flash-off'}
                size={20}
                color={DARK_TOKENS.textPrimary}
              />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* Outcome-Driven GPS Banding Advisory Pill */}
        <View style={styles.gpsPillContainer}>
          <View style={[styles.gpsPill, gpsPillStyle]}>
            <MaterialIcons
              name={gpsIcon}
              size={14}
              color={
                gpsState === 'READY'
                  ? DARK_TOKENS.badgeTextEmerald
                  : gpsState === 'ERROR'
                  ? DARK_TOKENS.badgeTextRed
                  : DARK_TOKENS.badgeTextAmber
              }
            />
            <Text style={[styles.gpsPillText, gpsPillTextStyle]}>{gpsPillLabel}</Text>
          </View>
        </View>
      </View>

      {/* Reticle Viewfinder */}
      <View style={styles.reticleContainer} pointerEvents="none">
        <View style={styles.reticleBox}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <View style={styles.reticleInstruction}>
          <Text style={styles.instructionText}>Align session QR code within frame</Text>
        </View>
      </View>

      {/* Bottom Scrim */}
      <View style={styles.bottomScrim} pointerEvents="box-none">
        {showTelemetry && (
          <View style={styles.telemetryRow}>
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>Scan target</Text>
              <Text numberOfLines={1} style={styles.telemetryValue}>
                {eventTitle ? eventTitle : 'Active session code'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actionsContainer}>
          {/* Standing Secondary Link: Request Assisted Check-In */}
          <TouchableOpacity
            style={styles.assistedBtn}
            onPress={() => {
              void haptics.selection();
              setShowAssistedModal(true);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Request assisted check-in"
          >
            <Text style={styles.assistedBtnText}>Request assisted check-in</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Assisted Check-In Static Modal */}
      <Modal
        visible={showAssistedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssistedModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assisted Check-In</Text>
            <Text style={styles.modalBody}>
              If camera scanning or venue GPS fix is impaired, please present your physical university
              student ID card to an event organizer at the venue entrance to verify your attendance.
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowAssistedModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ScannerOverlay;
