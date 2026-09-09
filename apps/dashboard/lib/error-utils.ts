/**
 * Human-readable error message mapper for Web Dashboard.
 * Maps backend semantic error codes (SQLSTATE codes, domain codes, and business errors)
 * into actionable, clear feedback matching the mobile experience.
 */

export const ERROR_MESSAGES: Record<string, string> = {
  // Authentication & Directory
  INSTITUTIONAL_DOMAIN_NOT_ALLOWED:
    'Access is restricted to institutional accounts (@adypu.edu.in and @newtonschool.co).',
  STUDENT_ACCESS_NOT_AUTHORIZED:
    'Your account is not listed in the active NST Student Directory. Please contact your academic coordinator.',
  UNAUTHORIZED:
    'You are not authorized to perform this action. Please check your permissions or sign in again.',
  FORBIDDEN:
    'You do not have permission to access this resource.',
  INVALID_CREDENTIALS:
    'The provided credentials could not be verified.',

  // Academic & Eligibility
  AUDIENCE_NOT_ELIGIBLE:
    'You are not academically eligible for this event.',
  ACADEMICALLY_INELIGIBLE:
    'You do not meet the academic eligibility criteria for this event.',
  ACADEMIC_PROFILE_MISSING:
    'Your academic profile is incomplete. Please contact support.',

  // Event & Session Status
  EVENT_LOCKED:
    'This event is locked. No further modifications, registrations, or attendance can be changed.',
  EVENT_NOT_FOUND:
    'The requested event could not be found.',
  EVENT_NOT_PUBLISHED:
    'This event is not currently published.',
  EVENT_MUST_BE_DRAFT:
    'The event must be in DRAFT state to perform this modification.',
  EVENT_MUST_BE_PENDING:
    'The event must be pending approval to take this action.',
  SESSION_CLOSED:
    'This attendance session has ended and is no longer accepting check-ins.',
  SESSION_NOT_FOUND:
    'The requested attendance session could not be found.',

  // Geofence & Attendance
  OUTSIDE_GEOFENCE:
    'You are outside the designated attendance perimeter for this venue.',
  MOCK_LOCATION_REJECTED:
    'Mock location or location spoofing detected. Check-in rejected.',
  LOCATION_UNAVAILABLE:
    'Precise GPS location is unavailable. Ensure location permissions are granted.',
  LOCATION_UNRELIABLE:
    'GPS accuracy is insufficient to verify physical attendance.',
  ATTENDANCE_ALREADY_RECORDED:
    'Your attendance has already been recorded for this session.',
  SIGNATURE_ALREADY_CONSUMED:
    'This QR code / token has already been scanned or expired.',

  // Teams & Capacity
  TEAM_NOT_FOUND:
    'The specified team could not be found.',
  TEAM_FULL:
    'This team is already at its maximum capacity.',
  TEAM_NAME_TAKEN:
    'This team name is already taken for this event. Please choose another name.',
  ALREADY_IN_TEAM:
    'You are already part of a team for this event.',
  LEADER_CANNOT_LEAVE:
    'Team leaders cannot leave without transferring leadership first.',
  INVITATION_NOT_FOUND:
    'This team invitation could not be found or has been revoked.',
  INVITATION_EXPIRED:
    'This team invitation has expired.',
  EVENT_CAPACITY_FULL:
    'Event capacity has been reached.',

  // Disputes
  DISPUTE_WINDOW_EXPIRED:
    'The dispute submission window has expired.',
  DISPUTE_NOT_FOUND:
    'The attendance dispute could not be found.',
  DISPUTE_ALREADY_RESOLVED:
    'This dispute has already been resolved.',

  // SQLSTATE Codes
  U0001: 'You are not authorized to perform this action.',
  U0002: 'Your registration is currently waitlisted.',
  U0003: 'You are not registered for this event.',
  U0004: 'Your registration is not eligible.',
  U0005: 'This attendance session is closed.',
  U0006: 'This event is locked against further changes.',
  U0007: 'You are outside the required event location.',
  U0008: 'Mock location detected.',
  U0009: 'Location data is unavailable.',
  U0010: 'Location data is invalid.',
  U0011: 'Location accuracy is insufficient.',
  U0012: 'Academic profile is required.',
  U0013: 'You are not academically eligible.',
  U0014: 'This QR code has already been used.',
  U0021: 'This team is already full.',
  U0022: 'Event capacity is full.',
  U0024: 'This invitation has expired.',
  U0031: 'You are not academically eligible for this audience.',
  U0048: 'The dispute window has expired.',
};

/**
 * Extracts and humanizes an error message from any error object.
 */
export function formatErrorMessage(err: unknown, fallbackMessage = 'An unexpected error occurred.'): string {
  if (!err) return fallbackMessage;

  // If already a string
  if (typeof err === 'string') {
    return ERROR_MESSAGES[err] || err;
  }

  // Handle ApiError / Fetch error
  const errObj = err as Record<string, any>;
  const rawCode =
    errObj.data?.detail ||
    errObj.data?.code ||
    errObj.data?.error ||
    errObj.code ||
    errObj.message;

  if (typeof rawCode === 'string' && ERROR_MESSAGES[rawCode]) {
    return ERROR_MESSAGES[rawCode];
  }

  if (typeof errObj.message === 'string' && ERROR_MESSAGES[errObj.message]) {
    return ERROR_MESSAGES[errObj.message];
  }

  if (typeof errObj.message === 'string' && errObj.message.trim().length > 0) {
    return errObj.message;
  }

  return fallbackMessage;
}
