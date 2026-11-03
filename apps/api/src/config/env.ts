import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters long'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_CALLBACK_URL: z.string().url('GOOGLE_CALLBACK_URL must be a valid URL'),
  ALLOWED_EMAIL_DOMAINS: z.string().default('adypu.edu.in,newtonschool.co'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  WEB_APP_URL: z.string().url('WEB_APP_URL must be a valid URL').default('http://localhost:3000'),
  ALLOW_INSECURE_COOKIES_LOCAL_DEV: z.coerce.boolean().default(false),
  MIN_APP_VERSION: z.string().default('1.0.0'),
  RATE_LIMIT_REPLICAS: z.coerce.number().min(1).default(2),
  RATE_LIMIT_USER_MAX: z.coerce.number().min(1).default(2000),
  RATE_LIMIT_UNAUTH_MAX: z.coerce.number().min(1).default(2000),
  // Legacy auth limit and default cap for failed attempts on OAuth routes (e.g. 600 cluster / 2 replicas = 300/replica)
  RATE_LIMIT_AUTH_MAX: z.coerce.number().min(1).default(600),
  // Dedicated cap for failed/rejected OAuth attempts per IP (status >= 400), sized for 3,000+ students on shared NAT
  RATE_LIMIT_AUTH_FAILED_MAX: z.coerce.number().min(1).default(600),
  // Dedicated cap per refresh token (keyed by SHA-256) per window (e.g. 60 cluster / 2 replicas = 30/replica)
  RATE_LIMIT_AUTH_TOKEN_MAX: z.coerce.number().min(1).default(60),
  // Generous fallback limit when refresh token is absent on /auth/refresh or /auth/logout (prevents locking shared NAT)
  RATE_LIMIT_AUTH_UNAUTH_MAX: z.coerce.number().min(1).default(2000),
  // Per-IP ceiling applied to /auth/refresh and /auth/logout regardless of token presence to prevent token-rotation bypass
  RATE_LIMIT_AUTH_IP_CEILING_MAX: z.coerce.number().min(1).default(5000),
  RATE_LIMIT_ATTENDANCE_MAX: z.coerce.number().min(1).default(500),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(15 * 60 * 1000),
  CAMPUS_CIDR_BLOCKS: z.string().default(''),
  CAMPUS_EGRESS_CIDRS: z.string().default(''),
  AUTH_EVENTS_IP_PEPPER: z
    .string({ required_error: 'AUTH_EVENTS_IP_PEPPER is required via environment variable' })
    .min(1, 'AUTH_EVENTS_IP_PEPPER is required via environment variable'),

  AUTH_EVENTS_STORE_RAW_IP: z.coerce.boolean().default(false),
  AUTH_EVENTS_RETENTION_DAYS: z.coerce.number().min(1).default(90),
  METRICS_TOKEN: z.string().default(''),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (
      !data.AUTH_EVENTS_IP_PEPPER ||
      data.AUTH_EVENTS_IP_PEPPER === 'nst-events-auth-ip-pepper-default-salt' ||
      data.AUTH_EVENTS_IP_PEPPER.trim() === ''
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_EVENTS_IP_PEPPER'],
        message:
          'In production (NODE_ENV=production), AUTH_EVENTS_IP_PEPPER must be set and must not equal the committed default',
      });
    }

    if (!data.METRICS_TOKEN || data.METRICS_TOKEN.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['METRICS_TOKEN'],
        message: 'In production (NODE_ENV=production), METRICS_TOKEN must be set and cannot be empty',
      });
    }
  }
});

export { envSchema };
export type Env = z.infer<typeof envSchema>;

export function assertProductionConfig(config: Env): void {
  if (config.NODE_ENV === 'production') {
    if (
      !config.AUTH_EVENTS_IP_PEPPER ||
      config.AUTH_EVENTS_IP_PEPPER === 'nst-events-auth-ip-pepper-default-salt' ||
      config.AUTH_EVENTS_IP_PEPPER.trim() === ''
    ) {
      throw new Error(
        '[STARTUP_VALIDATION_FAILED] Production startup halted: AUTH_EVENTS_IP_PEPPER must be set and must not equal the committed default.'
      );
    }
    if (!config.METRICS_TOKEN || config.METRICS_TOKEN.trim() === '') {
      throw new Error(
        '[STARTUP_VALIDATION_FAILED] Production startup halted: METRICS_TOKEN must be set in production.'
      );
    }
  }
}

export function validateEnv(rawEnv: Record<string, any> = process.env): Env {
  const parsed = envSchema.parse(rawEnv);
  assertProductionConfig(parsed);
  return parsed;
}

export const env = envSchema.parse(process.env);
assertProductionConfig(env);
export default env;


