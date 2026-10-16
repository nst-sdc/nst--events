import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';
import { FieldDefinition } from './useEventFormFields';

export interface ProfileValue {
  userId: string;
  fieldDefinitionId: string;
  value: string;
  fieldDefinition?: FieldDefinition;
}

export const useProfileValues = () => {
  return useQuery<ProfileValue[]>({
    queryKey: ['profileValues'],
    queryFn: async () => {
      const response = (await apiClient('/v1/users/me/profile-values')) as { data: ProfileValue[] };
      return response.data || [];
    },
  });
};
