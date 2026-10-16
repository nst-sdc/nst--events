import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { ActivityIndicator } from '../../src/ui/core/ActivityIndicator';
import { useAppTheme } from '../../src/store/theme-store';
import { apiClient } from '../../src/infrastructure/api';

export default function DeepLinkEventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const setPendingDeepLink = useAuthStore((state) => state.setPendingDeepLink);

  useEffect(() => {
    if (!isInitialized) return;

    const resolveAndNavigate = async () => {
      let resolvedId: string | null = null;

      if (slug) {
        try {
          const res: any = await apiClient(`/v1/events/public/${encodeURIComponent(slug)}`);
          if (res?.redirect && res.canonical_slug) {
            const redirectedRes: any = await apiClient(`/v1/events/public/${encodeURIComponent(res.canonical_slug)}`);
            resolvedId = redirectedRes?.id;
          } else if (res?.id) {
            resolvedId = res.id;
          }
        } catch (err) {
          console.error('Failed to resolve slug for event:', err);
        }
      }

      if (!resolvedId) {
        router.replace('/(app)');
        return;
      }

      const targetPath = `/(app)/events/${resolvedId}`;

      if (!isLoggedIn) {
        setPendingDeepLink(targetPath);
        router.replace('/(auth)');
      } else {
        router.replace(targetPath as any);
      }
    };

    resolveAndNavigate();
  }, [isInitialized, isLoggedIn, slug]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </SafeAreaView>
  );
}
