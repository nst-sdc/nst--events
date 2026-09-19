import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { FieldDefinition } from './useFieldDefinitions';

export interface ProfileValue {
  userId: string;
  fieldDefinitionId: string;
  value: string;
  fieldDefinition: FieldDefinition;
}

export const useProfileValues = () => {
  return useQuery({
    queryKey: ['profileValues'],
    queryFn: async () => {
      const response = await apiClient<{ data: ProfileValue[] }>('/v1/users/me/profile-values');
      return response.data;
    },
  });
};
