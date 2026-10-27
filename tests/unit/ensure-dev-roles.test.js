const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const {
  validateDatabaseUrl,
  sanitizeErrorMessage,
  ALLOWED_DEV_HOSTS,
} = require('../../scripts/ensure-dev-roles');

console.log('--- Testing scripts/ensure-dev-roles.js Safety Rules ---');

// 1. Allowed local targets
const allowedUrls = [
  'postgresql://postgres:postgres@localhost:5432/nst_events',
  'postgresql://app_user:pass@127.0.0.1:5432/nst_events',
  'postgresql://user:pass@[::1]:5432/nst_events',
  'postgresql://user:pass@0.0.0.0:5432/nst_events',
  'postgresql://user:pass@nst-postgres:5432/nst_events',
  'postgresql://user:pass@nst-postgres-service:5432/nst_events',
  'postgresql://user:pass@postgres:5432/nst_events',
  'postgresql://user:pass@host.docker.internal:5432/nst_events',
  'postgresql://user:pass@database.local:5432/nst_events',
];

for (const url of allowedUrls) {
  assert.doesNotThrow(() => {
    const host = validateDatabaseUrl(url, false);
    assert.ok(host, `Expected host for ${url}`);
  }, `Allowed local target failed: ${url}`);
}
console.log('✓ Allowed local targets validated successfully');

// 2. Disallowed remote targets fail closed
const disallowedUrls = [
  'postgresql://admin:supersecret@rds.us-east-1.amazonaws.com:5432/prod_events',
  'postgresql://admin:supersecret@db.production.nst.internal:5432/nst_events',
  'postgresql://admin:supersecret@10.0.0.55:5432/nst_events',
  'postgresql://admin:supersecret@shared-staging.nst.dev:5432/nst_events',
];

for (const url of disallowedUrls) {
  assert.throws(
    () => {
      validateDatabaseUrl(url, false);
    },
    (err) => {
      assert.ok(err.message.includes('Refusing to seed dev roles against non-allowlisted host'));
      assert.ok(!err.message.includes('supersecret'), 'Error message must not leak password');
      return true;
    },
    `Disallowed URL was not rejected: ${url}`
  );
}
console.log('✓ Disallowed remote targets fail closed without leaking credentials');

// 3. Opt-in via ALLOW_REMOTE_DEV_ROLE_SEEDING=true
const remoteUrl = 'postgresql://admin:pass@remote-staging.nst.internal:5432/nst_events';
assert.doesNotThrow(() => {
  const host = validateDatabaseUrl(remoteUrl, true);
  assert.strictEqual(host, 'remote-staging.nst.internal');
}, 'Opt-in with allowRemote=true failed');
console.log('✓ Remote target with explicit opt-in passes with warning');

// 4. Missing or empty DATABASE_URL
const emptyUrls = ['', '   ', null, undefined];
for (const empty of emptyUrls) {
  assert.throws(
    () => {
      validateDatabaseUrl(empty, false);
    },
    (err) => {
      assert.ok(err.message.includes('missing or empty'));
      return true;
    }
  );
}
console.log('✓ Missing/empty DATABASE_URL fails closed');

// 5. Malformed DATABASE_URL
const malformedUrls = ['not-a-url', '://invalid-uri', 'http:///'];
for (const bad of malformedUrls) {
  assert.throws(
    () => {
      validateDatabaseUrl(bad, false);
    },
    (err) => {
      assert.ok(err.message.includes('not a valid URL') || err.message.includes('missing or empty'));
      return true;
    }
  );
}
console.log('✓ Malformed DATABASE_URL fails closed');

// 6. Credential sanitization
const rawError = 'Failed to connect to postgresql://admin:myTopSecretPassword123@rds.amazonaws.com:5432/events_db';
const sanitized = sanitizeErrorMessage(rawError);
assert.ok(!sanitized.includes('myTopSecretPassword123'), 'Sanitized error leaked password');
assert.ok(sanitized.includes('admin:***@rds.amazonaws.com:5432/events_db'), 'Sanitized format unexpected');
console.log('✓ Credential sanitization masks password in connection strings');

// 7. CLI execution fails closed on disallowed remote host
const scriptPath = path.resolve(__dirname, '../../scripts/ensure-dev-roles.js');
const cliResult = spawnSync(process.execPath, [scriptPath], {
  env: {
    ...process.env,
    DATABASE_URL: 'postgresql://admin:supersecretpassword@db.prod.company.com:5432/prod_events',
    ALLOW_REMOTE_DEV_ROLE_SEEDING: 'false',
  },
  encoding: 'utf8',
});

assert.strictEqual(cliResult.status, 1, 'Expected CLI execution to exit 1 on remote database');
assert.ok(cliResult.stderr.includes('[dev-roles] Fatal: Refusing to seed dev roles against non-allowlisted host'));
assert.ok(!cliResult.stderr.includes('supersecretpassword'), 'CLI error leaked credentials');
console.log('✓ CLI execution exits with code 1 and safe error on remote database');

console.log('All 7 ensure-dev-roles safety tests passed!\n');
