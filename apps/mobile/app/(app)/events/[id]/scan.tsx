import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { apiClient } from '../../../../src/infrastructure/api';
import { useToast } from '../../../../src/hooks/use-toast';
import { queryClient } from '../../../../src/providers/QueryProvider';
import { getPersistentDeviceId } from '../../../../src/lib/device-id';
import { useAppTheme } from '../../../../src/store/theme-store';
import { CameraPermissionView } from '../../../../src/ui/CameraPermissionView';
import { LocationPermissionView } from '../../../../src/ui/LocationPermissionView';
import { AttendancePermissionsView } from '../../../../src/ui/AttendancePermissionsView';
import { ScannerOverlay } from '../../../../src/ui/ScannerOverlay';
import { AttendanceVerificationView } from '../../../../src/ui/AttendanceVerificationView';
import { AttendanceSuccessView } from '../../../../src/ui/AttendanceSuccessView';
import { AttendanceFailureView } from '../../../../src/ui/AttendanceFailureView';
import { logger } from '../../../../src/lib/logger';

type ScanFlowState =
  | 'CHECKING'
  | 'PERMISSIONS'
  | 'CAMERA_PERMISSION'
  | 'LOCATION_PERMISSION'
  | 'SCANNING'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'FAILURE';

export default function ScanAttendanceScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const toast = useToast();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [flowState, setFlowState] = useState<ScanFlowState>('CHECKING');
  const [torchActive, setTorchActive] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('ACQUIRING LOCATION...');

  const [errorCode, setErrorCode] = useState<string>('ATTENDANCE_FAILED');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [scannedSessionId, setScannedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<{
    locationName?: string;
    timeLogged?: string;
  }>({});

  const cachedEvent = queryClient.getQueryData<any>(['events', eventId]);
  const [eventTitle, setEventTitle] = useState<string>(cachedEvent?.title || '');
  const [gpsState, setGpsState] = useState<'ACQUIRING' | 'READY' | 'WEAK' | 'ERROR'>('ACQUIRING');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  useEffect(() => {
    if (!eventTitle && eventId) {
      apiClient(`/v1/events/${eventId}`)
        .then((res: any) => {
          if (res?.title) setEventTitle(res.title);
        })
        .catch(() => {});
    }
  }, [eventId, eventTitle]);

  const isProcessingRef = useRef(false);
  const pendingQrDataRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const locationCacheRef = useRef<Location.LocationObject | null>(null);
  const locationPromiseRef = useRef<Promise<Location.LocationObject> | null>(null);

  const prefetchLocation = async () => {
    if (locationPromiseRef.current) return locationPromiseRef.current;
    setGpsState('ACQUIRING');
    const promise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    locationPromiseRef.current = promise;
    promise.then(loc => {
      locationCacheRef.current = loc;
      const acc = loc.coords.accuracy ?? 9999;
      setGpsAccuracy(Math.round(acc));
      setGpsState(acc <= 100 ? 'READY' : 'WEAK');
    }).catch(() => {
      locationPromiseRef.current = null;
      setGpsState('ERROR');
    });
    return promise;
  };

  useEffect(() => {
    (async () => {
      if (!cameraPermission) return;
      const locPerm = await Location.getForegroundPermissionsAsync();
      setLocationPermissionGranted(locPerm.granted);
      if (!cameraPermission.granted || !locPerm.granted) {
        setFlowState('PERMISSIONS');
        return;
      }
      
      setFlowState('SCANNING');
      logger.info('Scanner opened', { timestamp: Date.now() });
      prefetchLocation();
    })();
  }, [cameraPermission]);

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 2500) return;
    if (isProcessingRef.current) return;
    
    lastScanTimeRef.current = now;
    isProcessingRef.current = true;
    pendingQrDataRef.current = data;

    logger.info('QR barcode scanned');

    processAttendanceSubmission(data);
  };

  const processAttendanceSubmission = async (qrData: string) => {
    setFlowState('VERIFYING');

    try {
      // 1. Verify QR Format
      const trimmedQrData = qrData.trim();
      if (!trimmedQrData.startsWith('v1:')) {
        logger.warn('Invalid QR format: missing v1 prefix');
        throw new Error('INVALID_QR_FORMAT');
      }
      const parts = trimmedQrData.split(':');
      if (parts.length !== 3) {
        logger.warn('Malformed QR: expected 3 parts', { partCount: parts.length });
        throw new Error('MALFORMED_QR');
      }
      const sessionId = parts[1];
      setScannedSessionId(sessionId);
      logger.info('Parsed session ID from QR', { sessionId });

      // 2. Request Location Permission & High-Accuracy Position
      setVerificationStatus('ACQUIRING LOCATION...');
      const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
      logger.info('Location permission status', { status: locationStatus });
      if (locationStatus !== 'granted') {
        logger.warn('Location permission denied, redirecting to permission screen');
        setFlowState('LOCATION_PERMISSION');
        isProcessingRef.current = false;
        return;
      }

      const locationReqStart = Date.now();
      logger.debug('Location request started', { startTimestamp: locationReqStart });

      let location: Location.LocationObject | null = null;

      // 1. Try Cache First
      if (locationCacheRef.current) {
        const cached = locationCacheRef.current;
        const accuracy = cached.coords.accuracy ?? 9999;
        const age = Date.now() - cached.timestamp;
        
        // Only use cache if it's less than 100m accuracy and relatively fresh (e.g., < 60s)
        if (accuracy <= 100 && age < 60000) {
          logger.debug('Using acceptable pre-fetched location', { accuracy, age });
          location = cached;
        } else {
          logger.debug('Discarding pre-fetched location', { accuracy, age });
          locationCacheRef.current = null;
        }
      }

      // 2. Fetch Fresh if Cache was missing or discarded
      if (!location) {
        logger.info('Fetching fresh high-accuracy location with 8s timeout');
        const locPromise = locationPromiseRef.current || Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), 8000)
        );
        location = await Promise.race([locPromise, timeoutPromise]);
      }

      logger.info(`Coordinates captured. gps_accuracy=${location.coords.accuracy}m, mock_location_detected=[REDACTED]`);

      // 3. Client-side accuracy enforcement (must be <= 100m)
      const finalAccuracy = location.coords.accuracy ?? 9999;
      setGpsAccuracy(Math.round(finalAccuracy));
      setGpsState(finalAccuracy <= 100 ? 'READY' : 'WEAK');
      if (finalAccuracy > 100) {
        logger.warn('Client-side rejection: Accuracy is worse than 100m threshold', { finalAccuracy });
        throw new Error('LOCATION_UNRELIABLE');
      }
      
      logger.info('Client-side assessment: Location accepted');

      // 3. Fetch Persistent Device ID
      setVerificationStatus('VERIFYING WITH SERVER...');
      const deviceId = await getPersistentDeviceId();
      logger.debug('Device ID acquired');

      // 4. Submit payload to backend (POST /v1/attendance/mark)
      const payload = {
        session_id: sessionId,
        totp_token: trimmedQrData,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        device_id: deviceId,
        device_os: Platform.OS,
        gps_accuracy: location.coords.accuracy || 0,
        mock_location_detected: location.mocked || false,
        app_version: '1.0.0',
      };

      logger.info('Submitting attendance marking request: POST /v1/attendance/mark');

      const response: any = await apiClient('/v1/attendance/mark', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      logger.info('Attendance marked successfully');

      // Resolve venue name from existing React Query event data as primary source
      const cachedEvent = queryClient.getQueryData<any>(['events', eventId]);
      let locationName = cachedEvent?.locationName || cachedEvent?.location_name;

      // Fallback: If not in cache, fetch event details directly
      if (!locationName) {
        try {
          logger.debug('Cached event unavailable, fetching event details', { eventId });
          const eventResponse: any = await apiClient(`/v1/events/${eventId}`);
          locationName = eventResponse?.locationName || eventResponse?.location_name;
        } catch (fetchErr) {
          logger.warn('Failed to fetch fallback event details');
        }
      }

      // Invalidate queries after confirmed attendance success
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-attendance'] }),
        queryClient.invalidateQueries({ queryKey: ['events', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
      ]);

      setSessionDetails({
        locationName: locationName || 'Unknown Location',
        timeLogged: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });

      logger.info('Mark attendance completed successfully: SUCCESS');
      setFlowState('SUCCESS');
    } catch (err: any) {
      let rawMsg = err.message || 'ATTENDANCE_FAILED';
      let parsedCode = 'ATTENDANCE_FAILED';

      if (err.body && err.body.code) {
        parsedCode = err.body.code;
      } else if (err.body && err.body.error) {
        parsedCode = err.body.error;
      }

      logger.error('Attendance marking failed', err, {
        status: err.status || 'unknown',
        code: parsedCode,
      });

      if (
        rawMsg.toLowerCase().includes('network') ||
        rawMsg.toLowerCase().includes('offline') ||
        parsedCode === 'NETWORK_OFFLINE'
      ) {
        parsedCode = 'NETWORK_OFFLINE';
        rawMsg = 'An active network connection is required to verify attendance.';
      } else if (rawMsg.includes('LOCATION_TIMEOUT') || parsedCode === 'LOCATION_TIMEOUT') {
        parsedCode = 'LOCATION_TIMEOUT';
        rawMsg = 'Unable to acquire a GPS fix within 8 seconds.';
      } else if (rawMsg.includes('LOCATION_UNRELIABLE') || parsedCode === 'LOCATION_UNRELIABLE') {
        parsedCode = 'LOCATION_UNRELIABLE';
        rawMsg = 'Location accuracy is insufficient. Please move to an area with clear skies.';
      } else if (
        rawMsg.includes('INVALID_QR_FORMAT') ||
        rawMsg.includes('MALFORMED_QR') ||
        parsedCode === 'INVALID_QR_FORMAT' ||
        parsedCode === 'MALFORMED_QR'
      ) {
        parsedCode = 'INVALID_QR_FORMAT';
        rawMsg = 'Unrecognized QR code format. Please scan the official NST-Events session QR code.';
        toast.show(rawMsg, 'error', 'Invalid QR');
      } else if (rawMsg.includes('QR_EXPIRED') || parsedCode === 'QR_EXPIRED') {
        parsedCode = 'QR_EXPIRED';
      } else if (parsedCode === 'LOCATION_VERIFICATION_FAILED') {
        parsedCode = 'LOCATION_VERIFICATION_FAILED';
      } else if (rawMsg.includes('SESSION_CLOSED') || parsedCode === 'SESSION_CLOSED') {
        parsedCode = 'SESSION_CLOSED';
      } else if (rawMsg.includes('EVENT_LOCKED') || parsedCode === 'EVENT_LOCKED') {
        parsedCode = 'EVENT_LOCKED';
      } else if (rawMsg.includes('ALREADY_RECORDED') || parsedCode === 'ALREADY_RECORDED') {
        logger.info('Handling ALREADY_RECORDED special case');
        parsedCode = 'ALREADY_RECORDED';
      } else if (rawMsg.includes('NOT_REGISTERED') || parsedCode === 'NOT_REGISTERED') {
        parsedCode = 'NOT_REGISTERED';
      } else if (rawMsg.includes('WAITLISTED') || parsedCode === 'WAITLISTED') {
        parsedCode = 'WAITLISTED';
      } else if (rawMsg.includes('REGISTRATION_NOT_ELIGIBLE') || parsedCode === 'REGISTRATION_NOT_ELIGIBLE') {
        parsedCode = 'REGISTRATION_NOT_ELIGIBLE';
      } else if (rawMsg.includes('ACADEMICALLY_INELIGIBLE') || parsedCode === 'ACADEMICALLY_INELIGIBLE') {
        parsedCode = 'ACADEMICALLY_INELIGIBLE';
      } else if (rawMsg.includes('ACADEMIC_PROFILE_MISSING') || parsedCode === 'ACADEMIC_PROFILE_MISSING') {
        parsedCode = 'ACADEMIC_PROFILE_MISSING';
      }

      logger.info('Parsed error details', { code: parsedCode, message: rawMsg });
      
      setErrorCode(parsedCode);
      setErrorMessage(rawMsg);
      logger.info('Attendance final UI state: FAILURE');
      setFlowState('FAILURE');
    } finally {
      isProcessingRef.current = false;
      locationCacheRef.current = null;
      locationPromiseRef.current = null;
    }
  };

  const handleResetScan = () => {
    isProcessingRef.current = false;
    pendingQrDataRef.current = null;
    setFlowState('SCANNING');
    prefetchLocation();
  };

  const handleRequestAllPermissions = async () => {
    let camGranted = cameraPermission?.granted;
    if (!camGranted) {
      const res = await requestCameraPermission();
      camGranted = res.granted;
    }

    const locPerm = await Location.getForegroundPermissionsAsync();
    let locGranted = locPerm.granted;
    if (!locGranted) {
      const locRes = await Location.requestForegroundPermissionsAsync();
      locGranted = locRes.granted;
    }
    setLocationPermissionGranted(locGranted);

    if (camGranted && locGranted) {
      if (pendingQrDataRef.current) {
        processAttendanceSubmission(pendingQrDataRef.current);
      } else {
        setFlowState('SCANNING');
        prefetchLocation();
      }
    }
  };

  // Render Permission Branches & Flow States
  if (flowState === 'PERMISSIONS' || flowState === 'CAMERA_PERMISSION' || flowState === 'LOCATION_PERMISSION') {
    return (
      <AttendancePermissionsView
        onRequestPermissions={handleRequestAllPermissions}
        onCancel={() => router.back()}
        cameraGranted={cameraPermission?.granted}
        locationGranted={locationPermissionGranted}
      />
    );
  }

  if (flowState === 'VERIFYING') {
    return <AttendanceVerificationView statusText={verificationStatus} />;
  }

  const handleReturnHome = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/(app)');
    }
  };

  if (flowState === 'SUCCESS') {
    return (
      <AttendanceSuccessView
        locationName={sessionDetails.locationName || ''}
        timeLogged={sessionDetails.timeLogged || ''}
        onReturnHome={handleReturnHome}
      />
    );
  }

  if (flowState === 'FAILURE') {
    return (
      <AttendanceFailureView
        errorCode={errorCode}
        errorMessage={errorMessage}
        sessionId={scannedSessionId || undefined}
        eventTitle={eventTitle || undefined}
        onRetryScan={handleResetScan}
        onReturnHome={handleReturnHome}
        onFileDispute={scannedSessionId ? () => {
          router.push({
            pathname: '/(app)/disputes/new',
            params: {
              sessionId: scannedSessionId,
              eventId,
              title: eventTitle,
            },
          });
        } : undefined}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <StatusBar 
        barStyle={theme.mode === 'light' ? 'dark-content' : 'light-content'} 
        backgroundColor="transparent" 
        translucent 
      />
      <CameraView
        style={[styles.cameraView, StyleSheet.absoluteFill]}
        facing="back"
        enableTorch={torchActive}
        onBarcodeScanned={isProcessingRef.current ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />
      <ScannerOverlay
        onClose={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)');
          }
        }}
        onToggleTorch={() => setTorchActive((prev) => !prev)}
        torchActive={torchActive}
        eventTitle={eventTitle}
        gpsState={gpsState}
        gpsAccuracy={gpsAccuracy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
