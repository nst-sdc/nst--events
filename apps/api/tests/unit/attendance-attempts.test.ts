import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { Prisma } from '@prisma/client';
import { getDatabaseErrorReason } from '../../src/lib/errors/database-error-mapper';
import { UnprocessableEntityError, ConflictError } from '../../src/lib/errors';

describe('Unit: getDatabaseErrorReason Pure Resolver', () => {
  const createPrismaError = (sqlstate: string, message: string) => {
    return new Prisma.PrismaClientKnownRequestError(
      message,
      {
        code: 'P2010',
        clientVersion: '5.x',
        meta: { code: sqlstate, message }
      }
    );
  };

  it('resolves known SQLSTATE codes to semantic strings without throwing', () => {
    const testCases = [
      { code: 'U0005', expected: 'SESSION_CLOSED' },
      { code: 'U0006', expected: 'EVENT_LOCKED' },
      { code: 'U0007', expected: 'OUTSIDE_GEOFENCE' },
      { code: 'U0008', expected: 'MOCK_LOCATION_REJECTED' },
      { code: 'U0009', expected: 'LOCATION_UNAVAILABLE' },
      { code: 'U0010', expected: 'INVALID_LOCATION' },
      { code: 'U0011', expected: 'LOCATION_UNRELIABLE' },
      { code: 'U0012', expected: 'ACADEMIC_PROFILE_MISSING' },
      { code: 'U0013', expected: 'ACADEMICALLY_INELIGIBLE' },
      { code: 'U0014', expected: 'SIGNATURE_ALREADY_CONSUMED' },
    ];

    for (const { code, expected } of testCases) {
      const err = createPrismaError(code, 'Database check failed');
      const reason = getDatabaseErrorReason(err);
      assert.strictEqual(reason, expected);
    }
  });

  it('resolves AppError instances to their error message', () => {
    const appErr = new UnprocessableEntityError('QR_EXPIRED');
    assert.strictEqual(getDatabaseErrorReason(appErr), 'QR_EXPIRED');

    const conflictErr = new ConflictError('ALREADY_RECORDED');
    assert.strictEqual(getDatabaseErrorReason(conflictErr), 'ALREADY_RECORDED');
  });

  it('resolves Prisma unique constraint violation P2002 to ALREADY_RECORDED', () => {
    const p2002Err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.x',
    });
    assert.strictEqual(getDatabaseErrorReason(p2002Err), 'ALREADY_RECORDED');
  });

  it('resolves regex-embedded SQLSTATE in generic error messages', () => {
    const regexErr = new Error('Unhandled exception: Code: `U0007` outside geofence boundary');
    assert.strictEqual(getDatabaseErrorReason(regexErr), 'OUTSIDE_GEOFENCE');
  });

  it('never throws for unknown/malformed input shapes, returning fallback', () => {
    assert.strictEqual(getDatabaseErrorReason(null), 'ATTENDANCE_FAILED');
    assert.strictEqual(getDatabaseErrorReason(undefined), 'ATTENDANCE_FAILED');
    assert.strictEqual(getDatabaseErrorReason(12345), 'ATTENDANCE_FAILED');
    assert.strictEqual(getDatabaseErrorReason({}), 'ATTENDANCE_FAILED');
    assert.strictEqual(getDatabaseErrorReason(new Error('Unknown generic error')), 'Unknown generic error');
  });
});
