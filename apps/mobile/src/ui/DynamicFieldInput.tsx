import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { MonoLabel } from './core/Typography';
import { TextField } from './core/TextField';

export interface MobileFormField {
  isRequired: boolean;
  fieldDefinitionId: string;
  fieldDefinition: {
    label: string;
    fieldType: string;
    options?: string[] | null;
    isReusable?: boolean;
  };
}

interface DynamicFieldInputProps {
  field: MobileFormField;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
}

export function DynamicFieldInput({ field, value, onChange, disabled, error }: DynamicFieldInputProps) {
  const theme = useAppTheme();
  const def = field.fieldDefinition;
  const options = def.options || [];

  const styles = useMemo(() => StyleSheet.create({
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceContainerLowest,
    },
    optionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    optionDisabled: {
      opacity: 0.5,
    },
    marker: {
      width: 16,
      height: 16,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    markerText: {
      fontSize: 10,
      color: theme.colors.onPrimary,
      fontFamily: theme.typography.monoBold,
    },
    label: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    error: {
      fontSize: 10,
      color: theme.colors.error,
    },
  }), [theme]);

  const isTextLike =
    def.fieldType === 'TEXT' ||
    def.fieldType === 'URL' ||
    def.fieldType === 'EMAIL' ||
    def.fieldType === 'NUMBER' ||
    def.fieldType === 'PHONE';

  if (isTextLike) {
    return (
      <TextField
        label={def.label}
        required={field.isRequired}
        error={error}
        editable={!disabled}
        value={value}
        onChangeText={onChange}
        keyboardType={def.fieldType === 'NUMBER' ? 'numeric' : def.fieldType === 'EMAIL' ? 'email-address' : def.fieldType === 'PHONE' ? 'phone-pad' : def.fieldType === 'URL' ? 'url' : 'default'}
        autoCapitalize={def.fieldType === 'TEXT' ? 'sentences' : 'none'}
        autoCorrect={false}
      />
    );
  }

  const isMulti = def.fieldType === 'MULTI_SELECT';
  let selectedList: string[] = [];
  if (isMulti) {
    try {
      const parsed = value ? JSON.parse(value) : [];
      if (Array.isArray(parsed)) selectedList = parsed;
    } catch {
      selectedList = [];
    }
  }

  const toggle = (option: string) => {
    if (disabled) return;
    if (isMulti) {
      const next = selectedList.includes(option)
        ? selectedList.filter((o) => o !== option)
        : [...selectedList, option];
      onChange(JSON.stringify(next));
    } else {
      onChange(option);
    }
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <MonoLabel style={styles.label}>
        {def.label}
        {field.isRequired ? ' *' : ''}
      </MonoLabel>

      <View style={{ gap: theme.spacing.sm }}>
        {options.map((option, i) => {
          const isSelected = isMulti ? selectedList.includes(option) : value === option;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => toggle(option)}
              disabled={disabled}
              activeOpacity={0.8}
              style={[styles.option, isSelected && styles.optionSelected, disabled && styles.optionDisabled]}
            >
              <View style={[styles.marker, isSelected && styles.markerSelected]}>
                {isSelected && <MonoLabel style={styles.markerText}>{isMulti ? 'X' : ''}</MonoLabel>}
              </View>
              <MonoLabel style={{ color: theme.colors.onSurface }}>{option}</MonoLabel>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <MonoLabel style={styles.error}>{error}</MonoLabel> : null}
    </View>
  );
}
