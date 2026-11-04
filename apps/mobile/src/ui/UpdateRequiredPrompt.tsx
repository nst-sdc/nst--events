import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform, Linking } from "react-native";
import Constants from "expo-constants";
import { useAppTheme } from "../store/theme-store";
import { Button } from "./Button";

export const APP_BUILD_VERSION = Constants.expoConfig?.version || "1.0.0";

export interface UpdateRequiredPromptProps {
  minVersion?: string | null;
  onRetry?: () => void;
}

// TODO: Update these placeholder store IDs / bundle identifiers once the deferred EAS org migration
// happens and live Google Play Store and Apple App Store listings exist.
const PLAY_STORE_URI = "market://details?id=org.nstsdc.events";
const PLAY_STORE_WEB_URL =
  "https://play.google.com/store/apps/details?id=org.nstsdc.events";
const APP_STORE_URL = "https://apps.apple.com/app/nst-events/id6740123456";

export async function openAppStore(): Promise<void> {
  const url = Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URI;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
    if (Platform.OS === "android") {
      await Linking.openURL(PLAY_STORE_WEB_URL);
      return;
    }
  } catch {
    if (Platform.OS === "android") {
      await Linking.openURL(PLAY_STORE_WEB_URL).catch(() => {});
    }
  }
}

export async function triggerMandatoryUpdate(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      const { startImmediatePlayUpdate } = require("play-in-app-updates");
      const started = await startImmediatePlayUpdate();
      if (started) {
        return;
      }
    } catch {
      // Fallback to Play Store URL
    }
  }
  await openAppStore();
}

export const UpdateRequiredPrompt: React.FC<UpdateRequiredPromptProps> = ({
  minVersion,
  onRetry,
}) => {
  const theme = useAppTheme();

  React.useEffect(() => {
    // Attempt official Play Core immediate update flow on Android
    if (Platform.OS === "android") {
      triggerMandatoryUpdate().catch(() => {});
    }
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: theme.spacing.xl,
          backgroundColor: theme.colors.surface,
        },
        badge: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.borderRadius.sm,
          backgroundColor: theme.colors.errorContainer,
          marginBottom: theme.spacing.base,
        },
        badgeText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 11,
          color: theme.colors.onErrorContainer,
          letterSpacing: 1,
        },
        title: {
          fontFamily: theme.typography.syneBold,
          fontSize: 22,
          color: theme.colors.onSurface,
          textAlign: "center",
          marginBottom: theme.spacing.sm,
        },
        message: {
          fontFamily: theme.typography.interRegular,
          fontSize: 14,
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          lineHeight: 20,
          marginBottom: theme.spacing.lg,
          maxWidth: 320,
        },
        versionDetails: {
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.surfaceContainerLow,
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          marginBottom: theme.spacing.xl,
        },
        versionText: {
          fontFamily: theme.typography.monoRegular,
          fontSize: 12,
          color: theme.colors.onSurface,
        },
        buttonContainer: {
          width: "100%",
          maxWidth: 280,
          gap: theme.spacing.md,
        },
        instructionText: {
          marginTop: theme.spacing.lg,
          fontFamily: theme.typography.interRegular,
          fontSize: 12,
          color: theme.colors.outline,
          textAlign: "center",
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container} testID="update-required-screen">
      <View style={styles.badge}>
        <Text style={styles.badgeText}>UPGRADE REQUIRED (426)</Text>
      </View>

      <Text style={styles.title}>UPDATE REQUIRED</Text>

      <Text style={styles.message}>
        A newer version of NST Events is required to connect to campus services.
        Please update your app to the latest release to continue.
      </Text>

      <View style={styles.versionDetails}>
        <Text style={styles.versionText}>
          Installed: v{APP_BUILD_VERSION} · Required: ≥ v
          {minVersion || "latest"}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="UPDATE IN STORE"
          onPress={triggerMandatoryUpdate}
          variant="primary"
          accessibilityLabel="Open app store to update NST Events"
        />

        {onRetry && (
          <Button
            title="TRY AGAIN"
            onPress={onRetry}
            variant="secondary"
            accessibilityLabel="Retry connection after updating"
          />
        )}
      </View>

      <Text style={styles.instructionText}>
        {Platform.OS === "ios"
          ? "If testing via TestFlight, open TestFlight to accept the update."
          : "Or download the latest APK from the student developer portal."}
      </Text>
    </View>
  );
};
