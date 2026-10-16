import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { MonoLabel } from './core/Typography';
import { ActivityIndicator } from './core/ActivityIndicator';

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
      minHeight: 52,
      height: 52,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical: 14,
      borderWidth: 1,
      borderRadius: 0,
    },
    label: {
      fontSize: 13,
      letterSpacing: 1.2,
      textAlign: 'center',
    },
    primary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    primaryText: {
      color: theme.colors.onPrimary,
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
    },
    secondaryText: {
      color: theme.colors.onSurface,
    },
    danger: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.error,
    },
    dangerText: {
      color: theme.colors.error,
    },
    disabled: {
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderColor: theme.colors.outlineVariant,
      opacity: 0.5,
    },
    disabledText: {
      color: theme.colors.outline,
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

  return (
    <TouchableOpacity 
      onPress={onPress} 
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
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? theme.colors.surface : theme.colors.primary} />
      ) : (
        <MonoLabel style={[styles.label, textStyle, disabled && styles.disabledText]}>{title}</MonoLabel>
      )}
    </TouchableOpacity>
  );
};
