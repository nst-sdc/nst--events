import React, { useState, useMemo } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../store/theme-store';
import { Title, Body, MonoLabel, Mono, Display } from './core/Typography';
import { Button } from './Button';
import { StatusBadge } from './core/StatusBadge';
import { useSubmitResultReport } from '../hooks/use-event-results';

interface ResultReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
}

export function ResultReportModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
}: ResultReportModalProps) {
  const theme = useAppTheme();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const { mutateAsync: submitReport, isPending } = useSubmitResultReport(eventId);

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!reason.trim() || !details.trim()) {
      setErrorMessage('Please provide both a subject/category and detailed description.');
      return;
    }
    if (details.trim().length < 10) {
      setErrorMessage('Please provide at least 10 characters in your explanation.');
      return;
    }

    try {
      await submitReport({
        reason: reason.trim(),
        details: details.trim(),
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit report. Please try again.');
    }
  };

  const handleResetAndClose = () => {
    setReason('');
    setDetails('');
    setErrorMessage(null);
    setIsSuccess(false);
    onClose();
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      padding: theme.spacing.base,
    },
    container: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      maxHeight: '90%',
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    inputLabel: {
      color: theme.colors.outline,
      fontSize: 10,
      marginBottom: 4,
    },
    textInput: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      color: theme.colors.onSurface,
      fontFamily: theme.typography.monoMedium,
      fontSize: 12,
      padding: 10,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    errorBox: {
      backgroundColor: 'rgba(255, 59, 48, 0.1)',
      borderWidth: 1,
      borderColor: theme.colors.error,
      padding: 8,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 11,
      fontFamily: theme.typography.monoMedium,
    },
    successBox: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 12,
    },
    successTitle: {
      color: theme.colors.primary,
      fontSize: 14,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
  }), [theme]);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleResetAndClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <MaterialIcons name="flag" size={18} color={theme.colors.primary} />
              <MonoLabel style={{ color: theme.colors.primary, fontSize: 11 }}>
                REPORT INACCURACY // DISPUTE
              </MonoLabel>
            </View>
            <TouchableOpacity onPress={handleResetAndClose}>
              <MaterialIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {isSuccess ? (
            <View style={styles.successBox}>
              <MaterialIcons name="check-circle" size={40} color={theme.colors.success} />
              <Display style={styles.successTitle}>REPORT SUBMITTED</Display>
              <Body style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                Your report regarding the results for <Body style={{ fontWeight: 'bold' }}>{eventTitle}</Body> has been logged for organizer and faculty administrative review.
              </Body>
              <Button
                title="[ CLOSE ]"
                variant="primary"
                onPress={handleResetAndClose}
                style={{ width: '100%', marginTop: 8 }}
              />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Body style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                Notice an issue with winner placements, team membership attribution, or name spelling? Submit an official inaccuracy report.
              </Body>

              {errorMessage && (
                <View style={styles.errorBox}>
                  <Mono style={styles.errorText}>{errorMessage}</Mono>
                </View>
              )}

              <View style={{ gap: 12, marginTop: errorMessage ? 10 : 0 }}>
                <View>
                  <MonoLabel style={styles.inputLabel}>SUBJECT / CATEGORY *</MonoLabel>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Unrecognized team member / spelling"
                    placeholderTextColor={theme.colors.outline}
                    value={reason}
                    onChangeText={setReason}
                  />
                </View>

                <View>
                  <MonoLabel style={styles.inputLabel}>DETAILED EXPLANATION *</MonoLabel>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Provide full details, correct team names, registration email, and contest details..."
                    placeholderTextColor={theme.colors.outline}
                    value={details}
                    onChangeText={setDetails}
                    multiline
                  />
                </View>

                <View style={styles.buttonRow}>
                  <Button
                    title="[ CANCEL ]"
                    variant="secondary"
                    onPress={handleResetAndClose}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title={isPending ? '[ SUBMITTING... ]' : '[ SUBMIT REPORT ]'}
                    variant="primary"
                    onPress={handleSubmit}
                    disabled={isPending}
                    style={{ flex: 1.5 }}
                  />
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
