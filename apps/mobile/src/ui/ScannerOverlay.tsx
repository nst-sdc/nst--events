import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../store/theme-store';
import { MonoLabel, Mono } from './core/Typography';

interface ScannerOverlayProps {
  onClose: () => void;
  onToggleTorch?: () => void;
  torchActive?: boolean;
  eventTitle?: string;
  gpsState?: 'ACQUIRING' | 'READY' | 'WEAK' | 'ERROR';
  gpsAccuracy?: number | null;
  showTelemetry?: boolean;
}

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
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'space-between',
    },
    headerWrapper: {
      backgroundColor: theme.colors.surface,
      paddingTop: Math.max(insets.top, 8),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      zIndex: 10,
    },
    header: {
      paddingVertical: 12,
      paddingHorizontal: theme.spacing.base,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: theme.spacing.md,
    },
    backText: {
      color: theme.colors.primary,
    },
    titleContainer: {
      flex: 1,
    },
    brandTitle: {
      color: theme.colors.onSurfaceVariant,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerBtn: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBtnActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
    },
    headerBtnText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 10,
    },
    headerBtnTextActive: {
      color: theme.colors.primary,
      fontSize: 10,
    },
    reticleContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 'auto',
    },
    reticleBox: {
      width: 260,
      height: 260,
      position: 'relative',
      borderWidth: 1,
      borderColor: 'rgba(183, 196, 255, 0.18)',
    },
    corner: {
      position: 'absolute',
      width: 24,
      height: 24,
      borderColor: theme.colors.primary,
    },
    topLeft: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
    topRight: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
    bottomLeft: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
    bottomRight: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
    reticleInstruction: {
      marginTop: 20,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      backgroundColor: 'rgba(19, 19, 19, 0.85)',
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    instructionText: {
      color: theme.colors.onSurface,
      fontSize: 11,
      letterSpacing: 1.5,
    },
    footerWrapper: {
      backgroundColor: 'rgba(19, 19, 19, 0.88)',
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
      paddingHorizontal: theme.spacing.base,
      paddingTop: 12,
      paddingBottom: Math.max(insets.bottom, 12),
    },
    footerGrid: {
      flexDirection: 'row',
    },
    footerCol: {
      flex: 1,
    },
    footerColRight: {
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.borderHairline,
      paddingLeft: theme.spacing.base,
    },
    footerLabel: {
      color: theme.colors.outline,
      fontSize: 10,
      marginBottom: 2,
    },
    footerValue: {
      fontSize: 12,
      color: theme.colors.onSurface,
    },
    footerValueActive: {
      fontSize: 12,
      color: theme.colors.secondary,
    },
    footerValuePending: {
      fontSize: 12,
      color: theme.colors.outline,
    },
    footerValueWarning: {
      fontSize: 12,
      color: '#ffb77b',
    },
    footerValueError: {
      fontSize: 12,
      color: theme.colors.error,
    },
  }), [theme, insets]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.headerWrapper}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.8}>
            <MonoLabel style={styles.backText}>← BACK</MonoLabel>
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <MonoLabel numberOfLines={1} style={styles.brandTitle}>
              {'/   SCAN QR'}
            </MonoLabel>
          </View>

          <View style={styles.headerRight}>
            {onToggleTorch && (
              <TouchableOpacity
                style={[styles.headerBtn, torchActive && styles.headerBtnActive]}
                onPress={onToggleTorch}
                activeOpacity={0.8}
              >
                <MonoLabel style={torchActive ? styles.headerBtnTextActive : styles.headerBtnText}>
                  {torchActive ? '[ ⚡ ON ]' : '[ ⚡ OFF ]'}
                </MonoLabel>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.headerBtn} onPress={onClose} activeOpacity={0.8}>
              <MonoLabel style={styles.headerBtnText}>[ ✕ ]</MonoLabel>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.reticleContainer} pointerEvents="none">
        <View style={styles.reticleBox}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <View style={styles.reticleInstruction}>
          <MonoLabel style={styles.instructionText}>[ ALIGN QR CODE WITHIN RETICLE ]</MonoLabel>
        </View>
      </View>

      {showTelemetry && (
        <View style={styles.footerWrapper} pointerEvents="none">
          <View style={styles.footerGrid}>
            <View style={styles.footerCol}>
              <MonoLabel style={styles.footerLabel}>SCAN TARGET</MonoLabel>
              <Mono numberOfLines={1} style={styles.footerValue}>
                {eventTitle ? eventTitle.toUpperCase() : 'SESSION QR'}
              </Mono>
            </View>
            <View style={[styles.footerCol, styles.footerColRight]}>
              <MonoLabel style={styles.footerLabel}>GPS GEOFENCE</MonoLabel>
              <Mono
                numberOfLines={1}
                style={
                  gpsState === 'READY'
                    ? styles.footerValueActive
                    : gpsState === 'WEAK'
                    ? styles.footerValueWarning
                    : gpsState === 'ERROR'
                    ? styles.footerValueError
                    : styles.footerValuePending
                }
              >
                {gpsState === 'READY'
                  ? `READY (±${gpsAccuracy ?? 0}m)`
                  : gpsState === 'WEAK'
                  ? `WEAK FIX (±${gpsAccuracy ?? 0}m)`
                  : gpsState === 'ERROR'
                  ? 'NO GPS FIX'
                  : 'ACQUIRING FIX...'}
              </Mono>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};
