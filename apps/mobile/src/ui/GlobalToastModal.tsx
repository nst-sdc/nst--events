import React, { useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useToastStore } from '../store/toast-store';
import { useAppTheme } from '../store/theme-store';

export const GlobalToastModal: React.FC = () => {
  const activeToast = useToastStore((state) => state.activeToast);
  const hideToast = useToastStore((state) => state.hideToast);
  const theme = useAppTheme();

  // Auto-dismiss after 6 seconds if not manually interacted with
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      hideToast();
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeToast, hideToast]);

  const statusConfig = useMemo(() => {
    if (!activeToast) return null;
    switch (activeToast.type) {
      case 'success':
        return {
          borderColor: '#0057FF',
          accentColor: '#4ade80',
          badgeText: '[PASS CONFIRMED // ACTIVE]',
          defaultTitle: 'REGISTRATION CONFIRMED',
          code: '0x200_CONFIRMED',
        };
      case 'error':
        return {
          borderColor: theme.colors.error,
          accentColor: theme.colors.error,
          badgeText: '[OPERATION FAILED // ERROR]',
          defaultTitle: 'ACTION FAILED',
          code: '0x400_FAULT',
        };
      case 'info':
      default:
        return {
          borderColor: theme.colors.secondary,
          accentColor: theme.colors.secondary,
          badgeText: '[SYSTEM NOTICE // INFO]',
          defaultTitle: 'NOTICE',
          code: '0x100_INFO',
        };
    }
  }, [activeToast, theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.78)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        },
        cardContainer: {
          width: '100%',
          maxWidth: 380,
          backgroundColor: theme.colors.surfaceContainerLowest,
          borderWidth: 2,
          borderRadius: 0,
          padding: 24,
          shadowColor: '#000000',
          shadowOffset: { width: 6, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 10,
        },
        telemetryHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderHairline,
        },
        telemetryText: {
          fontFamily: theme.typography.monoRegular,
          fontSize: 10,
          color: theme.colors.outline,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
        badgeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
        },
        statusDot: {
          width: 8,
          height: 8,
          borderRadius: 0,
        },
        badgeText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
        title: {
          fontFamily: theme.typography.syneBold,
          fontSize: 22,
          color: theme.colors.onSurface,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 10,
        },
        message: {
          fontFamily: theme.typography.interRegular,
          fontSize: 14,
          lineHeight: 22,
          color: theme.colors.onSurfaceVariant,
          marginBottom: 20,
        },
        ledgerBox: {
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          padding: 12,
          marginBottom: 20,
          gap: 6,
        },
        ledgerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        ledgerLabel: {
          fontFamily: theme.typography.monoRegular,
          fontSize: 10,
          color: theme.colors.outline,
          letterSpacing: 0.5,
        },
        ledgerValue: {
          fontFamily: theme.typography.monoBold,
          fontSize: 10,
          letterSpacing: 0.5,
        },
        actionButton: {
          height: 48,
          backgroundColor: '#0057FF',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 0,
          borderWidth: 1,
          borderColor: '#0057FF',
        },
        actionButtonText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 13,
          color: '#ffffff',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        },
      }),
    [theme]
  );

  if (!activeToast || !statusConfig) return null;

  const displayTitle = activeToast.title || statusConfig.defaultTitle;

  return (
    <Modal
      visible={!!activeToast}
      transparent
      animationType="fade"
      onRequestClose={hideToast}
    >
      <Pressable style={styles.backdrop} onPress={hideToast}>
        <Pressable
          style={[
            styles.cardContainer,
            { borderColor: statusConfig.borderColor },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Cyber Telemetry Header */}
          <View style={styles.telemetryHeader}>
            <Text style={styles.telemetryText}>
              + [{statusConfig.code}]
            </Text>
            <Text style={styles.telemetryText}>NST_SYSTEMS // AUDIT</Text>
          </View>

          {/* Status Badge */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: statusConfig.accentColor },
              ]}
            />
            <Text
              style={[
                styles.badgeText,
                { color: statusConfig.accentColor },
              ]}
            >
              {statusConfig.badgeText}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{displayTitle}</Text>

          {/* Message Body */}
          <Text style={styles.message}>{activeToast.message}</Text>

          {/* Technical Ledger Box */}
          <View style={styles.ledgerBox}>
            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>SYSTEM STATE</Text>
              <Text
                style={[
                  styles.ledgerValue,
                  { color: statusConfig.accentColor },
                ]}
              >
                VERIFIED & COMMITTED
              </Text>
            </View>
            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>VAULT RECORD</Text>
              <Text
                style={[
                  styles.ledgerValue,
                  { color: theme.colors.onSurface },
                ]}
              >
                ID #{activeToast.id.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* High-Contrast Neo-Brutalist Action Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={hideToast}
            activeOpacity={0.85}
          >
            <Text style={styles.actionButtonText}>[ OK // PROCEED → ]</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

