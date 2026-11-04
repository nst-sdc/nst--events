import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import {
  checkForPlayUpdate,
  startFlexiblePlayUpdate,
  startImmediatePlayUpdate,
  completePlayUpdate,
  addUpdateDownloadedListener,
  PlayUpdateInfo,
} from 'play-in-app-updates';

export interface PlayInAppUpdatesState {
  updateInfo: PlayUpdateInfo | null;
  isDownloading: boolean;
  isDownloaded: boolean;
  startFlexibleUpdate: () => Promise<boolean>;
  startImmediateUpdate: () => Promise<boolean>;
  completeUpdate: () => Promise<boolean>;
  dismiss: () => void;
  canShowFlexiblePrompt: boolean;
}

export function usePlayInAppUpdates(): PlayInAppUpdatesState {
  const [updateInfo, setUpdateInfo] = useState<PlayUpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkedOnceRef = useRef(false);
  const pathname = usePathname();

  const isCriticalScreen =
    Boolean(pathname?.includes('/scan')) ||
    Boolean(pathname?.includes('auth')) ||
    pathname === '/login';

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    if (!checkedOnceRef.current) {
      checkedOnceRef.current = true;

      // Stagger check to avoid competing with startup network calls
      const timer = setTimeout(async () => {
        try {
          const info = await checkForPlayUpdate();
          setUpdateInfo(info);

          // If flexible update is allowed and update is available, prompt or start flexible flow
          if (info.updateAvailable && info.flexibleAllowed && !info.updateInProgress) {
            // Flexible update is ready to be initiated
          }
        } catch (err) {
          if (__DEV__) {
            console.log('[PlayInAppUpdates] Check skipped/failed:', err);
          }
        }
      }, 3500);

      // Listen for background download completion
      const subscription = addUpdateDownloadedListener(() => {
        setIsDownloading(false);
        setIsDownloaded(true);
      });

      return () => {
        clearTimeout(timer);
        subscription?.remove();
      };
    }
  }, []);

  const startFlexibleUpdate = useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    try {
      setIsDownloading(true);
      const started = await startFlexiblePlayUpdate();
      if (!started) {
        setIsDownloading(false);
      }
      return started;
    } catch {
      setIsDownloading(false);
      return false;
    }
  }, []);

  const startImmediateUpdate = useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    try {
      return await startImmediatePlayUpdate();
    } catch {
      return false;
    }
  }, []);

  const completeUpdate = useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    return await completePlayUpdate();
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const canShowFlexiblePrompt =
    !dismissed &&
    !isCriticalScreen &&
    Boolean(isDownloaded || (updateInfo?.updateAvailable && updateInfo?.flexibleAllowed));

  return {
    updateInfo,
    isDownloading,
    isDownloaded,
    startFlexibleUpdate,
    startImmediateUpdate,
    completeUpdate,
    dismiss,
    canShowFlexiblePrompt,
  };
}

