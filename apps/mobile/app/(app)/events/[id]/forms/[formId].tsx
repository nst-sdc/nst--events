import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEventForm, useSubmitEventForm } from '../../../../../src/hooks/useEventForms';
import { useAppTheme } from '../../../../../src/store/theme-store';
import { MobileShell } from '../../../../../src/ui/core/MobileShell';
import { Button } from '../../../../../src/ui/Button';
import { Body, MonoLabel } from '../../../../../src/ui/core/Typography';
import { ActivityIndicator } from '../../../../../src/ui/core/ActivityIndicator';
import { StatusBadge } from '../../../../../src/ui/core/StatusBadge';
import { DynamicFieldInput } from '../../../../../src/ui/DynamicFieldInput';
import {
  validateFormResponses,
  toResponsePayload,
} from '../../../../../src/lib/form-utils';

export default function EventFormScreen() {
  const { id, formId } = useLocalSearchParams<{ id: string; formId: string }>();
  const router = useRouter();
  const theme = useAppTheme();

  const { data: form, isLoading } = useEventForm(id as string, formId as string);
  const { submitFormAsync, isSubmitting } = useSubmitEventForm(id as string, formId as string);

  const [responses, setResponses] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/(app)/events/${id}`);
    }
  };

  const now = new Date();
  const isReleased = !form?.releaseAt || new Date(form.releaseAt) <= now;
  const isClosed = !!form?.closeAt && new Date(form.closeAt) <= now;
  const isOpen = isReleased && !isClosed;

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (form?.closeAt && new Date(form.closeAt) <= new Date()) {
      setErrorMsg('This form has reached its closing deadline and is no longer accepting submissions.');
      return;
    }

    const validation = validateFormResponses(form?.fields || [], responses);
    if (!validation.isValid) {
      setErrorMsg(validation.firstError || 'Please check your answers and complete all required questions.');
      return;
    }

    try {
      await submitFormAsync({ responses: toResponsePayload(responses) });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit form');
    }
  };

  if (isLoading) {
    return (
      <MobileShell title="EVENT FORM" showBackButton onBackPress={handleBack}>
        <View style={{ paddingVertical: 48, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
            LOADING FORM...
          </MonoLabel>
        </View>
      </MobileShell>
    );
  }

  if (!form) {
    return (
      <MobileShell title="EVENT FORM" showBackButton onBackPress={handleBack}>
        <Body style={{ color: theme.colors.onSurfaceVariant }}>
          This form could not be found.
        </Body>
      </MobileShell>
    );
  }

  if (isSuccess) {
    return (
      <MobileShell title={form.title} showBackButton onBackPress={handleBack}>
        <View style={{ paddingVertical: 48, alignItems: 'center', gap: theme.spacing.md }}>
          <StatusBadge status="[ SUBMITTED ]" type="success" />
          <Body style={{ color: theme.colors.onSurface, textAlign: 'center' }}>
            Your responses have been recorded.
          </Body>
          <Button title="[ DONE ]" onPress={handleBack} />
        </View>
      </MobileShell>
    );
  }

  return (
    <MobileShell title={form.title} showBackButton onBackPress={handleBack}>
      <View style={{ gap: theme.spacing.sm }}>
        <StatusBadge
          status={!isReleased ? '[ SCHEDULED ]' : isClosed ? '[ CLOSED ]' : '[ OPEN ]'}
          type={!isReleased ? 'warning' : isClosed ? 'default' : 'success'}
        />
        {form.closeAt && isOpen ? (
          <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>
            DEADLINE: {new Date(form.closeAt).toLocaleString()}
          </MonoLabel>
        ) : null}
      </View>

      {!isOpen ? (
        <Body style={{ color: theme.colors.onSurfaceVariant }}>
          {!isReleased
            ? `This form unlocks on ${new Date(form.releaseAt!).toLocaleString()}.`
            : 'This form is closed for submissions.'}
        </Body>
      ) : (
        <>
          {errorMsg ? (
            <View
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

          {form.fields.length === 0 ? (
            <Body style={{ color: theme.colors.onSurfaceVariant }}>
              No questions have been configured for this form yet.
            </Body>
          ) : (
            <View style={{ gap: theme.spacing.lg }}>
              {form.fields.map((field) => (
                <DynamicFieldInput
                  key={field.id}
                  field={field}
                  value={responses[field.fieldDefinitionId] ?? ''}
                  onChange={(value) =>
                    setResponses((prev) => ({ ...prev, [field.fieldDefinitionId]: value }))
                  }
                  disabled={isSubmitting}
                />
              ))}
            </View>
          )}

          {form.fields.length > 0 && (
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              <Button
                title={isSubmitting ? '[ SUBMITTING... ]' : '[ SUBMIT FORM ]'}
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
              />
              <Button
                title="[ CANCEL ]"
                variant="secondary"
                onPress={handleBack}
                disabled={isSubmitting}
              />
            </View>
          )}
        </>
      )}
    </MobileShell>
  );
}
