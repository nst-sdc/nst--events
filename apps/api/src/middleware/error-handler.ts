import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const instance = req.originalUrl || req.url;
  const requestId = req.id;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, request_id: requestId, instance }, err.message);
    }
    let detail = err.message;

    if (detail === 'OUTSIDE_GEOFENCE' || detail === 'MOCK_LOCATION_REJECTED') {
      logger.info({ request_id: requestId, instance, internal_reason: detail }, 'Location verification failed');
      detail = 'LOCATION_VERIFICATION_FAILED';
    }

    res.status(err.statusCode).json({
      type: err.type,
      title: err.title,
      status: err.statusCode,
      detail: detail,
      instance,
      request_id: requestId,
    });
    return;
  }

  if (err instanceof z.ZodError) {
    console.error("ZodError Issues:", JSON.stringify(err.issues, null, 2));
    const detail = err.issues.map((issue) => issue.message).join(', ');
    res.status(400).json({
      type: 'https://api.nstsdc.org/errors/bad-request',
      title: 'Bad Request',
      status: 400,
      detail,
      instance,
      request_id: requestId,
    });
    return;
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    ('type' in err || 'status' in err || 'statusCode' in err) &&
    ((err as any).type === 'entity.too.large' || (err as any).status === 413 || (err as any).statusCode === 413)
  ) {
    res.status(413).json({
      type: 'https://api.nstsdc.org/errors/payload-too-large',
      title: 'Payload Too Large',
      status: 413,
      detail: (err as any).message || 'Request payload exceeds server limits',
      instance,
      request_id: requestId,
    });
    return;
  }

  const message =
    err instanceof Error ? err.message : 'An unexpected error occurred';
  const detail =
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : message;

  // Log unhandled exceptions as critical
  logger.error({ err, request_id: requestId, instance }, message);

  res.status(500).json({
    type: 'https://api.nstsdc.org/errors/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail,
    instance,
    request_id: requestId,
  });
}

export default errorHandler;
