import React, { useMemo } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Text, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../store/theme-store';
import { getContentBottomInset } from '../theme';
import { useNotificationInbox } from '../../hooks/use-notification-inbox';
import { haptics } from '../../lib/haptics';

interface MobileShellProps {
  children: React.ReactNode;
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  scrollable?: boolean;
  refreshControl?: React.ReactElement<any>;
  showNotificationBell?: boolean;
  rightAction?: React.ReactNode;
  contentContainerStyle?: any;
}

export function MobileShell({
  children,
  title,
  showBackButton = false,
  onBackPress,
  scrollable = true,
  refreshControl,
  showNotificationBell = true,
  rightAction,
  contentContainerStyle: customContentStyle,
}: MobileShellProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useAppTheme();
  const { unreadCount } = useNotificationInbox();

  const handleBack = () => {
    void haptics.selection();
    if (onBackPress) {
      onBackPress();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const isNotificationsScreen = title.toUpperCase() === 'NOTIFICATIONS';

  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.canvas,
    },
    header: {
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.base,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
      backgroundColor: theme.colors.surface,
      zIndex: 10,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      minWidth: 48,
      marginRight: theme.spacing.sm,
    },
    backText: {
      color: theme.colors.brandText,
      fontFamily: theme.typography.monoMedium,
      fontSize: 13,
      letterSpacing: 0.5,
    },
    titleContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    brandTitle: {
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.interBold,
      fontSize: 17,
      letterSpacing: -0.2,
    },
    notifBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      minHeight: 36,
      borderRadius: theme.radii.full,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      backgroundColor: theme.colors.surfaceSubtle,
    },
    notifBtnActive: {
      borderColor: theme.colors.brandPrimary,
      backgroundColor: theme.colors.brandSubtle,
    },
    notifBadge: {
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.interMedium,
      fontSize: 12,
    },
    notifBadgeActive: {
      color: theme.colors.brandPrimary,
      fontFamily: theme.typography.interSemiBold,
      fontSize: 12,
    },
    container: {
      flex: 1,
    },
    content: {
      padding: theme.spacing.base,
      gap: theme.spacing.xl,
    },
  }), [theme]);

  const contentStyle = [
    styles.content,
    { paddingBottom: Math.max(insets.bottom, 12) + 80 },
    customContentStyle,
  ];

  return (
    <View style={[styles.safeArea, { paddingTop: Math.max(insets.top, 8) }]}>
      <StatusBar
        barStyle={theme.mode === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor="transparent"
        translucent
      />

      <View style={styles.header}>
        {showBackButton ? (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>← BACK</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.titleContainer}>
          <Text numberOfLines={1} style={styles.brandTitle}>
            {title}
          </Text>
        </View>

        {rightAction ? (
          rightAction
        ) : showNotificationBell && !isNotificationsScreen ? (
          <TouchableOpacity
            onPress={() => {
              void haptics.selection();
              router.push('/(app)/notifications');
            }}
            style={[styles.notifBtn, unreadCount > 0 && styles.notifBtnActive]}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Notifications inbox"
          >
            <Text style={unreadCount > 0 ? styles.notifBadgeActive : styles.notifBadge}>
              {unreadCount > 0 ? `[INBOX: ${unreadCount}]` : '[INBOX]'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {scrollable ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.container, customContentStyle]}>
          {children}
        </View>
      )}
    </View>
  );
}
