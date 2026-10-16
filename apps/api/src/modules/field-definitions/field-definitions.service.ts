import { PrismaClient, Prisma } from '@prisma/client';
import { CreateFieldDefinitionData } from './field-definitions.schema';
import { prisma } from '../../lib/prisma';

export class FieldDefinitionsService {
  constructor(private db: PrismaClient = prisma) {}

  /**
   * Creates a new reusable field definition.
   * Can be created by platform admins or club admins/core members.
   */
  async createFieldDefinition(
    data: CreateFieldDefinitionData & { createdByClubId?: string },
    tx?: Prisma.TransactionClient | PrismaClient
  ) {
    const client = tx || this.db;
    return client.fieldDefinition.create({
      data: {
        key: data.key,
        label: data.label,
        fieldType: data.fieldType,
        options: data.options ? (data.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        isReusable: data.isReusable,
        createdByClubId: data.createdByClubId,
      },
    });
  }

  /**
   * Lists all available field definitions.
   */
  async listFieldDefinitions() {
    return this.db.fieldDefinition.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const fieldDefinitionsService = new FieldDefinitionsService();
