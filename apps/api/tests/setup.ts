process.env.NODE_ENV = "test";
process.env.ALLOW_TEST_EMAIL_DOMAINS = "true";
process.env.DATABASE_URL = "postgresql://nst_app:nst_app_password@127.0.0.1:5440/nst_events?schema=public";
process.env.WORKER_DATABASE_URL = "postgresql://nst_worker:worker_password@127.0.0.1:5440/nst_events?schema=public";
process.env.ADMIN_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5440/nst_events?schema=public";

import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { adminPrisma } from './helpers/adminDb';
import { pgListener } from '../src/modules/sse/pg-listener';
import { after } from 'node:test';

// Shared supertest fixture: automatically defaults X-Client-Platform: web for test requests
// so appVersionMiddleware runs and passes across all integration tests without manual header scattering.
// Tests explicitly evaluating missing version headers or mobile clients can opt-out by setting
// headers directly or setting (app as any)._skipDefaultPlatformHeader = true.
const origEnd = (request as any).Test.prototype.end;
(request as any).Test.prototype.end = function (fn: any) {
  const expressApp = this.app?._events?.request || this.app;
  const skip = expressApp && expressApp._skipDefaultPlatformHeader;
  const hasPlatform = !!this.getHeader('x-client-platform');
  const hasVersion = !!this.getHeader('x-app-version');
  if (!skip && !hasPlatform && !hasVersion) {
    this.set('X-Client-Platform', 'web');
  }
  return origEnd.call(this, fn);
};

after(async () => {
  try {
    await adminPrisma.$executeRawUnsafe(`ALTER TABLE users ENABLE ROW LEVEL SECURITY;`);
  } catch {}
  await prisma.$disconnect();
  await adminPrisma.$disconnect();
  await pgListener.disconnect();
});
