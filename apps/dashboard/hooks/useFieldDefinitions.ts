import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export type FieldType = 'TEXT' | 'URL' | 'EMAIL' | 'NUMBER' | 'PHONE' | 'SELECT';

export interface FieldDefinition {
  id: string;
  key: string;
  label: string;
  fieldType: FieldType;
  options: any;
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

export function useCreateFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<FieldDefinition, 'id' | 'createdAt' | 'createdByClubId'>) => {
      const response = await apiClient('/v1/field-definitions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fieldDefinitions'] });
    },
  });
}
