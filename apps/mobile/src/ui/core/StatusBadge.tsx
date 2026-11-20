import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../store/theme-store';

interface StatusBadgeProps {
  status: string;
  type?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function StatusBadge({ status, type = 'default' }: StatusBadgeProps) {
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radii.full,
      borderWidth: 1,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
    },
    text: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.2,
    },

    defaultContainer: {
      backgroundColor: theme.colors.surfaceSubtle,
      borderColor: theme.colors.borderSubtle,
    },
    defaultText: {
      color: theme.colors.textSecondary,
    },

    successContainer: {
      backgroundColor: theme.colors.badgeTintEmerald,
      borderColor: theme.colors.badgeTextEmerald,
    },
    successText: {
      color: theme.colors.badgeTextEmerald,
    },

    warningContainer: {
      backgroundColor: theme.colors.badgeTintAmber,
      borderColor: theme.colors.badgeTextAmber,
    },
    warningText: {
      color: theme.colors.badgeTextAmber,
    },

    errorContainer: {
      backgroundColor: theme.colors.badgeTintRed,
      borderColor: theme.colors.badgeTextRed,
    },
    errorText: {
      color: theme.colors.badgeTextRed,
    },

    infoContainer: {
      backgroundColor: theme.colors.badgeTintCobalt,
      borderColor: theme.colors.badgeTextCobalt,
    },
    infoText: {
      color: theme.colors.badgeTextCobalt,
    }
  }), [theme]);

  let containerStyle = styles.defaultContainer;
  let textStyle = styles.defaultText;

  switch (type) {
    case 'success':
      containerStyle = styles.successContainer;
      textStyle = styles.successText;
      break;
    case 'warning':
      containerStyle = styles.warningContainer;
      textStyle = styles.warningText;
      break;
    case 'error':
      containerStyle = styles.errorContainer;
      textStyle = styles.errorText;
      break;
    case 'info':
      containerStyle = styles.infoContainer;
      textStyle = styles.infoText;
      break;
  }

  return (
    <View style={[styles.badge, containerStyle]}>
      <Text style={[styles.text, textStyle]}>{status}</Text>
    </View>
  );
}
