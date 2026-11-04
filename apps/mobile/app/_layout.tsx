import React, { useEffect } from 'react';
import { Modal, Platform } from 'react-native';
import { Stack, SplashScreen } from 'expo-router';
import { AppQueryProvider } from '../src/providers/QueryProvider';
import { useNotifications } from '../src/hooks/use-notifications';
import { useThemeStore } from '../src/store/theme-store';
import { useAppVersionStore } from '../src/store/app-version-store';
import { useAuthStore } from '../src/store/auth';
import { UpdateRequiredPrompt } from '../src/ui/UpdateRequiredPrompt';
import { GlobalToastModal } from '../src/ui/GlobalToastModal';
import { AppUpdateNotifier } from '../src/ui/AppUpdateNotifier';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import {
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('[APP BOOT] Literal EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function NotificationLifecycle() {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return null;
  return <NativeNotificationLifecycle />;
}

function NativeNotificationLifecycle() {
  useNotifications();
  return null;
}

// Inner layout safely wrapped in React Query context
function RootLayoutInner() {
  const [fontsLoaded, fontError] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const initTheme = useThemeStore((state) => state.initTheme);
  const initSession = useAuthStore((state) => state.initSession);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[APP BOOT MOUNT] Literal EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
    }
    initTheme();
    if (!isInitialized) {
      initSession();
    }
  }, [initTheme, initSession, isInitialized]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the splash screen after the fonts have loaded (or an error was returned)
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <NotificationLifecycle />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

function GlobalUpdateRequiredModal() {
  const isUpdateRequired = useAppVersionStore((state) => state.isUpdateRequired);
  const minVersion = useAppVersionStore((state) => state.minVersion);

  if (!isUpdateRequired) return null;

  return (
    <Modal visible={isUpdateRequired} animationType="slide" transparent={false}>
      <UpdateRequiredPrompt minVersion={minVersion} />
    </Modal>
  );
}

export default function RootLayout() {
  return (
    <AppQueryProvider>
      <RootLayoutInner />
      <GlobalUpdateRequiredModal />
      <GlobalToastModal />
      <AppUpdateNotifier />
    </AppQueryProvider>
  );
}

