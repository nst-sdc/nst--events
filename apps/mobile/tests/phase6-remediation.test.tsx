// @vitest-environment jsdom
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent, waitFor } from './mocks/testing-library-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import {
  isInternalProjectUrl,
  buildProjectShowcaseUrl,
  openProjectShowcase,
  openShowcaseOrExternalUrl,
  NST_PROJECTS_BASE_URL,
} from '../src/lib/project-showcase';

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue(null),
    revokeAccess: vi.fn().mockResolvedValue(null),
  },
  statusCodes: {},
}));

import MobileEventResultsScreen from '../app/(app)/events/[id]/results';
import ExploreScreen from '../app/(app)/(tabs)/explore';
import ProfileScreen from '../app/(app)/(tabs)/profile';
import ActivityScreen from '../app/(app)/(tabs)/activity';
import AttendanceDetailScreen from '../app/(app)/history/[id]';
import DisputesIndexScreen from '../app/(app)/disputes/index';
import NewDisputeScreen from '../app/(app)/disputes/new';

// Mocks
vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: (props: any) => React.createElement('Text', props, props.name),
    Ionicons: (props: any) => React.createElement('Text', props, props.name),
    FontAwesome: (props: any) => React.createElement('Text', props, props.name),
    Feather: (props: any) => React.createElement('Text', props, props.name),
  };
});

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockReplace = vi.fn();
const mockNavigate = vi.fn();
let mockCanGoBack = true;
let mockSearchParams: Record<string, string> = {};

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    navigate: mockNavigate,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

vi.mock('../src/infrastructure/network', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

vi.mock('../src/infrastructure/api', () => ({
  apiClient: vi.fn(),
  APP_VERSION: '1.0.0',
}));

// Hook mocks
vi.mock('../src/hooks/use-event-results', () => ({
  useEventResults: () => ({
    data: {
      event: { id: 'evt-1', title: 'Campus Hackathon 2026', slug: 'campus-hackathon-2026' },
      summary: { total_awards: 1 },
      results: {
        published_at: '2026-05-01T00:00:00.000Z',
        revision_number: 1,
        podium: [
          {
            id: 'aw-1',
            title: 'Grand Prize',
            award_type: 'PODIUM',
            placement: 1,
            project_links: [
              {
                id: 'link-ext',
                type: 'EXTERNAL',
                external_url: 'https://github.com/nst-org/innovative-hack',
                title_snapshot: 'GitHub Source Repository',
              },
              {
                id: 'link-int',
                type: 'NST_PROJECT',
                project: { id: 'p-1', title: 'Innovative Hack', slug: 'innovative-hack' },
              },
            ],
            recipients: [],
          },
        ],
      },
      status: 'PUBLISHED',
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useStudentAchievements: () => ({
    data: {
      achievements: [
        {
          id: 'ach-1',
          award_title: '1st Place Hackathon',
          placement: 1,
          published_at: '2026-05-01T00:00:00.000Z',
          event: { id: 'evt-1', title: 'NST Campus Hackathon' },
          linked_project: { id: 'proj-1', title: 'NST Super App', slug: 'nst-super-app' },
        },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../src/hooks/use-events', () => ({
  useEvents: () => ({
    data: {
      pages: [
        {
          data: [{ id: 'evt-1', title: 'NST Campus Hackathon', venue: 'Auditorium' }],
        },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useEvent: (id?: string) => ({
    data: id === 'evt-1' ? { id: 'evt-1', title: 'NST Campus Hackathon', venue: 'Auditorium' } : null,
    isLoading: false,
    isError: false,
  }),
  useEventSessions: () => ({ data: [], isLoading: false }),
}));

vi.mock('../src/hooks/use-user-profile', () => ({
  useUserProfile: () => ({
    data: {
      id: 'usr-1',
      full_name: 'Alex Johnson',
      email: 'alex@nstsdc.org',
      role: 'STUDENT',
      student_profile: { id: 'sp-1', slug: 'alex-j' },
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../src/hooks/use-student-profiles', () => ({
  useMyStudentProfile: () => ({
    data: { id: 'sp-1', slug: 'alex-j', full_name: 'Alex Johnson' },
    isLoading: false,
  }),
}));

vi.mock('../src/hooks/use-registration', () => ({
  useMyRegistrations: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}));

vi.mock('../src/hooks/use-attendance-history', () => ({
  useAttendanceHistory: () => ({
    data: { pages: [{ data: [] }] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../src/hooks/use-invitations', () => ({
  usePendingInvitations: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}));

vi.mock('../src/hooks/use-disputes', () => ({
  useMyDisputes: () => ({
    data: { pages: [{ data: [] }] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSubmitDispute: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('../src/hooks/use-teams', () => ({
  useTeams: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
}));

vi.mock('../src/ui/StudentCalendarView', () => ({
  StudentCalendarView: () => null,
}));

vi.mock('../src/ui/ResultReportModal', () => ({
  ResultReportModal: () => null,
}));

vi.mock('../src/ui/ProfileVisibilityModal', () => ({
  ProfileVisibilityModal: () => null,
}));

vi.mock('../src/ui/brand/DevClubCreditsModal', () => ({
  DevClubCreditsModal: () => null,
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('Phase 6 Mobile Remediation Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanGoBack = true;
    mockSearchParams = {};
  });

  describe('1. In-App Browser & Showcase Link Routing Utility', () => {
    it('accurately identifies internal NST project showcase URLs', () => {
      expect(isInternalProjectUrl('https://events.nstsdc.org/projects')).toBe(true);
      expect(isInternalProjectUrl('https://events.nstsdc.org/projects/hackathon-alpha')).toBe(true);
      expect(isInternalProjectUrl('https://events.nstsdc.org/projects/sub/path')).toBe(true);

      // External URLs
      expect(isInternalProjectUrl('https://github.com/nst-sdc/events')).toBe(false);
      expect(isInternalProjectUrl('https://devpost.com/software/my-project')).toBe(false);
      expect(isInternalProjectUrl('https://nstsdc.org/projects')).toBe(false);
      expect(isInternalProjectUrl('')).toBe(false);
      expect(isInternalProjectUrl(null)).toBe(false);
      expect(isInternalProjectUrl(undefined)).toBe(false);
    });

    it('builds canonical project showcase URLs from slugs or handles root directory', () => {
      expect(buildProjectShowcaseUrl()).toBe(NST_PROJECTS_BASE_URL);
      expect(buildProjectShowcaseUrl('')).toBe(NST_PROJECTS_BASE_URL);
      expect(buildProjectShowcaseUrl('   ')).toBe(NST_PROJECTS_BASE_URL);
      expect(buildProjectShowcaseUrl('autonomous-rover')).toBe('https://events.nstsdc.org/projects/autonomous-rover');
      expect(buildProjectShowcaseUrl('/leading-slash-slug')).toBe('https://events.nstsdc.org/projects/leading-slash-slug');
      expect(buildProjectShowcaseUrl('https://events.nstsdc.org/projects/full-url')).toBe('https://events.nstsdc.org/projects/full-url');
    });

    it('openProjectShowcase opens in-app browser with expo-web-browser', async () => {
      await openProjectShowcase('smart-campus-dashboard');
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://events.nstsdc.org/projects/smart-campus-dashboard');
    });

    it('openProjectShowcase falls back to Linking.openURL if WebBrowser fails', async () => {
      vi.mocked(WebBrowser.openBrowserAsync).mockRejectedValueOnce(new Error('Browser launch failed'));
      const linkingSpy = vi.spyOn(Linking, 'openURL');

      await openProjectShowcase('failed-browser-slug');
      expect(linkingSpy).toHaveBeenCalledWith('https://events.nstsdc.org/projects/failed-browser-slug');
    });

    it('openShowcaseOrExternalUrl routes internal URLs to WebBrowser and external URLs to Linking', async () => {
      const linkingSpy = vi.spyOn(Linking, 'openURL');

      // Internal showcase
      await openShowcaseOrExternalUrl('https://events.nstsdc.org/projects/ai-bot');
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://events.nstsdc.org/projects/ai-bot');
      expect(linkingSpy).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // External repository
      await openShowcaseOrExternalUrl('https://github.com/my-squad/ai-bot');
      expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
      expect(linkingSpy).toHaveBeenCalledWith('https://github.com/my-squad/ai-bot');
    });
  });

  describe('2. Runtime Verification: In-App Browser in Screens', () => {
    it('Event Results screen: opens internal showcase in WebBrowser and external submission in Linking', async () => {
      const linkingSpy = vi.spyOn(Linking, 'openURL');
      mockSearchParams = { id: 'evt-1' };

      renderWithProviders(<MobileEventResultsScreen />);

      // External submission link
      const externalLink = screen.getByText('GitHub Source Repository ↗');
      fireEvent.press(externalLink);
      expect(linkingSpy).toHaveBeenCalledWith('https://github.com/nst-org/innovative-hack');
      expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // NST showcase link
      const showcaseLink = screen.getByText('Innovative Hack ↗');
      fireEvent.press(showcaseLink);
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://events.nstsdc.org/projects/innovative-hack');
      expect(linkingSpy).not.toHaveBeenCalled();
    });

    it('Explore screen: [ 🚀 PROJECTS ↗ ] shortcut opens in-app browser', async () => {
      renderWithProviders(<ExploreScreen />);

      const projectsButton = screen.getByText('[ 🚀 PROJECTS ↗ ]');
      fireEvent.press(projectsButton);

      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(NST_PROJECTS_BASE_URL);
    });

    it('Profile screen: [ SHOWCASE PROJECT ↗ ] opens in-app browser with project slug', async () => {
      renderWithProviders(<ProfileScreen />);

      const showcaseButton = screen.getByText('[ SHOWCASE PROJECT ↗ ]');
      fireEvent.press(showcaseButton);

      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://events.nstsdc.org/projects/nst-super-app');
    });

    it('Activity screen: [ SHOWCASE PROJECT ↗ ] in Honors section opens in-app browser', async () => {
      mockSearchParams = { tab: 'honors' };
      renderWithProviders(<ActivityScreen />);

      const showcaseButton = screen.getByText('[ SHOWCASE PROJECT ↗ ]');
      fireEvent.press(showcaseButton);

      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://events.nstsdc.org/projects/nst-super-app');
    });
  });

  describe('3. Runtime Verification: Legacy Attendance-History Navigation Fallbacks', () => {
    it('Profile screen: ATTENDANCE LOGS navigates to Activity Attendance tab', async () => {
      renderWithProviders(<ProfileScreen />);

      const attendanceRow = screen.getByText('ATTENDANCE LOGS');
      fireEvent.press(attendanceRow);

      expect(mockNavigate).toHaveBeenCalledWith('/(app)/(tabs)/activity?tab=attendance');
    });

    it('Activity screen: correctly activates ATTENDANCE section when tab=attendance is passed', async () => {
      mockSearchParams = { tab: 'attendance' };
      renderWithProviders(<ActivityScreen />);

      expect(screen.getByText('VERIFIED ATTENDANCE SESSIONS')).toBeTruthy();
      expect(screen.getByText('NO ATTENDANCE RECORDS')).toBeTruthy();
    });

    it('Attendance Detail screen (history/[id]): normal back navigation when canGoBack is true', async () => {
      mockCanGoBack = true;
      mockSearchParams = { id: 'evt-1' };
      renderWithProviders(<AttendanceDetailScreen />);

      const backButton = screen.getByText('← BACK');
      fireEvent.press(backButton);

      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('Attendance Detail screen (history/[id]): falls back to Activity Attendance tab when canGoBack is false', async () => {
      mockCanGoBack = false;
      mockSearchParams = { id: 'evt-1' };
      renderWithProviders(<AttendanceDetailScreen />);

      const backButton = screen.getByText('← BACK');
      fireEvent.press(backButton);

      expect(mockBack).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/activity?tab=attendance');
    });

    it('Attendance Detail screen: RETURN TO ATTENDANCE HISTORY button on not-found error routes to Activity Attendance tab', async () => {
      mockSearchParams = { id: 'non-existent-evt' };
      renderWithProviders(<AttendanceDetailScreen />);

      const returnButton = screen.getByText('RETURN TO ATTENDANCE HISTORY');
      fireEvent.press(returnButton);

      expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/activity?tab=attendance');
    });

    it('Disputes Index screen: normal back navigation when canGoBack is true', async () => {
      mockCanGoBack = true;
      renderWithProviders(<DisputesIndexScreen />);

      const backButton = screen.getByText('← BACK');
      fireEvent.press(backButton);

      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('Disputes Index screen: falls back to Activity Attendance tab when canGoBack is false', async () => {
      mockCanGoBack = false;
      renderWithProviders(<DisputesIndexScreen />);

      const backButton = screen.getByText('← BACK');
      fireEvent.press(backButton);

      expect(mockBack).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/activity?tab=attendance');
    });

    it('Disputes Index screen: empty state GO TO ATTENDANCE HISTORY routes to Activity Attendance tab', async () => {
      renderWithProviders(<DisputesIndexScreen />);

      const emptyCta = screen.getByText('GO TO ATTENDANCE HISTORY');
      fireEvent.press(emptyCta);

      expect(mockNavigate).toHaveBeenCalledWith('/(app)/(tabs)/activity?tab=attendance');
    });

    it('New Dispute screen: normal back navigation when canGoBack is true', async () => {
      mockCanGoBack = true;
      mockSearchParams = { sessionId: 's-1', title: 'Calculus Session' };
      renderWithProviders(<NewDisputeScreen />);

      const backButton = screen.getByText('← BACK');
      fireEvent.press(backButton);

      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('New Dispute screen: falls back to Activity Attendance tab when canGoBack is false', async () => {
      mockCanGoBack = false;
      mockSearchParams = { sessionId: 's-1', title: 'Calculus Session' };
      renderWithProviders(<NewDisputeScreen />);

      const backButton = screen.getByText('← BACK');
      fireEvent.press(backButton);

      expect(mockBack).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/activity?tab=attendance');
    });
  });
});
