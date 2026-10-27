import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEventFormFields } from '../../../../src/hooks/useEventFormFields';
import { useRegistration } from '../../../../src/hooks/use-registration';
import { useAppTheme } from '../../../../src/store/theme-store';
import { MobileShell } from '../../../../src/ui/core/MobileShell';
import { Button } from '../../../../src/ui/Button';
import { Body, MonoLabel } from '../../../../src/ui/core/Typography';
import { ActivityIndicator } from '../../../../src/ui/core/ActivityIndicator';
import { DynamicFieldInput } from '../../../../src/ui/DynamicFieldInput';
import {
  getMissingRequiredFields,
  validateClientFieldValue,
  toResponsePayload,
} from '../../../../src/lib/form-utils';

export default function EventRegisterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();

  const { data: fields, isLoading } = useEventFormFields(id as string);
  const { registerAsync, isRegistering } = useRegistration(id as string);

  const [responses, setResponses] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/(app)/events/${id}`);
    }
  };

  const handleSubmit = async () => {
    setErrorMsg(null);

    const missing = getMissingRequiredFields(fields, responses);
    if (missing.length > 0) {
      setErrorMsg(`Please answer required question: "${missing[0].fieldDefinition.label}"`);
      return;
    }

    if (fields) {
      for (const field of fields) {
        const err = validateClientFieldValue(
          field.fieldDefinition,
          responses[field.fieldDefinitionId] || ''
        );
        if (err) {
          setErrorMsg(err);
          return;
        }
      }
    }

    try {
      await registerAsync({ responses: toResponsePayload(responses) });
      handleBack();
    } catch (err: any) {
      let message = 'Registration failed. Please check your answers and try again.';
      if (err?.status === 0 || err?.message === 'Offline') {
        message = 'You appear to be offline. Please check your connection and try again.';
      } else if (err?.status === 401) {
        message = 'Your session has expired. Please log in again.';
      } else if (err?.status >= 500) {
        message = 'A server error occurred. Please try again later.';
      } else {
        const candidate = err?.message || err?.detail;
        if (
          typeof candidate === 'string' &&
          candidate.trim() &&
          !candidate.includes('Internal') &&
          !candidate.includes('Prisma') &&
          !candidate.includes('SQL') &&
          !candidate.includes('database') &&
          !candidate.includes('stack') &&
          !candidate.includes('at ')
        ) {
          message = candidate;
        }
      }
      setErrorMsg(message);
    }
  };

  if (isLoading) {
    return (
      <MobileShell title="EVENT REGISTRATION" showBackButton onBackPress={handleBack}>
        <View style={{ paddingVertical: 48, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
            LOADING REGISTRATION FORM...
          </MonoLabel>
        </View>
      </MobileShell>
    );
  }

  if (!fields || fields.length === 0) {
    return (
      <MobileShell title="EVENT REGISTRATION" showBackButton onBackPress={handleBack}>
        <Body style={{ color: theme.colors.onSurfaceVariant }}>
          This event does not require any additional registration details.
        </Body>
        <Button title="[ GO BACK ]" variant="secondary" onPress={handleBack} />
      </MobileShell>
    );
  }

  return (
    <MobileShell title="EVENT REGISTRATION" showBackButton onBackPress={handleBack}>
      <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>
        COMPLETE THE REQUIRED DETAILS TO REGISTER
      </MonoLabel>

      {errorMsg ? (
        <View
          testID="registration-error-banner"
          accessibilityRole="alert"
          style={{
            borderWidth: 1,
            borderColor: theme.colors.error,
            backgroundColor: theme.colors.errorContainer,
            padding: theme.spacing.md,
          }}
        >
          <MonoLabel style={{ color: theme.colors.onErrorContainer }}>{errorMsg}</MonoLabel>
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.lg }}>
        {fields.map((field) => (
          <DynamicFieldInput
            key={field.fieldDefinitionId}
            field={field}
            value={responses[field.fieldDefinitionId] ?? ''}
            onChange={(value) =>
              setResponses((prev) => ({ ...prev, [field.fieldDefinitionId]: value }))
            }
            disabled={isRegistering}
          />
        ))}
      </View>

      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <Button
          title={isRegistering ? '[ PROCESSING... ]' : '[ CONFIRM REGISTRATION ]'}
          onPress={handleSubmit}
          loading={isRegistering}
          disabled={isRegistering}
        />
        <Button
          title="[ CANCEL ]"
          variant="secondary"
          onPress={handleBack}
          disabled={isRegistering}
        />
      </View>
    </MobileShell>
  );
}
