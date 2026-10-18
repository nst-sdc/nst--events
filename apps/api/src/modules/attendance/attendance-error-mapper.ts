import { UnprocessableEntityError, BadRequestError, ForbiddenError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { SQLSTATE_MAP } from '../../lib/errors/database-error-mapper';



/**
 * Maps an offline per-record error_code (SQLSTATE returned from
 * sync_offline_attendance) to a safe semantic result.
 * 
 * Returns { user_id, error_code } with a sanitized error_code.
 * Never exposes raw SQLSTATE for unknown errors.
 */
export function sanitizeOfflineError(
  record: { user_id: string; error_code: string; session_id?: string; offline_seq?: number; batch_index?: number }
): { user_id: string; error_code: string; session_id?: string; offline_seq?: number; batch_index?: number } {
  const mapping = SQLSTATE_MAP[record.error_code];

  if (mapping) {
    let semanticCode = mapping.semanticCode;
    if (semanticCode === 'OUTSIDE_GEOFENCE' || semanticCode === 'MOCK_LOCATION_REJECTED') {
      logger.info(
        { user_id: record.user_id, raw_error_code: record.error_code, internal_reason: semanticCode },
        'Offline location verification failed'
      );
      semanticCode = 'LOCATION_VERIFICATION_FAILED';
    }

    return {
      user_id: record.user_id,
      error_code: semanticCode,
      session_id: record.session_id,
      offline_seq: record.offline_seq,
      batch_index: record.batch_index,
    };
  }

  // Known semantic codes returned directly by offline sync logic
  const KNOWN_SEMANTIC_CODES = new Set([
    'SESSION_CLOSED',
    'FUTURE_TIMESTAMP',
    'INVALID_SIGNATURE',
    'DUPLICATE',
    'LOCATION_VERIFICATION_FAILED',
    'NOT_REGISTERED',
    'REGISTRATION_NOT_ELIGIBLE',
    'EVENT_LOCKED',
    'WAITLISTED',
    'SIGNATURE_ALREADY_CONSUMED',
  ]);

  if (KNOWN_SEMANTIC_CODES.has(record.error_code)) {
    return {
      user_id: record.user_id,
      error_code: record.error_code,
      session_id: record.session_id,
      offline_seq: record.offline_seq,
      batch_index: record.batch_index,
    };
  }

  // Unknown SQLSTATE: log it, return generic safe error
  logger.error(
    { user_id: record.user_id, raw_error_code: record.error_code },
    'Unknown offline attendance error SQLSTATE'
  );
  return {
    user_id: record.user_id,
    error_code: 'ATTENDANCE_ERROR',
    session_id: record.session_id,
    offline_seq: record.offline_seq,
    batch_index: record.batch_index,
  };
}
