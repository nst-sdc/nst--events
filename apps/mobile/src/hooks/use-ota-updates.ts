import { useState, useEffect, useCallback, useRef } from 'react';
import * as Updates from 'expo-updates';
import { usePathname } from 'expo-router';

export interface OtaUpdateState {
  isChecking: boolean;
  isAvailable: boolean;
  isDownloading: boolean;
  isDownloaded: boolean;
  error: string | null;
  downloadUpdate: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  dismiss: () => void;
  canShowNotification: boolean;
}

export function useOtaUpdates(): OtaUpdateState {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkedOnceRef = useRef(false);
  const pathname = usePathname();

  // Critical operations where update prompts must not interrupt the user:
  // - Active QR code attendance scanner (/events/.../scan)
  // - Login authentication gateway
  const isCriticalScreen =
    Boolean(pathname?.includes('/scan')) ||
    Boolean(pathname?.includes('auth')) ||
    pathname === '/login';

  const checkForUpdate = useCallback(async () => {
    // Updates API is only active in standalone/production runtime builds
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    try {
      setIsChecking(true);
      setError(null);
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setIsAvailable(true);
      }
    } catch (err: any) {
      // Offline, network timeout, or cache lookup failure — fail silently
      setError(err?.message || 'Check failed');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!checkedOnceRef.current) {
      checkedOnceRef.current = true;
      // Stagger check slightly after initial app mount
      const timer = setTimeout(() => {
        checkForUpdate();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [checkForUpdate]);

  const downloadUpdate = useCallback(async () => {
    if (isDownloading || isDownloaded) return;

    try {
      setIsDownloading(true);
      setError(null);
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        setIsDownloaded(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, isDownloaded]);

  const applyUpdate = useCallback(async () => {
    if (!isDownloaded) return;
    try {
      await Updates.reloadAsync();
    } catch (err: any) {
      setError(err?.message || 'Reload failed');
    }
  }, [isDownloaded]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const canShowNotification =
    !dismissed &&
    !isCriticalScreen &&
    (isAvailable || isDownloaded);

  return {
    isChecking,
    isAvailable,
    isDownloading,
    isDownloaded,
    error,
    downloadUpdate,
    applyUpdate,
    dismiss,
    canShowNotification,
  };
}

