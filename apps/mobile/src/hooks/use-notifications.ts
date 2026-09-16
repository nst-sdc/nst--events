import { useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../infrastructure/api';
import { useAuthStore } from '../store/auth';
import { useRouter, usePathname } from 'expo-router';
import { getPersistentDeviceId } from '../lib/device-id';
import { resolveNotificationRoute } from '../lib/notification-routing';

const TOKEN_CACHE_KEY = 'last_synced_push_token';
const USER_CACHE_KEY = 'last_synced_push_user_id';

const normalizeRoute = (path?: string | null) => (path || '').replace(/^\/(\(app\)\/)?/, '').replace(/\/$/, '');

export function useNotifications() {
  if (Platform.OS === 'web') {
    return;
  }

  const userId = useAuthStore((state) => state.userId);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const router = useRouter();
  const pathname = usePathname();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const coldStartHandledRef = useRef<string | null>(null);

  const { mutate: syncToken } = useMutation({
    mutationFn: async (expoToken: string) => {
      if (!userId) return;
      const deviceId = await getPersistentDeviceId();
      return apiClient('/users/me/push-token', {
        method: 'POST',
        body: JSON.stringify({
          device_id: deviceId,
          expo_token: expoToken,
          platform: Platform.OS.toLowerCase(),
        }),
      });
    },
    onSuccess: async (_, expoToken) => {
      // Persist the last synchronized token and user ID exactly as documented
      if (userId) {
        await SecureStore.setItemAsync(TOKEN_CACHE_KEY, expoToken);
        await SecureStore.setItemAsync(USER_CACHE_KEY, userId);
      }
    },
    retry: 3, // Safe React Query exponential backoff
  });

  // Handle cold-start notification tap interaction
  useEffect(() => {
    if (lastNotificationResponse && isLoggedIn) {
      const responseId = lastNotificationResponse.notification.request.identifier;
      if (coldStartHandledRef.current === responseId) return;

      const data = lastNotificationResponse.notification.request.content.data as any;
      const route = resolveNotificationRoute({
        type: data?.notification_type || data?.type,
        metadata: data?.metadata,
      });
      if (route) {
        coldStartHandledRef.current = responseId;
        if (normalizeRoute(pathname) !== normalizeRoute(route)) {
          router.push(route as any);
        }
      }
    }
  }, [lastNotificationResponse, isLoggedIn, router, pathname]);

  // Handle runtime notification tap interaction (app in foreground or background)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!isLoggedIn) return;
      const data = response.notification.request.content.data as any;
      const route = resolveNotificationRoute({
        type: data?.notification_type || data?.type,
        metadata: data?.metadata,
      });
      if (route) {
        if (normalizeRoute(pathname) !== normalizeRoute(route)) {
          router.push(route as any);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isLoggedIn, router, pathname]);

  useEffect(() => {
    let isMounted = true;

    async function registerForPushNotificationsAsync() {
      // 1. Cleanup lifecycle (logout or account switch)
      if (!isLoggedIn || !userId) {
        await SecureStore.deleteItemAsync(TOKEN_CACHE_KEY);
        await SecureStore.deleteItemAsync(USER_CACHE_KEY);
        return;
      }

      // 2. Simulator bypass (prevent crash)
      if (!Device.isDevice) {
        return;
      }

      // 3. Strict Permission rules
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // If denied: do not retry repeatedly, do not spam, exit gracefully
      if (finalStatus !== 'granted') {
        return;
      }

      // Android 8.0+ channel requirement
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn('EAS projectId not configured — push token registration skipped');
          }
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        const token = tokenResponse.data;

        if (!isMounted) return;

        // 4. Token Synchronization Rules
        const lastToken = await SecureStore.getItemAsync(TOKEN_CACHE_KEY);
        const lastUserId = await SecureStore.getItemAsync(USER_CACHE_KEY);

        // Never POST the same token repeatedly. Only call if diff exists.
        if (lastToken !== token || lastUserId !== userId) {
          syncToken(token);
        }
      } catch (e) {
        // If offline or Expo API is unavailable, silently wait until next mount. Never block app startup.
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('Silent fail: Unable to get Expo Push Token');
        }
      }
    }

    registerForPushNotificationsAsync();

    // Token refresh lifecycle listener
    const subscription = Notifications.addPushTokenListener((newToken) => {
      if (isLoggedIn && userId) {
        syncToken(newToken.data);
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [userId, isLoggedIn, syncToken]);
}
