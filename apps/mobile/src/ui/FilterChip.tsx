import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  Insets,
} from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { Mono } from './core/Typography';

export interface FilterChipProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  variant?: 'filter' | 'shortcut' | 'segment';
  accessibilityRole?: 'button' | 'tab' | 'checkbox' | 'radio';
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  hitSlop?: Insets;
}

// Default hitSlop to ensure all chips meet the minimum 44x44pt (iOS) / 48x48dp (Android) touch target requirement
const DEFAULT_HIT_SLOP: Insets = {
  top: 12,
  bottom: 12,
  left: 8,
  right: 8,
};

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  onPress,
  selected = false,
  disabled = false,
  variant = 'filter',
  accessibilityRole = 'button',
  accessibilityLabel,
  testID,
  style,
  textStyle,
  hitSlop = DEFAULT_HIT_SLOP,
}) => {
  const theme = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Base Filter Chip
        filterBase: {
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surfaceContainerLow,
          alignItems: 'center',
          justifyContent: 'center',
        },
        filterActive: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary,
        },
        filterText: {
          fontSize: 10,
          color: theme.colors.onSurfaceVariant,
          fontFamily: theme.typography.monoBold,
          letterSpacing: 0.5,
        },
        filterTextActive: {
          color: theme.colors.onPrimary,
        },

        // Directory Shortcut Chip
        shortcutBase: {
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          backgroundColor: theme.colors.surfaceContainerLow,
          alignItems: 'center',
          justifyContent: 'center',
        },
        shortcutText: {
          fontSize: 10,
          fontFamily: theme.typography.monoBold,
          color: theme.colors.primary,
        },

        // Segment Control Button
        segmentBase: {
          paddingVertical: 6,
          paddingHorizontal: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        segmentActive: {
          backgroundColor: theme.colors.surfaceContainerHighest,
        },
        segmentText: {
          fontSize: 10,
          color: theme.colors.onSurfaceVariant,
          fontFamily: theme.typography.monoBold,
        },
        segmentTextActive: {
          color: theme.colors.primary,
        },

        disabled: {
          opacity: 0.5,
        },
      }),
    [theme]
  );

  let containerStyle: StyleProp<ViewStyle> = styles.filterBase;
  let activeContainerStyle: StyleProp<ViewStyle> = styles.filterActive;
  let labelStyle: StyleProp<TextStyle> = styles.filterText;
  let activeLabelStyle: StyleProp<TextStyle> = styles.filterTextActive;

  if (variant === 'shortcut') {
    containerStyle = styles.shortcutBase;
    activeContainerStyle = styles.shortcutBase;
    labelStyle = styles.shortcutText;
    activeLabelStyle = styles.shortcutText;
  } else if (variant === 'segment') {
    containerStyle = styles.segmentBase;
    activeContainerStyle = styles.segmentActive;
    labelStyle = styles.segmentText;
    activeLabelStyle = styles.segmentTextActive;
  }

  const resolvedAccessibilityLabel =
    accessibilityLabel ||
    (variant === 'shortcut'
      ? label.replace(/[\[\]]/g, '').trim()
      : label);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityState={{
        selected: selected,
        disabled: disabled,
      }}
      testID={testID}
      style={[
        containerStyle,
        selected && activeContainerStyle,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Mono
        style={[
          labelStyle,
          selected && activeLabelStyle,
          textStyle,
        ]}
      >
        {label}
      </Mono>
    </TouchableOpacity>
  );
};
