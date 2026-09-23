import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';

export interface FieldDefinition {
  id: string;
  label: string;
  fieldType: 'TEXT' | 'URL' | 'EMAIL' | 'NUMBER' | 'PHONE' | 'SELECT' | 'MULTI_SELECT' | 'RADIO';
  options: string[] | null;
  isReusable: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

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
      const response = await apiClient(`/v1/events/${eventId}/form-fields`) as { data: EventFormField[] };
      return response.data || [];
    },
    enabled: !!eventId,
  });
};
