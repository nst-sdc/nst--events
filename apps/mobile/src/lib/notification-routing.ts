/**
 * Notification Deep-Link Route Resolver for NST-Events Mobile V1
 *
 * Strict Resolution Hierarchy:
 * 1. entity_ids.dispute_id exists → /(app)/disputes/[id]
 * 2. Otherwise, entity_ids.event_id exists → /(app)/events/[id]
 * 3. Otherwise, notification type === 'ROLE_CHANGED' → /(app)/profile
 * 4. Otherwise → do not navigate (returns null)
 *
 * Non-negotiable Constraints:
 * - Do NOT route using routing.target alone.
 * - Do NOT route to /invitations (team invitations are deferred for V2).
 * - Do NOT invent fallback destinations.
 */

export interface NotificationPayloadForRouting {
  type?: string;
  metadata?: {
    entity_ids?: {
      dispute_id?: string;
      event_id?: string;
      club_id?: string;
      attendance_id?: string;
      announcement_id?: string;
      team_id?: string;
    };
    routing?: {
      target?: string;
      fallback?: string;
      params?: Record<string, string>;
    };
  } | null;
}

export function resolveNotificationRoute(notification: NotificationPayloadForRouting | null | undefined): string | null {
  if (!notification) return null;

  const entityIds = notification.metadata?.entity_ids;

  // 1. entity_ids.dispute_id exists → /(app)/disputes/[id]
  if (entityIds?.dispute_id) {
    return `/(app)/disputes/${entityIds.dispute_id}`;
  }

  // 2. Otherwise, entity_ids.event_id exists → /(app)/events/[id]
  if (entityIds?.event_id) {
    return `/(app)/events/${entityIds.event_id}`;
  }

  // 3. Otherwise, notification type === 'ROLE_CHANGED' → /(app)/profile
  if (notification.type === 'ROLE_CHANGED') {
    return '/(app)/profile';
  }

  // 4. Otherwise → do not navigate
  return null;
}
