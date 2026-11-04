import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../store/theme-store';
import { useOtaUpdates } from '../hooks/use-ota-updates';
import { usePlayInAppUpdates } from '../hooks/use-play-in-app-updates';

export const AppUpdateNotifier: React.FC = () => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const ota = useOtaUpdates();
  const play = usePlayInAppUpdates();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: 'absolute',
          bottom: Math.max(insets.bottom + 64, 80),
          left: 16,
          right: 16,
          zIndex: 9999,
          backgroundColor: theme.colors.surfaceContainerHighest,
          borderWidth: 2,
          borderColor: theme.colors.outline,
          padding: 14,
          shadowColor: '#000000',
          shadowOffset: { width: 3, height: 3 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 6,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        },
        badgeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        badge: {
          backgroundColor: theme.colors.primary,
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
        badgeText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 10,
          color: theme.colors.onPrimary,
          letterSpacing: 0.8,
        },
        title: {
          fontFamily: theme.typography.syneBold,
          fontSize: 13,
          color: theme.colors.onSurface,
          letterSpacing: 0.5,
        },
        dismissButton: {
          paddingHorizontal: 8,
          paddingVertical: 4,
        },
        dismissText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
        },
        message: {
          fontFamily: theme.typography.interRegular,
          fontSize: 12,
          color: theme.colors.onSurfaceVariant,
          marginBottom: 10,
          lineHeight: 16,
        },
        buttonRow: {
          flexDirection: 'row',
          gap: 8,
        },
        actionButton: {
          flex: 1,
          backgroundColor: theme.colors.primary,
          paddingVertical: 8,
          paddingHorizontal: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: theme.colors.outline,
        },
        actionButtonText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 11,
          color: theme.colors.onPrimary,
          letterSpacing: 0.5,
        },
        dismissAction: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.outline,
          alignItems: 'center',
          justifyContent: 'center',
        },
        dismissActionText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 11,
          color: theme.colors.onSurface,
        },
      }),
    [theme, insets]
  );

  // Play Store In-App Updates take precedence if downloaded or available
  if (play.canShowFlexiblePrompt) {
    return (
      <View style={styles.container} testID="play-update-banner">
        <View style={styles.headerRow}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>PLAY STORE</Text>
            </View>
            <Text style={styles.title}>UPDATE AVAILABLE</Text>
          </View>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={play.dismiss}
            accessibilityLabel="Dismiss update notification"
          >
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.message}>
          {play.isDownloaded
            ? 'New version downloaded from Google Play. Restart to complete update.'
            : 'A new release is available on Google Play. Download in background now?'}
        </Text>

        <View style={styles.buttonRow}>
          {play.isDownloaded ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={play.completeUpdate}
              accessibilityRole="button"
            >
              <Text style={styles.actionButtonText}>RESTART TO APPLY →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={play.startFlexibleUpdate}
              disabled={play.isDownloading}
              accessibilityRole="button"
            >
              {play.isDownloading ? (
                <ActivityIndicator size="small" color={theme.colors.onPrimary} />
              ) : (
                <Text style={styles.actionButtonText}>DOWNLOAD IN BACKGROUND →</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.dismissAction}
            onPress={play.dismiss}
            accessibilityRole="button"
          >
            <Text style={styles.dismissActionText}>LATER</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Next, check for OTA update
  if (ota.canShowNotification) {
    return (
      <View style={styles.container} testID="ota-update-banner">
        <View style={styles.headerRow}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>OTA UPDATE</Text>
            </View>
            <Text style={styles.title}>CAMPUS SYSTEM SYNC</Text>
          </View>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={ota.dismiss}
            accessibilityLabel="Dismiss update banner"
          >
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.message}>
          {ota.isDownloaded
            ? 'Update ready! Restart NST Events to apply the latest changes.'
            : 'A compatible feature & event update is ready to download.'}
        </Text>

        <View style={styles.buttonRow}>
          {ota.isDownloaded ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={ota.applyUpdate}
              accessibilityRole="button"
            >
              <Text style={styles.actionButtonText}>RESTART NOW →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={ota.downloadUpdate}
              disabled={ota.isDownloading}
              accessibilityRole="button"
            >
              {ota.isDownloading ? (
                <ActivityIndicator size="small" color={theme.colors.onPrimary} />
              ) : (
                <Text style={styles.actionButtonText}>DOWNLOAD UPDATE →</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.dismissAction}
            onPress={ota.dismiss}
            accessibilityRole="button"
          >
            <Text style={styles.dismissActionText}>LATER</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
};

