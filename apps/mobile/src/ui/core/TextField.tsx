import React, { useMemo } from 'react';
import { View, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useAppTheme } from '../../store/theme-store';
import { MonoLabel, Mono } from './Typography';

interface TextFieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  error?: string | null;
  helperText?: string;
}

export function TextField({ label, required, error, helperText, style, ...props }: TextFieldProps) {
  const theme = useAppTheme();

  const styles = useMemo(() => StyleSheet.create({
    label: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceContainerLowest,
      color: theme.colors.onSurface,
      fontFamily: theme.typography.monoRegular,
      fontSize: 14,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      minHeight: theme.spacing.touchMin,
    },
    inputError: {
      borderColor: theme.colors.error,
    },
    error: {
      fontSize: 10,
      color: theme.colors.error,
    },
    helper: {
      fontSize: 10,
      color: theme.colors.outline,
    },
  }), [theme]);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <MonoLabel style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </MonoLabel>
      <TextInput
        placeholderTextColor={theme.colors.outline}
        style={[styles.input, !!error && styles.inputError, style]}
        {...props}
      />
      {error ? (
        <Mono style={styles.error}>{error}</Mono>
      ) : helperText ? (
        <Mono style={styles.helper}>{helperText}</Mono>
      ) : null}
    </View>
  );
}
