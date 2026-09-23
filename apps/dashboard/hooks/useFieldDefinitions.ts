import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export type FieldType = 'TEXT' | 'NUMBER' | 'EMAIL' | 'URL' | 'PHONE' | 'SELECT' | 'RADIO' | 'MULTI_SELECT';

export interface FieldDefinition {
  id: string;
  key: string;
  label: string;
  fieldType: FieldType;
  options: string[] | null;
  isReusable: boolean;
  createdByClubId: string | null;
  createdAt: string;
}

export const useFieldDefinitions = () => {
  return useQuery({
    queryKey: ['fieldDefinitions'],
    queryFn: async () => {
      const response = await apiClient<{ data: FieldDefinition[] }>('/v1/field-definitions');
      return response.data;
    },
  });
};

export interface CreateFieldDefinitionInput {
  key: string;
  label: string;
  fieldType: FieldType;
  options?: string[] | null;
  isReusable?: boolean;
}

export function useCreateFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFieldDefinitionInput) => {
      const response = await apiClient<{ data: FieldDefinition }>('/v1/field-definitions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fieldDefinitions'] });
    },
  });
}
