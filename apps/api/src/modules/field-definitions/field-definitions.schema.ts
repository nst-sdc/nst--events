import { z } from 'zod';
import { FieldType } from '@prisma/client';

export const CreateFieldDefinitionSchema = z.object({
  body: z.object({
    key: z.string().min(1).max(50),
    label: z.string().min(1).max(100),
    fieldType: z.nativeEnum(FieldType),
    options: z.array(z.string()).optional(),
    isReusable: z.boolean().default(true),
  }),
});

export type CreateFieldDefinitionData = z.infer<typeof CreateFieldDefinitionSchema>['body'];
