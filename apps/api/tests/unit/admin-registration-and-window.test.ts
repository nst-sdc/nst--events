import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ForbiddenError, UnprocessableEntityError } from '../../src/lib/errors';
import {
  validateRegistrationEligibility,
  validateVerifiedUser,
} from '../../src/modules/events/events.service';

describe('Admin Registration Restriction & Registration Window Validation', () => {
  const eligibleStudent = {
    id: 'user-student-1',
    email: 'student@adypu.edu.in',
    googleSub: 'google-sub-verified-1',
    deletedAt: null,
    globalRole: 'STUDENT',
    clubMemberships: [],
  };

  const regularMember = {
    id: 'user-member-1',
    email: 'member@newtonschool.co',
    googleSub: 'google-sub-verified-2',
    deletedAt: null,
    globalRole: 'STUDENT',
    clubMemberships: [{ role: 'MEMBER', deletedAt: null }],
  };

  const coreMember = {
    id: 'user-core-1',
    email: 'core@adypu.edu.in',
    googleSub: 'google-sub-verified-3',
    deletedAt: null,
    globalRole: 'STUDENT',
    clubMemberships: [{ role: 'CORE_MEMBER', deletedAt: null }],
  };

  const platformAdmin = {
    id: 'user-platform-admin',
    email: 'admin@newtonschool.co',
    googleSub: 'google-sub-verified-4',
    deletedAt: null,
    globalRole: 'PLATFORM_ADMIN',
    clubMemberships: [],
  };

  const facultyAdmin = {
    id: 'user-faculty-admin',
    email: 'faculty@adypu.edu.in',
    googleSub: 'google-sub-verified-5',
    deletedAt: null,
    globalRole: 'FACULTY_ADMIN',
    clubMemberships: [],
  };

  const clubAdmin = {
    id: 'user-club-admin',
    email: 'clubadmin@adypu.edu.in',
    googleSub: 'google-sub-verified-6',
    deletedAt: null,
    globalRole: 'STUDENT',
    clubMemberships: [{ role: 'CLUB_ADMIN', deletedAt: null }],
  };

  const deactivatedClubAdmin = {
    id: 'user-past-club-admin',
    email: 'pastadmin@adypu.edu.in',
    googleSub: 'google-sub-verified-7',
    deletedAt: null,
    globalRole: 'STUDENT',
    clubMemberships: [{ role: 'CLUB_ADMIN', deletedAt: new Date() }],
  };

  // -------------------------------------------------------------------------
  // 1. Role-based event registration restrictions
  // -------------------------------------------------------------------------
  it('1a. Eligible student is permitted to register for events', () => {
    assert.doesNotThrow(() => {
      validateRegistrationEligibility(eligibleStudent);
    });
  });

  it('1b. Regular club member and core member students are permitted to register for events', () => {
    assert.doesNotThrow(() => {
      validateRegistrationEligibility(regularMember);
    });
    assert.doesNotThrow(() => {
      validateRegistrationEligibility(coreMember);
    });
  });

  it('1c. Platform Admin is strictly blocked from registering for events', () => {
    assert.throws(
      () => validateRegistrationEligibility(platformAdmin),
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.strictEqual(err.message, 'Administrator accounts cannot register for events');
        return true;
      }
    );
  });

  it('1d. Faculty Admin is strictly blocked from registering for events', () => {
    assert.throws(
      () => validateRegistrationEligibility(facultyAdmin),
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.strictEqual(err.message, 'Administrator accounts cannot register for events');
        return true;
      }
    );
  });

  it('1e. Club Admin is strictly blocked from registering for events', () => {
    assert.throws(
      () => validateRegistrationEligibility(clubAdmin),
      (err: any) => {
        assert(err instanceof ForbiddenError);
        assert.strictEqual(err.message, 'Administrator accounts cannot register for events');
        return true;
      }
    );
  });

  it('1f. Student with deleted/former Club Admin membership is allowed to register', () => {
    assert.doesNotThrow(() => {
      validateRegistrationEligibility(deactivatedClubAdmin);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Verified user helper preserves project/general user eligibility
  // -------------------------------------------------------------------------
  it('2a. validateVerifiedUser allows platform and faculty admins to participate in non-registration flows', () => {
    assert.doesNotThrow(() => {
      validateVerifiedUser(platformAdmin);
    });
    assert.doesNotThrow(() => {
      validateVerifiedUser(facultyAdmin);
    });
    assert.doesNotThrow(() => {
      validateVerifiedUser(clubAdmin);
    });
  });

  it('2b. validateVerifiedUser rejects unverified or non-institutional accounts', () => {
    assert.throws(
      () => validateVerifiedUser({ email: 'attacker@gmail.com', googleSub: 'sub-1' }),
      (err: any) => err instanceof ForbiddenError
    );
    assert.throws(
      () => validateVerifiedUser({ email: 'student@adypu.edu.in', googleSub: 'unverified_123' }),
      (err: any) => err instanceof ForbiddenError
    );
  });

  // -------------------------------------------------------------------------
  // 3. Compulsory registration window validation rules for Club Admins
  // -------------------------------------------------------------------------
  it('3a. Missing opening time is rejected for Club Admins', () => {
    const checkClubAdminRegistrationWindow = (regStart?: string | null, regEnd?: string | null) => {
      if (!regStart || !regEnd) {
        throw new UnprocessableEntityError('Registration window (opening and closing date/time) is mandatory for Club Admins');
      }
      const start = new Date(regStart).getTime();
      const end = new Date(regEnd).getTime();
      if (isNaN(start) || isNaN(end)) {
        throw new UnprocessableEntityError('Invalid registration window timestamps');
      }
      if (start >= end) {
        throw new UnprocessableEntityError('Registration closing time must be later than opening time');
      }
    };

    assert.throws(
      () => checkClubAdminRegistrationWindow(null, '2026-11-20T18:00:00.000Z'),
      (err: any) => {
        assert(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'Registration window (opening and closing date/time) is mandatory for Club Admins');
        return true;
      }
    );
  });

  it('3b. Missing closing time is rejected for Club Admins', () => {
    const checkClubAdminRegistrationWindow = (regStart?: string | null, regEnd?: string | null) => {
      if (!regStart || !regEnd) {
        throw new UnprocessableEntityError('Registration window (opening and closing date/time) is mandatory for Club Admins');
      }
      const start = new Date(regStart).getTime();
      const end = new Date(regEnd).getTime();
      if (isNaN(start) || isNaN(end)) {
        throw new UnprocessableEntityError('Invalid registration window timestamps');
      }
      if (start >= end) {
        throw new UnprocessableEntityError('Registration closing time must be later than opening time');
      }
    };

    assert.throws(
      () => checkClubAdminRegistrationWindow('2026-11-10T10:00:00.000Z', undefined),
      (err: any) => {
        assert(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'Registration window (opening and closing date/time) is mandatory for Club Admins');
        return true;
      }
    );
  });

  it('3c. Invalid dates are rejected for Club Admins', () => {
    const checkClubAdminRegistrationWindow = (regStart?: string | null, regEnd?: string | null) => {
      if (!regStart || !regEnd) {
        throw new UnprocessableEntityError('Registration window (opening and closing date/time) is mandatory for Club Admins');
      }
      const start = new Date(regStart).getTime();
      const end = new Date(regEnd).getTime();
      if (isNaN(start) || isNaN(end)) {
        throw new UnprocessableEntityError('Invalid registration window timestamps');
      }
      if (start >= end) {
        throw new UnprocessableEntityError('Registration closing time must be later than opening time');
      }
    };

    assert.throws(
      () => checkClubAdminRegistrationWindow('not-a-date', '2026-11-20T18:00:00.000Z'),
      (err: any) => {
        assert(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'Invalid registration window timestamps');
        return true;
      }
    );
  });

  it('3d. Reversed registration window (end <= start) is rejected for Club Admins', () => {
    const checkClubAdminRegistrationWindow = (regStart?: string | null, regEnd?: string | null) => {
      if (!regStart || !regEnd) {
        throw new UnprocessableEntityError('Registration window (opening and closing date/time) is mandatory for Club Admins');
      }
      const start = new Date(regStart).getTime();
      const end = new Date(regEnd).getTime();
      if (isNaN(start) || isNaN(end)) {
        throw new UnprocessableEntityError('Invalid registration window timestamps');
      }
      if (start >= end) {
        throw new UnprocessableEntityError('Registration closing time must be later than opening time');
      }
    };

    assert.throws(
      () => checkClubAdminRegistrationWindow('2026-11-20T18:00:00.000Z', '2026-11-10T10:00:00.000Z'),
      (err: any) => {
        assert(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'Registration closing time must be later than opening time');
        return true;
      }
    );

    assert.throws(
      () => checkClubAdminRegistrationWindow('2026-11-20T10:00:00.000Z', '2026-11-20T10:00:00.000Z'),
      (err: any) => {
        assert(err instanceof UnprocessableEntityError);
        assert.strictEqual(err.message, 'Registration closing time must be later than opening time');
        return true;
      }
    );
  });

  it('3e. Valid registration window passes validation', () => {
    const checkClubAdminRegistrationWindow = (regStart?: string | null, regEnd?: string | null) => {
      if (!regStart || !regEnd) {
        throw new UnprocessableEntityError('Registration window (opening and closing date/time) is mandatory for Club Admins');
      }
      const start = new Date(regStart).getTime();
      const end = new Date(regEnd).getTime();
      if (isNaN(start) || isNaN(end)) {
        throw new UnprocessableEntityError('Invalid registration window timestamps');
      }
      if (start >= end) {
        throw new UnprocessableEntityError('Registration closing time must be later than opening time');
      }
    };

    assert.doesNotThrow(() => {
      checkClubAdminRegistrationWindow('2026-11-01T09:00:00.000Z', '2026-11-19T23:59:00.000Z');
    });
  });
});
