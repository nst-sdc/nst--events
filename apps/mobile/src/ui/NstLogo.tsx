import React from 'react';
import { View, Image, Text, StyleSheet, ImageStyle, ViewStyle } from 'react-native';

interface NstLogoMarkProps {
  size?: number;
  style?: ImageStyle;
}

export function NstLogoMark({ size = 32, style }: NstLogoMarkProps) {
  return (
    <Image
      source={require('../../assets/logo-mark.png')}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
      accessibilityLabel="NST Events Logo Mark"
    />
  );
}

interface NstLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  style?: ViewStyle;
}

export function NstLogo({ size = 'md', showSubtitle = true, style }: NstLogoProps) {
  const markSize = size === 'sm' ? 24 : size === 'lg' ? 44 : 32;
  const titleSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;

  return (
    <View style={[styles.container, style]}>
      <NstLogoMark size={markSize} />
      <View style={styles.textColumn}>
        <Text style={[styles.title, { fontSize: titleSize }]}>
          NST <Text style={styles.titleAccent}>EVENTS</Text>
        </Text>
        {showSubtitle && (
          <Text style={styles.subtitle}>Newton School of Technology</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textColumn: {
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  titleAccent: {
    color: '#0047FF',
  },
  subtitle: {
    color: '#717487',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
