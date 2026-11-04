import { requireOptionalNativeModule } from 'expo';

export interface NativeInstallReferrerDetails {
  installReferrer: string | null;
  referrerClickTimestampSeconds: number;
  installBeginTimestampSeconds: number;
  googlePlayInstant: boolean;
}

export interface NativeInstallReferrerModuleInterface {
  getInstallReferrer(): Promise<NativeInstallReferrerDetails | null>;
}

export const InstallReferrerModule =
  requireOptionalNativeModule<NativeInstallReferrerModuleInterface>('InstallReferrerModule');

export default InstallReferrerModule;
