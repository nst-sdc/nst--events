import { PrismaClient } from '@nst/database';

export const adminPrisma = new PrismaClient({
  datasources: {
    db: { url: process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5440/nst_events_clean_test?schema=public" }
  }
});
