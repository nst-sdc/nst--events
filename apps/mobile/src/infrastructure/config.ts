import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return process.env.EXPO_PUBLIC_PROD_API_URL || 'https://events.nstsdc.org';
  }

  // If running in development on a physical device, dynamically infer host from Metro bundler IP
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:3001`;
    }
  }

  if (Platform.OS === 'android') {
    // Android emulator communicates via adb reverse tunnel on localhost:3001
    return 'http://localhost:3001';
  }
  return 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';

export const SUPPORT_EMAIL =
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'events-support@adypu.edu.in';

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || 'https://events.nstsdc.org/privacy-policy';
