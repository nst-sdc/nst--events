import React from 'react';
import { View, Text, TouchableOpacity, Modal as RNModal } from 'react-native';
import { ActivityIndicator } from './core/ActivityIndicator';
import { Button as CoreButton } from './Button';
import { TextField } from './core/TextField';
import { StatusBadge } from './core/StatusBadge';
import { MonoLabel, Title, Body } from './core/Typography';
import { theme } from './theme';

export const Button = CoreButton;

export const Card = ({ children }: { children: React.ReactNode }) => (
  <View
    style={{
      padding: theme.spacing.base,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      marginBottom: theme.spacing.md,
      borderRadius: 0,
    }}
  >
    {children}
  </View>
);

export const Input = ({ value, onChangeText, placeholder, secureTextEntry }: any) => (
  <TextField
    label={placeholder || ''}
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    secureTextEntry={secureTextEntry}
  />
);

export const Spinner = ({ color, size = 'small' }: any) => (
  <ActivityIndicator color={color} size={size} accessibilityRole="progressbar" accessibilityLabel="Loading" />
);

export const Divider = () => (
  <View style={{ height: 1, backgroundColor: theme.colors.borderHairline, marginVertical: theme.spacing.base, width: '100%' }} />
);

export const Badge = ({ text, type = 'default' }: any) => (
  <StatusBadge status={text} type={type} />
);

export const EmptyState = ({ title, message }: any) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl, gap: theme.spacing.sm }}>
    <Title style={{ textAlign: 'center' }}>{title}</Title>
    <Body style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>{message}</Body>
  </View>
);

export const Modal = ({ visible, onClose, title, children }: any) => (
  <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.base }}>
      <View
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        }}
      >
        <MonoLabel style={{ fontSize: 13, color: theme.colors.primary }}>[{title.toUpperCase()}]</MonoLabel>
        {children}
        <CoreButton title="[ CLOSE ]" onPress={onClose} variant="secondary" />
      </View>
    </View>
  </RNModal>
);

export const Dialog = Modal;

