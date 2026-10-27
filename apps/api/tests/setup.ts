process.env.NODE_ENV = "test";
process.env.ALLOW_TEST_EMAIL_DOMAINS = "true";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://nst_app:nst_app_password@127.0.0.1:5440/nst_events_clean_test?schema=public";
process.env.WORKER_DATABASE_URL = process.env.WORKER_DATABASE_URL || "postgresql://nst_worker:worker_password@127.0.0.1:5440/nst_events_clean_test?schema=public";
process.env.ADMIN_DATABASE_URL = process.env.ADMIN_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5440/nst_events_clean_test?schema=public";

// Fail-closed safety guard: Prevent destructive test suites from running against production, remote, or ordinary development databases
function assertSafeTestDatabase(urlStr: string | undefined, envVarName: string): void {
  if (!urlStr) return;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname;
    const dbName = parsed.pathname.replace(/^\//, '');

    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === 'postgres' ||
      host === 'db';

    if (process.env.ALLOW_REMOTE_TEST_DB !== 'true' && !isLocal) {
      throw new Error(
        `[SAFETY GUARD] Destructive integration tests blocked: ${envVarName} points to non-local host "${host}". ` +
        `Set ALLOW_REMOTE_TEST_DB=true if executing against a dedicated remote test environment.`
      );
    }

    if (/prod(uction)?$/i.test(dbName) || /_prod(uction)?/i.test(dbName)) {
      throw new Error(
        `[SAFETY GUARD] Destructive integration tests blocked: database name "${dbName}" in ${envVarName} appears to be a production database.`
      );
    }

    // Never silently run destructive tests against the ordinary development database (nst_events)
    const isOrdinaryDevDb = dbName === 'nst_events';
    const isExplicitlyAllowlistedTestDb =
      dbName.endsWith('_test') ||
      dbName.includes('test') ||
      dbName.includes('verify') ||
      dbName.includes('disposable') ||
      dbName.includes('scratch');

    if (isOrdinaryDevDb && process.env.ALLOW_DEV_DATABASE_FOR_TESTS !== 'true') {
      throw new Error(
        `[SAFETY GUARD] Destructive integration tests blocked: ${envVarName} points to ordinary development database "${dbName}". ` +
        `Use a dedicated test database (e.g. nst_events_test) or set ALLOW_DEV_DATABASE_FOR_TESTS=true to explicitly opt in.`
      );
    }

    if (!isExplicitlyAllowlistedTestDb && process.env.ALLOW_DEV_DATABASE_FOR_TESTS !== 'true') {
      throw new Error(
        `[SAFETY GUARD] Destructive integration tests blocked: database name "${dbName}" is not an allowlisted test database. ` +
        `Target a database name matching *test*, *verify*, or *disposable*, or set ALLOW_DEV_DATABASE_FOR_TESTS=true.`
      );
    }
  } catch (err: any) {
    if (err.message?.startsWith('[SAFETY GUARD]')) {
      throw err;
    }
  }
}

assertSafeTestDatabase(process.env.DATABASE_URL, 'DATABASE_URL');
assertSafeTestDatabase(process.env.ADMIN_DATABASE_URL, 'ADMIN_DATABASE_URL');
assertSafeTestDatabase(process.env.WORKER_DATABASE_URL, 'WORKER_DATABASE_URL');

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
