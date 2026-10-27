import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export interface EventForm {
  id: string;
  eventId: string;
  title: string;
  purpose: 'REGISTRATION' | 'SUBMISSION' | 'FEEDBACK' | 'CUSTOM';
  releaseAt: string | null;
  closeAt: string | null;
  publishedAt: string | null;
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
  fieldDefinition: {
    id: string;
    label: string;
    key: string;
    fieldType: 'TEXT' | 'URL' | 'EMAIL' | 'NUMBER' | 'PHONE' | 'SELECT' | 'MULTI_SELECT' | 'RADIO';
    isReusable: boolean;
    options: string[] | null;
  };
}

export interface InlineFieldDefinition {
  key: string;
  label: string;
  fieldType: EventFormField['fieldDefinition']['fieldType'];
  options?: string[] | null;
  isReusable?: boolean;
}

export interface UpdateEventFormFieldItem {
  fieldDefinitionId?: string;
  definition?: InlineFieldDefinition;
  isRequired: boolean;
  order: number;
}

export interface EventFormResponseItem {
  id: string;
  eventRegistrationId: string;
  formId: string | null;
  fieldDefinitionId: string;
  value: string;
  createdAt?: string;
  eventRegistration?: {
    id: string;
    userId: string;
    user?: {
      id: string;
      fullName: string | null;
      email: string;
    };
  };
  fieldDefinition?: EventFormField['fieldDefinition'];
}

export interface EventFormWithFields extends EventForm {
  fields: EventFormField[];
}

export const useEventForms = (eventId: string) => {
  return useQuery({
    queryKey: ['event-forms', eventId],
    queryFn: async () => {
      const res = await apiClient<{ data: EventForm[] }>(`/v1/events/${eventId}/forms`);
      return res.data;
    },
    enabled: !!eventId,
  });
};

export const useEventForm = (eventId: string, formId: string | null) => {
  return useQuery({
    queryKey: ['event-form', eventId, formId],
    queryFn: async () => {
      if (!formId) return null;
      const res = await apiClient<EventFormWithFields>(`/v1/events/${eventId}/forms/${formId}`);
      return res;
    },
    enabled: !!eventId && !!formId,
  });
};

export const useCreateEventForm = (eventId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { title: string; purpose: string; releaseAt?: string | null; closeAt?: string | null }) => {
      const res = await apiClient<EventForm>(`/v1/events/${eventId}/forms`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] });
    },
  });
};

export const useUpdateEventForm = (eventId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ formId, data }: { formId: string, data: { title?: string; releaseAt?: string | null; closeAt?: string | null } }) => {
      const res = await apiClient<EventForm>(`/v1/events/${eventId}/forms/${formId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-form', eventId, variables.formId] });
    },
  });
};

export const useDeleteEventForm = (eventId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (formId: string) => {
      await apiClient(`/v1/events/${eventId}/forms/${formId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] });
    },
  });
};

export const usePublishEventForm = (eventId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formId: string) => {
      const res = await apiClient<EventForm>(`/v1/events/${eventId}/forms/${formId}/publish`, {
        method: 'POST',
      });
      return res;
    },
    onSuccess: (_, formId) => {
      queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-form', eventId, formId] });
    },
  });
};

export const useUnpublishEventForm = (eventId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formId: string) => {
      const res = await apiClient<EventForm>(`/v1/events/${eventId}/forms/${formId}/unpublish`, {
        method: 'POST',
      });
      return res;
    },
    onSuccess: (_, formId) => {
      queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-form', eventId, formId] });
    },
  });
};

export const useUpdateEventFormFields = (eventId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formId, fields }: { formId: string; fields: UpdateEventFormFieldItem[] }) => {
      const res = await apiClient<{ data: EventFormField[] }>(`/v1/events/${eventId}/forms/${formId}/fields`, {
        method: 'PATCH',
        body: JSON.stringify({ fields }),
      });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-form', eventId, variables.formId] });
      queryClient.invalidateQueries({ queryKey: ['fieldDefinitions'] });
    },
  });
};

/**
 * Duplicates a form's metadata and attached fields onto a brand-new form.
 * Uses only existing endpoints (create form + replace fields).
 */
export const useDuplicateEventForm = (eventId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formId, title, purpose }: { formId: string; title: string; purpose: EventForm['purpose'] }) => {
      const source = await apiClient<EventFormWithFields>(`/v1/events/${eventId}/forms/${formId}`);
      const created = await apiClient<EventForm>(`/v1/events/${eventId}/forms`, {
        method: 'POST',
        body: JSON.stringify({ title: `${title} (copy)`, purpose }),
      });

      if (source.fields && source.fields.length > 0) {
        await apiClient(`/v1/events/${eventId}/forms/${created.id}/fields`, {
          method: 'PATCH',
          body: JSON.stringify({
            fields: source.fields.map((f) => ({
              fieldDefinitionId: f.fieldDefinitionId,
              isRequired: f.isRequired,
              order: f.order,
            })),
          }),
        });
      }

      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] });
    },
  });
};

export const useEventFormResponses = (eventId: string, formId: string | null) => {
  return useQuery({
    queryKey: ['event-form-responses', eventId, formId],
    queryFn: async () => {
      if (!formId) return null;
      const res = await apiClient<{ data: EventFormResponseItem[] }>(`/v1/events/${eventId}/forms/${formId}/responses`);
      return res.data;
    },
    enabled: !!eventId && !!formId,
  });
};

export const useSubmitEventForm = (eventId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ formId, responses }: { formId: string; responses: Array<{ fieldDefinitionId: string; value: string }> }) => {
      const res = await apiClient<{ data: EventFormResponseItem[] }>(`/v1/events/${eventId}/forms/${formId}/responses`, {
        method: 'POST',
        body: JSON.stringify({ responses }),
      });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-form-responses', eventId, variables.formId] });
      queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] });
      queryClient.invalidateQueries({ queryKey: ['profileValues'] });
    },
  });
};
