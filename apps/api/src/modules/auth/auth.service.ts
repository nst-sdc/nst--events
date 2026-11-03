import crypto from 'crypto';
import { Prisma, User, withUserContext } from '@nst/database';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors';
import { AssignmentSource } from '@nst/database';
import { generateRefreshToken, hashToken } from '../../lib/hash';
import { signJwt } from '../../lib/jwt';
import { googleOAuth } from './google.oauth';
import { parseAdypuEmail } from './academic-parser';
import { projectsService } from '../projects/projects.service';
import { authEventsService } from './auth-events.service';

export interface AuthTokenResponse {
  access_token: string;
  expires_in: number;
  user?: {
    id: string;
    email: string;
    full_name: string;
    global_role: string;
  };
  refreshToken: string;
}

export async function loginWithGoogle(
  code: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthTokenResponse> {
  const { id_token } = await googleOAuth.exchangeCodeForTokens(code);
  return loginWithIdToken(id_token, ipAddress, userAgent);
}

export async function loginWithIdToken(
  id_token: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthTokenResponse> {
  const { sub, email, name, email_verified } = await googleOAuth.verifyIdToken(id_token);

  if (email_verified === false) {
    throw new ForbiddenError('EMAIL_NOT_VERIFIED: Institutional email address is not verified by Google');
  }

  // 2. Enforce email domain restriction
  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split('@')[1];

  const ALLOWED_DOMAINS = env.ALLOWED_EMAIL_DOMAINS.split(',').map((d) => d.trim().toLowerCase());
  if (!ALLOWED_DOMAINS.includes(domain)) {
    throw new ForbiddenError('INSTITUTIONAL_DOMAIN_NOT_ALLOWED');
  }

  if (domain === 'adypu.edu.in') {
    const result = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT * FROM lookup_authorized_student(${normalizedEmail})
    `;
    if (!result || result.length === 0 || result[0].status !== 'ACTIVE') {
      throw new ForbiddenError('STUDENT_ACCESS_NOT_AUTHORIZED');
    }
  }

  // 3. Upsert user by googleSub with concurrency / unique-constraint race handling
  let user;
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await prisma.$queryRaw<any[]>`
        SELECT * FROM upsert_oauth_user(${sub}, ${normalizedEmail}, ${name})
      `;

      if (!result || result.length === 0) {
        throw new ForbiddenError('Account deactivated');
      }
      user = result[0];
      break;
    } catch (err: any) {
      if (err instanceof ForbiddenError) {
        throw err;
      }

      if (
        err.message?.includes('ACCOUNT_LINK_CONFLICT') ||
        err.meta?.code === 'U0001' ||
        String(err.message).includes('U0001')
      ) {
        throw new ForbiddenError('Email is already linked to another Google account');
      }

      const isUniqueConflict =
        (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') ||
        (err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2010' &&
          (err.meta?.code === '23505' || String(err.message).includes('23505'))) ||
        err?.code === '23505' ||
        String(err?.message).includes('23505') ||
        String(err?.message).includes('unique constraint') ||
        String(err?.message).includes('duplicate key');

      if (isUniqueConflict && attempt < maxRetries) {
        // Wait briefly for the concurrent transaction to commit, then retry via upsert_oauth_user
        await new Promise((resolve) => setTimeout(resolve, 50 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }

  if (!user) {
    throw new Error('Race condition during user creation: user not found');
  }

  // Ensure an established Google identity was not replaced by an unauthorized subject
  const establishedSub = user.google_sub || user.googleSub;
  if (
    establishedSub &&
    establishedSub !== sub &&
    !establishedSub.startsWith('provisioned:') &&
    !establishedSub.startsWith('pending-oauth-') &&
    !establishedSub.startsWith('unverified')
  ) {
    throw new ForbiddenError('Email is already linked to another Google account');
  }

  // Map raw row back to camelCase for the rest of the function if it came from queryRaw
  const mappedUser = {
    id: user.id,
    googleSub: user.google_sub || user.googleSub,
    email: user.email,
    fullName: user.full_name || user.fullName,
    globalRole: user.global_role || user.globalRole,
    deletedAt: user.deleted_at ?? user.deletedAt ?? null,
    securityVersion: user.security_version ?? user.securityVersion ?? 1,
  };

  // 4. Reject if soft-deleted
  if (mappedUser.deletedAt !== null) {
    throw new ForbiddenError('Account deactivated');
  }

  // Wrap subsequent operations in user context since the user is now identified
  const { accessToken, rawRefreshToken } = await withUserContext(mappedUser.id, async (tx) => {
    // The default FACULTY_MENTOR role for newtonschool.co is now assigned securely within upsert_oauth_user.

    // 4b. Academic Profile First-Login Assignment
    try {
      const existingProfile = await tx.userAcademicProfile.findUnique({
        where: { userId: mappedUser.id },
      });

      if (!existingProfile) {
        const inference = parseAdypuEmail(mappedUser.email);
        if (inference) {
          // The academic signal is the cohort (admission) year encoded in the
          // institutional email (e.g. e25b070639 -> 2025). Program codes in the
          // directory do not necessarily equal the single-letter email prefix
          // (e.g. "BTECH-CSE"), so resolve by admission year and only
          // auto-assign when the mapping is unambiguous.
          const candidateBatches = await tx.academicBatch.findMany({
            where: {
              admissionYear: inference.admissionYear,
            },
          });

          if (candidateBatches.length === 1) {
            await tx.userAcademicProfile.createMany({
              data: [{
                userId: mappedUser.id,
                batchId: candidateBatches[0].id,
                assignmentSource: AssignmentSource.INSTITUTIONAL_EMAIL_INFERENCE,
              }],
              skipDuplicates: true,
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to assign academic profile on login:', err);
    }

    // 4c. Student Profile Auto-Provisioning
    if (mappedUser.globalRole === 'STUDENT') {
      try {
        await tx.$executeRaw`SELECT provision_student_profile(${mappedUser.id}::uuid)`;
      } catch (err) {
        console.error('Failed to auto-provision student profile on login:', err);
      }
    }

    // 4d. Reconcile any pending collaborator invitations for this institutional email
    try {
      await projectsService.reconcilePendingInvitations(tx, mappedUser.id, mappedUser.email);
    } catch (err) {
      console.error('Failed to reconcile pending collaborator invitations on login:', err);
    }

    // 5. Issue access JWT & refresh token
    const token = signJwt(mappedUser.id, mappedUser.securityVersion);
    const refresh = generateRefreshToken();
    const tokenHash = hashToken(refresh);
    
    await tx.refreshToken.create({
      data: {
        userId: mappedUser.id,
        tokenHash,
        familyId: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
    });

    return { accessToken: token, rawRefreshToken: refresh };
  });

  return {
    access_token: accessToken,
    expires_in: 900,
    user: {
      id: mappedUser.id,
      email: mappedUser.email,
      full_name: mappedUser.fullName,
      global_role: mappedUser.globalRole,
    },
    refreshToken: rawRefreshToken,
  };
}

export async function refreshTokens(
  rawRefreshToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthTokenResponse> {
  if (!rawRefreshToken) {
    throw new UnauthorizedError('Missing refresh token');
  }

  const tokenHash = hashToken(rawRefreshToken);

  type RefreshTxResult =
    | { kind: 'success'; data: AuthTokenResponse }
    | { kind: 'reuse_detected'; userId: string };

  const result = await prisma.$transaction<RefreshTxResult>(async (tx) => {
    // 1. Lookup refresh token using the SECURITY DEFINER RPC
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        user_id: string;
        family_id: string;
        expires_at: Date;
        revoked_at: Date | null;
      }>
    >`SELECT * FROM lookup_refresh_token(${tokenHash})`;

    const existingToken = rows[0];
    if (!existingToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const now = new Date();

    // Set transaction context immediately so subsequent updates pass RLS checks
    await tx.$executeRaw`SELECT set_config('app.user_id', ${existingToken.user_id}, true)`;

    // 2. If revoked_at IS NOT NULL -> theft or race check
    if (existingToken.revoked_at !== null) {
      const deltaSeconds =
        (now.getTime() - new Date(existingToken.revoked_at).getTime()) / 1000;
      if (deltaSeconds <= 5) {
        // Benign concurrent-request race: return 401 without touching family_id
        throw new UnauthorizedError('Refresh token already used concurrently');
      } else {
        // Theft detected: revoke all rows with that family_id and commit write
        await tx.refreshToken.updateMany({
          where: {
            familyId: existingToken.family_id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });
        return { kind: 'reuse_detected', userId: existingToken.user_id };
      }
    }

    // 3. Reject if expired
    if (new Date(existingToken.expires_at) < now) {
      throw new UnauthorizedError('Refresh token expired');
    }

    // 4. Check user soft-delete
    const user = await tx.user.findUnique({
      where: { id: existingToken.user_id },
    });
    if (!user || user.deletedAt !== null) {
      throw new ForbiddenError('Account deactivated');
    }

    // 5. Normal rotation: revoke this row, insert child row with same family_id
    await tx.refreshToken.update({
      where: { id: existingToken.id },
      data: { revokedAt: now },
    });

    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        familyId: existingToken.family_id,
        expiresAt: newExpiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
    });

    const accessToken = signJwt(user.id, user.securityVersion);

    return {
      kind: 'success',
      data: {
        access_token: accessToken,
        expires_in: 900,
        refreshToken: newRawRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.fullName || '',
          global_role: user.globalRole,
        },
      },
    };
  });

  if (result.kind === 'reuse_detected') {
    await authEventsService.logSynchronousEvent({
      eventType: 'REUSE_DETECTED',
      userId: result.userId,
      ip: ipAddress,
      userAgent,
      failureReason: 'Refresh token reuse detected; all sessions revoked',
    });
    throw new UnauthorizedError('Refresh token reuse detected; all sessions revoked');
  }


  return result.data;
}

export async function logout(rawRefreshToken?: string): Promise<{ userId: string | null }> {
  if (!rawRefreshToken) {
    return { userId: null };
  }
  const tokenHash = hashToken(rawRefreshToken);
  let resolvedUserId: string | null = null;
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ family_id: string; user_id: string }>>`
      SELECT family_id, user_id FROM lookup_refresh_token(${tokenHash})
    `;
    const token = rows[0];
    if (!token?.family_id) {
      return;
    }
    resolvedUserId = token.user_id;
    await tx.$executeRaw`SELECT revoke_refresh_token_family(${token.family_id}::uuid)`;
  });
  return { userId: resolvedUserId };
}

export const authService = {
  loginWithGoogle,
  loginWithIdToken,
  refreshTokens,
  logout,
};


