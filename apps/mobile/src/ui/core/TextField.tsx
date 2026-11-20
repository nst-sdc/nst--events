import React, { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, TextInputProps, Text, Platform } from 'react-native';
import { useAppTheme } from '../../store/theme-store';

interface TextFieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  error?: string | null;
  helperText?: string;
}

export function TextField({
  label,
  required,
  error,
  helperText,
  style,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const theme = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      gap: theme.spacing.xs,
    },
    label: {
      fontFamily: theme.typography.interMedium,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.borderInput,
      backgroundColor: theme.colors.surfaceSubtle,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.interRegular,
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      minHeight: 48,
      borderRadius: theme.radii.md,
      ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : {}),
    },
    inputFocused: {
      borderColor: theme.colors.focusBorder,
      borderWidth: 2,
      paddingHorizontal: theme.spacing.md - 1, // Compensate for 2px border
      paddingVertical: 11,
    },
    inputError: {
      borderColor: theme.colors.errorBorder,
      borderWidth: 2,
      paddingHorizontal: theme.spacing.md - 1,
      paddingVertical: 11,
    },
    error: {
      fontFamily: theme.typography.interRegular,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.errorText,
    },
    helper: {
      fontFamily: theme.typography.interRegular,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textMuted,
    },
  }), [theme]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        placeholderTextColor={theme.colors.placeholderText}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
          style,
        ]}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

export default TextField;
