import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';
import { FieldDefinition } from './useEventFormFields';

export interface EventForm {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  purpose: 'REGISTRATION' | 'FEEDBACK' | 'QUIZ' | 'CHECKIN' | 'CUSTOM';
  releaseAt: string | null;
  closeAt: string | null;
  notifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventFormField {
  id: string;
  eventId: string;
  formId: string | null;
  fieldDefinitionId: string;
  isRequired: boolean;
  order: number;
  createdAt: string;
  fieldDefinition: FieldDefinition;
}

export interface EventFormWithFields extends EventForm {
  fields: EventFormField[];
}

export interface EventRegistrationResponse {
  id: string;
  eventRegistrationId: string;
  fieldDefinitionId: string;
  formId: string | null;
  value: string;
  createdAt: string;
  updatedAt: string;
  fieldDefinition?: {
    id: string;
    key: string;
    label: string;
    fieldType: string;
  };
}

export const useEventForms = (eventId: string, isRegistered: boolean = true) => {
  return useQuery({
    queryKey: ['event-forms', eventId],
    queryFn: async () => {
      const res = await apiClient(`/v1/events/${eventId}/forms`) as { data: EventForm[] };
      return res.data || [];
    },
    enabled: !!eventId && isRegistered,
  });
};

export const useEventForm = (eventId: string, formId: string | null | undefined) => {
  return useQuery({
    queryKey: ['event-form', eventId, formId],
    queryFn: async () => {
      if (!formId) return null;
      const res = await apiClient(`/v1/events/${eventId}/forms/${formId}`) as EventFormWithFields;
      return res;
    },
    enabled: !!eventId && !!formId,
  });
};

export const useEventFormMyResponse = (eventId: string, formId: string | null | undefined) => {
  return useQuery({
    queryKey: ['event-form-my-response', eventId, formId],
    queryFn: async () => {
      if (!formId) return [];
      const res = await apiClient(`/v1/events/${eventId}/forms/${formId}/my-response`) as { data: EventRegistrationResponse[] };
      return res.data || [];
    },
    enabled: !!eventId && !!formId,
  });
};

export interface SubmitEventFormPayload {
  formId?: string;
  responses: Array<{ fieldDefinitionId: string; value: string }>;
}

export const useSubmitEventForm = (eventId: string, formId?: string) => {
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: async (payload: SubmitEventFormPayload) => {
      const targetFormId = payload.formId || formId;
      if (!targetFormId) {
        throw new Error('formId is required to submit event form responses');
      }

      const res = await apiClient(`/v1/events/${eventId}/forms/${targetFormId}/responses`, {
        method: 'POST',
        body: JSON.stringify({ responses: payload.responses }),
      }) as { data: EventRegistrationResponse[] };

      return { formId: targetFormId, data: res.data };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['event-form-my-response', eventId, result.formId] });
      queryClient.invalidateQueries({ queryKey: ['event-form', eventId, result.formId] });
      queryClient.invalidateQueries({ queryKey: ['profileValues'] });
      queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] });
    },
  });

  return {
    submitForm: submit.mutate,
    submitFormAsync: submit.mutateAsync,
    isSubmitting: submit.isPending,
    error: submit.error,
  };
};
