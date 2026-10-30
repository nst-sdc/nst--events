import { CookieOptions } from 'express';
import { env } from '../config/env';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
export const OAUTH_STATE_COOKIE_NAME = 'oauth_state';

const REFRESH_TOKEN_COOKIE_BASE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: !env.ALLOW_INSECURE_COOKIES_LOCAL_DEV,
  sameSite: 'strict',
  path: '/auth',
};

export function getRefreshTokenCookieOptions(): CookieOptions {
  return {
    ...REFRESH_TOKEN_COOKIE_BASE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };
}

export function getClearRefreshTokenCookieOptions(): CookieOptions {
  return {
    ...REFRESH_TOKEN_COOKIE_BASE_OPTIONS,
  };
}

export function getOAuthStateCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: !env.ALLOW_INSECURE_COOKIES_LOCAL_DEV,
    sameSite: 'lax',
    path: '/auth',
    maxAge: 10 * 60 * 1000, // 10 minutes
    signed: true,
  };
}

export const USER_ROLE_COOKIE_NAME = 'user_role';

export function getUserRoleCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: !env.ALLOW_INSECURE_COOKIES_LOCAL_DEV,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };
}

export function getClearUserRoleCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: !env.ALLOW_INSECURE_COOKIES_LOCAL_DEV,
    sameSite: 'lax',
    path: '/',
  };
}
