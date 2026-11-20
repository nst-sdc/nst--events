import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  Insets,
  Text,
} from 'react-native';
import { useAppTheme } from '../store/theme-store';

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
          paddingVertical: 7,
          paddingHorizontal: 14,
          borderRadius: theme.radii.full,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          backgroundColor: theme.colors.surfaceSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        },
        filterActive: {
          borderColor: theme.colors.brandPrimary,
          backgroundColor: theme.colors.brandPrimary,
        },
        filterText: {
          fontSize: 13,
          lineHeight: 18,
          color: theme.colors.textSecondary,
          fontFamily: theme.typography.interMedium,
        },
        filterTextActive: {
          color: theme.colors.onSolidText,
          fontFamily: theme.typography.interSemiBold,
        },

        // Directory Shortcut Chip
        shortcutBase: {
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: theme.radii.full,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          backgroundColor: theme.colors.surfaceSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        },
        shortcutText: {
          fontSize: 12,
          lineHeight: 16,
          fontFamily: theme.typography.interSemiBold,
          color: theme.colors.brandText,
        },

        // Segment Control Button
        segmentBase: {
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: theme.radii.full,
          alignItems: 'center',
          justifyContent: 'center',
        },
        segmentActive: {
          backgroundColor: theme.colors.surfaceElevated,
        },
        segmentText: {
          fontSize: 12,
          lineHeight: 16,
          color: theme.colors.textMuted,
          fontFamily: theme.typography.interMedium,
        },
        segmentTextActive: {
          color: theme.colors.brandText,
          fontFamily: theme.typography.interSemiBold,
        },

        disabled: {
          opacity: 0.5,
        },
      }),
    [theme]
  );

  let containerStyle: StyleProp<ViewStyle> = styles.filterBase;
  let labelStyle: StyleProp<TextStyle> = styles.filterText;

  if (variant === 'shortcut') {
    containerStyle = styles.shortcutBase;
    labelStyle = styles.shortcutText;
  } else if (variant === 'segment') {
    containerStyle = styles.segmentBase;
    labelStyle = styles.segmentText;
    if (selected) {
      containerStyle = [styles.segmentBase, styles.segmentActive];
      labelStyle = [styles.segmentText, styles.segmentTextActive];
    }
  } else {
    // Default: 'filter'
    if (selected) {
      containerStyle = [styles.filterBase, styles.filterActive];
      labelStyle = [styles.filterText, styles.filterTextActive];
    }
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        selected: selected,
        disabled: disabled,
      }}
      accessibilityLabel={
        accessibilityLabel ||
        (label ? label.replace(/^\[\s*|\s*\]$/g, '').trim() : undefined)
      }
      testID={testID}
      style={[containerStyle, disabled && styles.disabled, style]}
    >
      <Text style={[labelStyle, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
};

export default FilterChip;
