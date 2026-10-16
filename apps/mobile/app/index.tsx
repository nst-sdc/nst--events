import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth';
import { useAppTheme } from '../src/store/theme-store';
import { ActivityIndicator } from '../src/ui/core/ActivityIndicator';

import { resolvePostInstallTarget } from '../src/infrastructure/post-install-continuation';

export default function RootIndexScreen() {
  const theme = useAppTheme();
  
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const initSession = useAuthStore((state) => state.initSession);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    if (!isInitialized) return;

    let isMounted = true;

    const handleInitialNavigation = async () => {
      // Yield a tick to ensure the root Stack navigator has mounted into the tree
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (!isMounted) return;

      try {
        const continuation = await resolvePostInstallTarget();
        if (!isMounted) return;

        if (continuation.handled && continuation.targetPath) {
          if (isLoggedIn) {
            setTargetRoute(continuation.targetPath);
          } else {
            useAuthStore.getState().setPendingDeepLink(continuation.targetPath);
            setTargetRoute('/(auth)');
          }
          return;
        }
      } catch (err) {
        console.warn('[RootIndex] Post-install continuation check failed:', err);
      }

      if (!isMounted) return;

      if (isLoggedIn) {
        setTargetRoute('/(app)');
      } else {
        setTargetRoute('/(auth)');
      }
    };

    handleInitialNavigation();

    return () => {
      isMounted = false;
    };
  }, [isInitialized, isLoggedIn]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    centerBox: {
      alignItems: 'center',
      gap: 12,
    },
  }), [theme]);

  if (targetRoute) {
    return <Redirect href={targetRoute as any} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    </SafeAreaView>
  );
}
