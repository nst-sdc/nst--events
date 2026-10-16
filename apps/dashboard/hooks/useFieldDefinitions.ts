import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useCurrentUser } from './useCurrentUser';

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

/**
 * Field definitions a user is allowed to attach to their event's forms:
 * platform fields (createdByClubId === null) plus fields owned by one of the
 * user's own clubs. Global admins can attach any field.
 */
export function useAttachableFieldDefinitions() {
  const query = useFieldDefinitions();
  const { data: user } = useCurrentUser();

  const data = useMemo(() => {
    const fields = query.data || [];
    if (user?.global_role === 'PLATFORM_ADMIN' || user?.global_role === 'FACULTY_ADMIN') {
      return fields;
    }
    const clubIds = new Set((user?.club_memberships || []).map((m) => m.club_id));
    return fields.filter((f) => f.createdByClubId === null || clubIds.has(f.createdByClubId));
  }, [query.data, user]);

  return { ...query, data };
}

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
      // Backend schema expects `options: z.array(z.string()).optional()`.
      // Passing `null` causes Zod validation failure ("Expected array, received null").
      const payload: Record<string, any> = {
        key: data.key,
        label: data.label,
        fieldType: data.fieldType,
        isReusable: data.isReusable ?? true,
      };

      if (Array.isArray(data.options) && data.options.length > 0) {
        payload.options = data.options;
      }

      const response = await apiClient<{ data: FieldDefinition }>('/v1/field-definitions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fieldDefinitions'] });
    },
  });
}
