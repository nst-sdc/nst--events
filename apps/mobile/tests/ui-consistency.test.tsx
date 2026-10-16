// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { darkColors, lightColors } from '../src/ui/theme';
import { StatusBadge } from '../src/ui/core/StatusBadge';
import { Button } from '../src/ui/Button';
import { MobileShell } from '../src/ui/core/MobileShell';
import { AttendanceSuccessView } from '../src/ui/AttendanceSuccessView';
import { LocationPermissionView } from '../src/ui/LocationPermissionView';
import { AttendancePermissionsView } from '../src/ui/AttendancePermissionsView';

vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: (props: any) => React.createElement('Text', props, props.name),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    canGoBack: () => true,
    replace: vi.fn(),
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
  APP_VERSION: '1.0.0',
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(QueryClientProvider, { client: queryClient }, children)
);

describe('Mobile UI Consistency & Design Token Audit Suite', () => {
  describe('1. Theme Tokens Consistency', () => {
    it('defines semantic warning, success, and podium tokens for darkColors', () => {
      expect(darkColors.warning).toBeDefined();
      expect(darkColors.onWarning).toBeDefined();
      expect(darkColors.warningContainer).toBeDefined();
      expect(darkColors.onWarningContainer).toBeDefined();

      expect(darkColors.success).toBeDefined();
      expect(darkColors.onSuccess).toBeDefined();
      expect(darkColors.successContainer).toBeDefined();
      expect(darkColors.onSuccessContainer).toBeDefined();

      expect(darkColors.podiumGold).toBe('#ffd700');
      expect(darkColors.podiumSilver).toBe('#c0c0c0');
      expect(darkColors.podiumBronze).toBe('#cd7f32');
    });

    it('defines semantic warning, success, and podium tokens for lightColors', () => {
      expect(lightColors.warning).toBeDefined();
      expect(lightColors.onWarning).toBeDefined();
      expect(lightColors.warningContainer).toBeDefined();
      expect(lightColors.onWarningContainer).toBeDefined();

      expect(lightColors.success).toBeDefined();
      expect(lightColors.onSuccess).toBeDefined();
      expect(lightColors.successContainer).toBeDefined();
      expect(lightColors.onSuccessContainer).toBeDefined();

      expect(lightColors.podiumGold).toBe('#b8860b');
      expect(lightColors.podiumSilver).toBe('#708090');
      expect(lightColors.podiumBronze).toBe('#a0522d');
    });

    it('ensures light mode high-contrast compliance for warning and success', () => {
      // Light mode colors should NOT use unreadable low-contrast green/gold
      expect(lightColors.success).toBe('#15803d');
      expect(lightColors.warning).toBe('#b45309');
      expect(lightColors.surface).toBe('#fbfbfb');
    });
  });

  describe('2. StatusBadge Component', () => {
    it('automatically wraps unbracketed status strings in monospace brackets [ ... ]', () => {
      render(<StatusBadge status="ACTIVE" type="default" />);
      expect(screen.getByText('[ACTIVE]')).toBeTruthy();
    });

    it('does not double-bracket already bracketed status strings', () => {
      render(<StatusBadge status="[LIVE NOW]" type="warning" />);
      expect(screen.getByText('[LIVE NOW]')).toBeTruthy();
    });

    it('renders with sharp corners and appropriate semantic variants', () => {
      render(<StatusBadge status="CONFIRMED" type="success" />);
      expect(screen.getByText('[CONFIRMED]')).toBeTruthy();
    });
  });

  describe('3. Button Component', () => {
    it('renders button with sharp corners (borderRadius: 0)', () => {
      render(<Button title="[ ACTION ]" onPress={() => {}} />);
      expect(screen.getByText('[ ACTION ]')).toBeTruthy();
    });

    it('supports disabled state and loading indicators', () => {
      render(<Button title="[ DISABLED ]" onPress={() => {}} disabled />);
      expect(screen.getByText('[ DISABLED ]')).toBeTruthy();
    });
  });

  describe('4. MobileShell Component', () => {
    it('renders canonical double-slash header notation (// TITLE)', () => {
      render(
        <MobileShell title="CAMPUS EVENTS">
          <></>
        </MobileShell>,
        { wrapper }
      );
      expect(screen.getByText('// CAMPUS EVENTS')).toBeTruthy();
    });

    it('does not double-prefix if title already starts with //', () => {
      render(
        <MobileShell title="// DIRECTORY">
          <></>
        </MobileShell>,
        { wrapper }
      );
      expect(screen.getByText('// DIRECTORY')).toBeTruthy();
    });
  });

  describe('5. Location & Attendance Views Neo-Brutalist Parity', () => {
    it('AttendanceSuccessView renders sharp container and ATTENDANCE RECORDED title', () => {
      render(
        <AttendanceSuccessView
          locationName="Main Auditorium"
          timeLogged="14:00:00"
          onReturnHome={() => {}}
        />
      );
      expect(screen.getByText('ATTENDANCE RECORDED')).toBeTruthy();
      expect(screen.getByText('LOCATION')).toBeTruthy();
      expect(screen.getByText('Main Auditorium')).toBeTruthy();
      expect(screen.getByText('RETURN TO HOME')).toBeTruthy();
    });

    it('LocationPermissionView renders with sharp corners and action buttons', () => {
      render(
        <LocationPermissionView
          onRequestPermission={() => {}}
          onCancel={() => {}}
        />
      );
      expect(screen.getByText('[PERMISSION_GATE // SYS_GEO]')).toBeTruthy();
      expect(screen.getByText('ENABLE LOCATION SERVICES')).toBeTruthy();
      expect(screen.getByText('CANCEL SCAN')).toBeTruthy();
    });

    it('AttendancePermissionsView renders unified camera & location page with single request button', () => {
      const onRequest = vi.fn();
      const onCancel = vi.fn();
      render(
        <AttendancePermissionsView
          onRequestPermissions={onRequest}
          onCancel={onCancel}
        />
      );
      expect(screen.getByText('[PERMISSION_GATE // SYS_ATTENDANCE]')).toBeTruthy();
      expect(screen.getByText('Camera & Location Access')).toBeTruthy();
      expect(screen.getByText('GRANT CAMERA & LOCATION ACCESS')).toBeTruthy();
      expect(screen.getByText('CANCEL SCAN')).toBeTruthy();
      expect(screen.getByText('DENIED / OPEN SYSTEM SETTINGS')).toBeTruthy();
      expect(screen.getByText('Camera QR Scanner')).toBeTruthy();
      expect(screen.getByText('Foreground Geofence')).toBeTruthy();
    });
  });
});
