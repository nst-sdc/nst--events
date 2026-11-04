import { requireOptionalNativeModule, EventEmitter } from 'expo';
import { Platform, type EventSubscription } from 'react-native';

export interface PlayUpdateInfo {
  updateAvailable: boolean;
  updateInProgress?: boolean;
  versionCode?: number;
  flexibleAllowed?: boolean;
  immediateAllowed?: boolean;
  clientVersionStalenessDays?: number | null;
  updatePriority?: number;
  installStatus?: number;
  isPlayStoreInstall?: boolean;
  reason?: string;
  error?: string;
}

export interface PlayUpdateProgressEvent {
  bytesDownloaded: number;
  totalBytesToDownload: number;
}

export interface PlayUpdateDownloadedEvent {
  readyToInstall: boolean;
}

export interface PlayUpdateCancelledEvent {
  reason: string;
}

export interface PlayUpdateFailedEvent {
  resultCode?: number;
  errorCode?: number;
}

interface NativePlayInAppUpdatesModuleInterface {
  checkForUpdate(): Promise<PlayUpdateInfo>;
  startFlexibleUpdate(): Promise<boolean>;
  startImmediateUpdate(): Promise<boolean>;
  completeUpdate(): Promise<boolean>;
}

export const PlayInAppUpdatesModule =
  requireOptionalNativeModule<NativePlayInAppUpdatesModuleInterface>('PlayInAppUpdatesModule');

const emitter: any = PlayInAppUpdatesModule
  ? new EventEmitter(PlayInAppUpdatesModule as any)
  : null;

export async function checkForPlayUpdate(): Promise<PlayUpdateInfo> {
  if (Platform.OS !== 'android' || !PlayInAppUpdatesModule) {
    return { updateAvailable: false, isPlayStoreInstall: false };
  }
  try {
    return await PlayInAppUpdatesModule.checkForUpdate();
  } catch (err: any) {
    return { updateAvailable: false, error: err?.message || 'Check failed' };
  }
}

export async function startFlexiblePlayUpdate(): Promise<boolean> {
  if (Platform.OS !== 'android' || !PlayInAppUpdatesModule) {
    return false;
  }
  return await PlayInAppUpdatesModule.startFlexibleUpdate();
}

export async function startImmediatePlayUpdate(): Promise<boolean> {
  if (Platform.OS !== 'android' || !PlayInAppUpdatesModule) {
    return false;
  }
  return await PlayInAppUpdatesModule.startImmediateUpdate();
}

export async function completePlayUpdate(): Promise<boolean> {
  if (Platform.OS !== 'android' || !PlayInAppUpdatesModule) {
    return false;
  }
  return await PlayInAppUpdatesModule.completeUpdate();
}

export function addUpdateDownloadedListener(listener: (event: PlayUpdateDownloadedEvent) => void): EventSubscription | null {
  return emitter ? emitter.addListener('onUpdateDownloaded', listener) : null;
}

export function addUpdateProgressListener(listener: (event: PlayUpdateProgressEvent) => void): EventSubscription | null {
  return emitter ? emitter.addListener('onUpdateProgress', listener) : null;
}

export function addUpdateCancelledListener(listener: (event: PlayUpdateCancelledEvent) => void): EventSubscription | null {
  return emitter ? emitter.addListener('onUpdateCancelled', listener) : null;
}

export function addUpdateFailedListener(listener: (event: PlayUpdateFailedEvent) => void): EventSubscription | null {
  return emitter ? emitter.addListener('onUpdateFailed', listener) : null;
}
