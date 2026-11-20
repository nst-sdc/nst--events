import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp, Text, Platform } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { ActivityIndicator } from './core/ActivityIndicator';
import { haptics } from '../lib/haptics';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Button = ({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  accessibilityLabel,
  accessibilityRole = 'button',
  style,
  testID,
}: ButtonProps) => {
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    base: {
      minHeight: 48,
      height: 52,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical: 14,
      borderWidth: 1,
      borderRadius: theme.radii.md,
      ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
    },
    label: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 16,
      lineHeight: 22,
      letterSpacing: -0.2,
      textAlign: 'center',
    },
    primary: {
      backgroundColor: theme.colors.brandPrimary,
      borderColor: theme.colors.brandPrimary,
    },
    primaryText: {
      color: theme.colors.onSolidText,
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderSubtle,
    },
    secondaryText: {
      color: theme.colors.textPrimary,
    },
    danger: {
      backgroundColor: theme.colors.solidRed,
      borderColor: theme.colors.solidRed,
    },
    dangerText: {
      color: theme.colors.onSolidText,
    },
    disabled: {
      backgroundColor: theme.colors.surfaceSubtle,
      borderColor: theme.colors.borderSubtle,
      opacity: 0.7,
    },
    disabledText: {
      color: theme.colors.textMuted,
    }
  }), [theme]);

  let containerStyle = styles.primary;
  let textStyle = styles.primaryText;

  if (variant === 'secondary') {
    containerStyle = styles.secondary;
    textStyle = styles.secondaryText;
  } else if (variant === 'danger') {
    containerStyle = styles.danger;
    textStyle = styles.dangerText;
  }

  const handlePress = () => {
    if (disabled || loading) return;
    void haptics.impactMedium();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      style={[
        styles.base,
        containerStyle,
        disabled && styles.disabled,
        style
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? theme.colors.onSolidText : theme.colors.brandPrimary} />
      ) : (
        <Text style={[styles.label, textStyle, disabled && styles.disabledText]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
