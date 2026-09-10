import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useAppTheme } from '../../store/theme-store';
import { DEV_CLUB_NAME } from '../../infrastructure/brand-config';

interface DevClubBadgeProps {
  variant?: 'terminal' | 'signature' | 'compact';
  size?: 'sm' | 'md';
  style?: ViewStyle;
  onPress?: () => void;
}

export function DevClubBadge({
  variant = 'terminal',
  size = 'md',
  style,
  onPress,
}: DevClubBadgeProps) {
  const theme = useAppTheme();

  const isSmall = size === 'sm';
  const fontSize = isSmall ? 10 : 11;
  const paddingVertical = isSmall ? 3 : 5;
  const paddingHorizontal = isSmall ? 8 : 10;

  if (variant === 'signature') {
    const content = (
      <View style={[styles.signatureContainer, style]}>
        <Text
          style={[
            styles.signatureText,
            {
              color: theme.colors.onSurfaceVariant,
              fontFamily: theme.typography.monoMedium,
              fontSize,
            },
          ]}
        >
          CRAFTED BY{' '}
          <Text
            style={{
              color: theme.colors.primary,
              fontFamily: theme.typography.monoBold,
            }}
          >
            {DEV_CLUB_NAME.toUpperCase()}
          </Text>
        </Text>
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {content}
        </TouchableOpacity>
      );
    }
    return content;
  }

  const labelText = variant === 'compact' ? '[ NST/DEV ]' : `[ ${DEV_CLUB_NAME.toUpperCase()} ]`;

  const badgeBox = (
    <View
      style={[
        styles.terminalBadge,
        {
          backgroundColor: theme.colors.surfaceContainerLow,
          borderColor: theme.colors.borderHairline,
          paddingVertical,
          paddingHorizontal,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.terminalText,
          {
            color: theme.colors.primary,
            fontFamily: theme.typography.monoBold,
            fontSize,
          },
        ]}
      >
        {labelText}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {badgeBox}
      </TouchableOpacity>
    );
  }

  return badgeBox;
}

const styles = StyleSheet.create({
  signatureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signatureText: {
    letterSpacing: 0.8,
  },
  terminalBadge: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalText: {
    letterSpacing: 1,
  },
});
