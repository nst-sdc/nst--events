import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import {
  getClearRefreshTokenCookieOptions,
  getClearUserRoleCookieOptions,
  getOAuthStateCookieOptions,
  getRefreshTokenCookieOptions,
  getUserRoleCookieOptions,
  OAUTH_STATE_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  USER_ROLE_COOKIE_NAME,
} from '../../lib/cookies';
import { BadRequestError, UnauthorizedError } from '../../lib/errors';
import { googleCallbackQuerySchema } from './auth.schema';
import { authService } from './auth.service';
import { googleOAuth } from './google.oauth';
import { env } from '../../config/env';
import { createMobileAuthCode, redeemMobileAuthCode } from './mobile-auth-codes';
import { authEventsService } from './auth-events.service';

export const authRouter: Router = Router();
export const OAUTH_NONCE_COOKIE_NAME = 'oauth_nonce';

authRouter.get(
  '/google',
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const state = crypto.randomBytes(16).toString('hex');
      const nonce = crypto.randomBytes(16).toString('hex');
      const platform = req.query.platform === 'mobile' ? 'mobile' : 'web';
      const statePayload = `${state}:${platform}`;
      res.cookie(OAUTH_STATE_COOKIE_NAME, statePayload, getOAuthStateCookieOptions());
      res.cookie(OAUTH_NONCE_COOKIE_NAME, nonce, getOAuthStateCookieOptions());
      const authUrl = googleOAuth.generateAuthUrl(statePayload, nonce);
      res.redirect(authUrl);
    } catch (err) {
      next(err);
    }
  }
);

authRouter.get(
  '/google/callback',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let platform = 'web';
    try {
      const query = googleCallbackQuerySchema.parse(req.query);
      const cookieState =
        req.signedCookies?.[OAUTH_STATE_COOKIE_NAME] ||
        req.cookies?.[OAUTH_STATE_COOKIE_NAME];
      if (!cookieState || cookieState !== query.state) {
        throw new UnauthorizedError('Invalid OAuth state parameter');
      }
      platform = cookieState.split(':').pop() || 'web';

      const cookieNonce =
        req.signedCookies?.[OAUTH_NONCE_COOKIE_NAME] ||
        req.cookies?.[OAUTH_NONCE_COOKIE_NAME];
      if (!cookieNonce) {
        throw new UnauthorizedError('Missing OAuth nonce');
      }

      const { id_token } = await googleOAuth.exchangeCodeForTokens(query.code);
      const googleUser = await googleOAuth.verifyIdToken(id_token, cookieNonce);
      if (!googleUser.nonce || googleUser.nonce !== cookieNonce) {
        throw new UnauthorizedError('Invalid or mismatched OAuth nonce');
      }

      const result = await authService.loginWithIdToken(
        id_token,
        req.ip,
        req.headers['user-agent']
      );

      authEventsService.log({
        eventType: 'LOGIN_SUCCESS',
        userId: result.user?.id,
        platform: platform === 'mobile' ? 'mobile' : 'web',
        req,
      });

      res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/auth' });
      res.clearCookie(OAUTH_NONCE_COOKIE_NAME, { path: '/auth' });

      if (platform === 'mobile') {
        // Mobile: create a single-use code and redirect to the app deep link
        const mobileCode = await createMobileAuthCode(result);
        res.redirect(303, `nst-events://(auth)/callback?code=${mobileCode}`);
      } else {
        // Web: existing cookie-based flow
        res.cookie(
          REFRESH_TOKEN_COOKIE_NAME,
          result.refreshToken,
          getRefreshTokenCookieOptions()
        );

        if (result.user?.global_role) {
          res.cookie(
            USER_ROLE_COOKIE_NAME,
            result.user.global_role,
            getUserRoleCookieOptions()
          );
        }

        const isStudent = result.user?.global_role === 'STUDENT';
        const targetUrl = isStudent ? `${env.WEB_APP_URL}/student/home` : `${env.WEB_APP_URL}/dashboard`;
        res.redirect(303, targetUrl);
      }
    } catch (err: any) {
      console.error('Login Error:', err);
      authEventsService.log({
        eventType: 'LOGIN_FAILED',
        platform: platform === 'mobile' ? 'mobile' : 'web',
        req,
        failureReason: err?.message || 'authentication_failed',
      });

      res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/auth' });
      res.clearCookie(OAUTH_NONCE_COOKIE_NAME, { path: '/auth' });

      if (req.headers.accept?.includes('application/json')) {
        const status = err.statusCode || 401;
        res.status(status).json({
          error: err.message || 'authentication_failed',
          statusCode: status,
        });
        return;
      }

      const errorCode = ['INSTITUTIONAL_DOMAIN_NOT_ALLOWED', 'STUDENT_ACCESS_NOT_AUTHORIZED', 'Account deactivated'].includes(err.message)
        ? err.message
        : 'authentication_failed';

      if (platform === 'mobile') {
        res.redirect(303, `nst-events://(auth)/callback?error=${errorCode}`);
      } else {
        res.redirect(303, `${env.WEB_APP_URL}/login?error=${errorCode}`);
      }
    }
  }
);

authRouter.post(
  '/mobile/login-id-token',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id_token } = req.body;
      if (!id_token || typeof id_token !== 'string') {
        throw new UnauthorizedError('Missing or invalid id_token');
      }

      const result = await authService.loginWithIdToken(
        id_token,
        req.ip,
        req.headers['user-agent']
      );

      authEventsService.log({
        eventType: 'LOGIN_SUCCESS',
        userId: result.user?.id,
        platform: 'mobile',
        req,
      });

      res.status(200).json({
        access_token: result.access_token,
        refresh_token: result.refreshToken,
        expires_in: result.expires_in,
      });
    } catch (err: any) {
      authEventsService.log({
        eventType: 'LOGIN_FAILED',
        platform: 'mobile',
        req,
        failureReason: err?.message || 'Login failed',
      });
      next(err);
    }
  }
);

authRouter.post(
  '/mobile/exchange',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        throw new UnauthorizedError('Missing or invalid authorization code');
      }

      const result = await redeemMobileAuthCode(code);
      if (!result) {
        throw new UnauthorizedError('Invalid, expired, or already-used authorization code');
      }

      authEventsService.log({
        eventType: 'LOGIN_SUCCESS',
        userId: result.user?.id,
        platform: 'mobile',
        req,
      });

      res.status(200).json({
        access_token: result.access_token,
        refresh_token: result.refreshToken,
        expires_in: result.expires_in,
      });
    } catch (err: any) {
      authEventsService.log({
        eventType: 'LOGIN_FAILED',
        platform: 'mobile',
        req,
        failureReason: err?.message || 'Exchange failed',
      });
      next(err);
    }
  }
);

/**
 * SEC-11: Defense-in-depth CSRF mitigation for cookie-authenticated state-changing auth endpoints.
 * Enforces requirement for custom header `X-Client-Platform: web|mobile`.
 * Cross-site forms, scripts, and simple cross-origin requests cannot set custom headers.
 */
export function validateClientPlatform(req: Request, _res: Response, next: NextFunction): void {
  const platform = req.header('x-client-platform')?.trim().toLowerCase();
  if (!platform || (platform !== 'web' && platform !== 'mobile')) {
    throw new BadRequestError('Missing or invalid X-Client-Platform header. Expected "web" or "mobile".');
  }
  next();
}

authRouter.post(
  '/refresh',
  validateClientPlatform,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawRefreshToken =
        req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
        req.signedCookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
        req.body?.refresh_token;
      if (!rawRefreshToken) {
        throw new UnauthorizedError('Missing refresh token cookie');
      }

      const result = await authService.refreshTokens(
        rawRefreshToken,
        req.ip,
        req.headers['user-agent']
      );

      res.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        result.refreshToken,
        getRefreshTokenCookieOptions()
      );

      if (result.user?.global_role) {
        res.cookie(
          USER_ROLE_COOKIE_NAME,
          result.user.global_role,
          getUserRoleCookieOptions()
        );
      }

      res.status(200).json({
        access_token: result.access_token,
        expires_in: result.expires_in,
        refresh_token: result.refreshToken,
        user: result.user,
      });
    } catch (err: any) {
      if (!err?.message?.includes('reuse detected')) {
        authEventsService.log({
          eventType: 'REFRESH_FAILED',
          req,
          failureReason: err?.message || 'Refresh failed',
        });
      }
      next(err);
    }
  }
);

authRouter.post(
  '/logout',
  validateClientPlatform,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawRefreshToken =
        req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
        req.cookies?.refresh_token ||
        req.signedCookies?.[REFRESH_TOKEN_COOKIE_NAME] ||
        req.signedCookies?.refresh_token ||
        req.body?.refresh_token;

      let userId: string | null = null;
      if (rawRefreshToken) {
        try {
          const logoutResult = await authService.logout(rawRefreshToken);
          userId = logoutResult?.userId ?? null;
        } catch {
          // Idempotent: don't fail logout even if DB error or race
        }
      }

      authEventsService.log({
        eventType: 'LOGOUT',
        userId,
        req,
      });

      res.clearCookie(
        REFRESH_TOKEN_COOKIE_NAME,
        getClearRefreshTokenCookieOptions()
      );
      res.clearCookie(
        USER_ROLE_COOKIE_NAME,
        getClearUserRoleCookieOptions()
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);


