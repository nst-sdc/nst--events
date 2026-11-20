import React, { useMemo } from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useAppTheme } from '../../store/theme-store';

interface BaseTextProps extends TextProps {
  children: React.ReactNode;
}

export function Display({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.display, style]} {...props}>{children}</Text>;
}

export function Title({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.title, style]} {...props}>{children}</Text>;
}

export function Headline({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.headline, style]} {...props}>{children}</Text>;
}

export function Body({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.body, style]} {...props}>{children}</Text>;
}

export function BodyMedium({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.bodyMedium, style]} {...props}>{children}</Text>;
}

export function Callout({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.callout, style]} {...props}>{children}</Text>;
}

export function Caption({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.caption, style]} {...props}>{children}</Text>;
}

export function Overline({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.overline, style]} {...props}>{children}</Text>;
}

export function Mono({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.mono, style]} {...props}>{children}</Text>;
}

export function MonoLabel({ children, style, ...props }: BaseTextProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={[styles.monoLabel, style]} {...props}>{children}</Text>;
}

const makeStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  display: {
    fontFamily: theme.typography.interBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: theme.colors.textPrimary,
  },
  title: {
    fontFamily: theme.typography.interBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
  },
  headline: {
    fontFamily: theme.typography.interSemiBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
  },
  body: {
    fontFamily: theme.typography.interRegular,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  bodyMedium: {
    fontFamily: theme.typography.interMedium,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  callout: {
    fontFamily: theme.typography.interMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: theme.colors.textSecondary,
  },
  caption: {
    fontFamily: theme.typography.interRegular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    color: theme.colors.textMuted,
  },
  overline: {
    fontFamily: theme.typography.interBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  mono: {
    fontFamily: theme.typography.monoMedium,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  monoLabel: {
    fontFamily: theme.typography.interBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
  },
});
