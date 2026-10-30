import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { UnauthorizedError, ForbiddenError } from '../../lib/errors';

export interface VerifiedGoogleUser {
  sub: string;
  email: string;
  name: string;
  email_verified?: boolean;
  nonce?: string;
}

const getOAuth2Client = () =>
  new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);

export function getAuthUrl(
  stateOrOpts: string | { state: string; nonce?: string },
  maybeNonce?: string
): string {
  let state: string;
  let nonce: string | undefined;

  if (typeof stateOrOpts === 'object' && stateOrOpts !== null) {
    state = stateOrOpts.state;
    nonce = stateOrOpts.nonce;
  } else {
    state = stateOrOpts;
    nonce = maybeNonce;
  }

  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    scope: ['openid', 'email', 'profile'],
    state,
    ...(nonce ? { nonce } : {}),
    redirect_uri: env.GOOGLE_CALLBACK_URL,
  });
}

export const generateAuthUrl = getAuthUrl;

export async function exchangeCodeForTokens(code: string): Promise<{ id_token: string }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken({
    code,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
  });
  if (!tokens.id_token) {
    throw new UnauthorizedError('Google OAuth failed to return id_token');
  }
  return { id_token: tokens.id_token };
}

export async function verifyIdToken(idToken: string, expectedNonce?: string): Promise<VerifiedGoogleUser> {
  const oauth2Client = getOAuth2Client();
  const ticket = await oauth2Client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new UnauthorizedError('Invalid Google id_token payload');
  }
  if (payload.email_verified === false) {
    throw new ForbiddenError('EMAIL_NOT_VERIFIED: Institutional email address is not verified by Google');
  }
  const nonce = (payload as unknown as Record<string, unknown>).nonce as string | undefined;
  if (expectedNonce !== undefined) {
    if (!nonce || nonce !== expectedNonce) {
      throw new UnauthorizedError('Invalid or mismatched OAuth nonce');
    }
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0] || 'Unknown User',
    email_verified: payload.email_verified,
    nonce,
  };
}

export const googleOAuth = {
  getAuthUrl,
  generateAuthUrl,
  exchangeCodeForTokens,
  verifyIdToken,
};
