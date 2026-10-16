import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { FieldDefinition } from './useFieldDefinitions';

export interface EventFormField {
  eventId: string;
  fieldDefinitionId: string;
  isRequired: boolean;
  order: number;
  fieldDefinition: FieldDefinition;
}

export const useEventFormFields = (eventId: string) => {
  return useQuery({
    queryKey: ['eventFormFields', eventId],
    queryFn: async () => {
      const response = await apiClient<{ data: EventFormField[] }>(`/v1/events/${eventId}/form-fields`);
      return response.data;
    },
    enabled: !!eventId,
  });
};

export interface UpdateEventFormFieldItem {
  fieldDefinitionId?: string;
  definition?: {
    key: string;
    label: string;
    fieldType: string;
    options?: string[];
    isReusable?: boolean;
  };
  isRequired: boolean;
  order: number;
}

export const useUpdateEventFormFields = (eventId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { fields: (UpdateEventFormFieldItem | Omit<EventFormField, 'eventId' | 'fieldDefinition'>)[] }) => {
      const response = await apiClient<{ data: EventFormField[] }>(`/v1/events/${eventId}/form-fields`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventFormFields', eventId] });
      queryClient.invalidateQueries({ queryKey: ['fieldDefinitions'] });
    },
  });
};
