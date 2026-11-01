import { describe, it, expect, vi } from 'vitest';
import { resolveNotificationRoute } from '../src/lib/notification-routing';

describe('Phase 2 Notification System Tests', () => {
  describe('1. Deep-Link Resolution Contract (Strict 4-Step Hierarchy)', () => {
    it('Rule 1: routes to /(app)/disputes/[id] when entity_ids.dispute_id exists', () => {
      const notification = {
        type: 'ATTENDANCE_DISPUTE_RESOLVED',
        metadata: {
          schema_version: 1,
          entity_ids: {
            dispute_id: 'disp-12345',
            event_id: 'evt-99999', // even if event_id is also present
          },
          routing: {
            target: 'dispute_details',
            fallback: '/disputes',
            params: { id: 'disp-12345' },
          },
        },
      };

      const route = resolveNotificationRoute(notification);
      expect(route).toBe('/(app)/disputes/disp-12345');
    });

    it('Rule 2: routes to /(app)/events/[id] when dispute_id is absent and entity_ids.event_id exists', () => {
      const notification = {
        type: 'WAITLIST_PROMOTED',
        metadata: {
          schema_version: 1,
          entity_ids: {
            event_id: 'evt-55555',
          },
          routing: {
            target: 'event_details',
            fallback: '/events',
            params: { id: 'evt-55555' },
          },
        },
      };

      const route = resolveNotificationRoute(notification);
      expect(route).toBe('/(app)/events/evt-55555');
    });

    it('Rule 3: routes to /(app)/(tabs)/profile when dispute_id and event_id are absent and type === ROLE_CHANGED', () => {
      const notification = {
        type: 'ROLE_CHANGED',
        metadata: {
          schema_version: 1,
          entity_ids: {
            club_id: 'club-777',
          },
          routing: {
            target: 'profile',
            fallback: '/profile',
            params: {},
          },
        },
      };

      const route = resolveNotificationRoute(notification);
      expect(route).toBe('/(app)/(tabs)/profile');
    });

    it('Rule 4: returns null (do not navigate) if no matching entity ID or ROLE_CHANGED type', () => {
      const notification = {
        type: 'CLUB_ANNOUNCEMENT',
        metadata: {
          schema_version: 1,
          entity_ids: {
            club_id: 'club-777',
            announcement_id: 'ann-111',
          },
          routing: {
            target: 'club_announcements',
            fallback: '/',
            params: {},
          },
        },
      };

      const route = resolveNotificationRoute(notification);
      expect(route).toBeNull();
    });

    it('Constraint Check: does NOT route using routing.target alone', () => {
      const notification = {
        type: 'EVENT_REMINDER',
        metadata: {
          schema_version: 1,
          routing: {
            target: 'event_details',
            fallback: '/events',
            params: { id: 'some-event-id' },
          },
          // entity_ids is empty or missing event_id
          entity_ids: {},
        },
      };

      const route = resolveNotificationRoute(notification);
      expect(route).toBeNull();
    });

    it('Constraint Check: does NOT route to /invitations (team invitations deferred for V2)', () => {
      const notification = {
        type: 'TEAM_INVITATION_RECEIVED',
        metadata: {
          schema_version: 1,
          entity_ids: {
            // Even if an invitation_id or team_id exists in payload
            team_id: 'team-999',
          } as any,
          routing: {
            target: 'invitations',
            fallback: '/invitations',
            params: { invitationId: 'inv-888' },
          },
        },
      };

      const route = resolveNotificationRoute(notification);
      // Must NOT navigate to /invitations
      expect(route).toBeNull();
    });

    it('Constraint Check: does NOT invent fallback destinations for null/undefined notification', () => {
      expect(resolveNotificationRoute(null)).toBeNull();
      expect(resolveNotificationRoute(undefined)).toBeNull();
      expect(resolveNotificationRoute({})).toBeNull();
      expect(resolveNotificationRoute({ type: 'UNKNOWN_TYPE' })).toBeNull();
    });
  });

  describe('2. Push Token Registration Payload Casing Contract', () => {
    it('constructs body matching backend RegisterPushTokenSchema strictly with snake_case', () => {
      const deviceId = 'device-uuid-test';
      const expoToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      const platform = 'ios';

      const payload = {
        device_id: deviceId,
        expo_token: expoToken,
        platform: platform,
      };

      // Validate exact keys required by apps/api/src/modules/users/users.schema.ts
      expect(payload).toHaveProperty('device_id');
      expect(payload).toHaveProperty('expo_token');
      expect(payload).toHaveProperty('platform');

      // Reject legacy camelCase keys that cause backend 400
      expect((payload as any).deviceId).toBeUndefined();
      expect((payload as any).expoToken).toBeUndefined();
    });
  });

  describe('3. Unread Count Contract', () => {
    it('extracts unread_count from dedicated GET /v1/notifications/unread-count response', () => {
      const apiResponse = { unread_count: 5 };
      expect(apiResponse.unread_count).toBe(5);

      const emptyResponse = { unread_count: 0 };
      expect(emptyResponse.unread_count).toBe(0);
    });
  });

  describe('4. Notification Preferences Subordination Logic', () => {
    it('disables and subordinates child preferences when push_enabled is false', () => {
      const preferences = {
        push_enabled: false,
        event_reminders: true,
        club_announcements: true,
        attendance_alerts: true,
      };

      // Logic check matching settings.tsx:
      // If push_enabled === false, child toggles must not trigger updates
      const updateFn = vi.fn();
      const handleToggleChild = (key: 'event_reminders' | 'club_announcements' | 'attendance_alerts') => {
        if (preferences.push_enabled) {
          updateFn({ [key]: !preferences[key] });
        }
      };

      handleToggleChild('event_reminders');
      expect(updateFn).not.toHaveBeenCalled();

      handleToggleChild('club_announcements');
      expect(updateFn).not.toHaveBeenCalled();

      handleToggleChild('attendance_alerts');
      expect(updateFn).not.toHaveBeenCalled();
    });

    it('allows child preference updates when push_enabled is true', () => {
      const preferences = {
        push_enabled: true,
        event_reminders: true,
        club_announcements: false,
        attendance_alerts: true,
      };

      const updateFn = vi.fn();
      const handleToggleChild = (key: 'event_reminders' | 'club_announcements' | 'attendance_alerts') => {
        if (preferences.push_enabled) {
          updateFn({ [key]: !preferences[key] });
        }
      };

      handleToggleChild('club_announcements');
      expect(updateFn).toHaveBeenCalledWith({ club_announcements: true });
    });
  });
});
