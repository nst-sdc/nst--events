import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView, TouchableOpacity, TextInput, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/store/theme-store';
import { ActivityIndicator } from '../../../src/ui/core/ActivityIndicator';
import { useUserProfile } from '../../../src/hooks/use-user-profile';
import { useEvents, useEventSessions, EventResponse } from '../../../src/hooks/use-events';
import { useMyRegistrations, MyRegistrationItem } from '../../../src/hooks/use-registration';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { EventCard, ActiveAttendanceCard } from '../../../src/ui/core/Cards';
import { MonoLabel, Display, Body, Mono } from '../../../src/ui/core/Typography';
import { Button } from '../../../src/ui/Button';
import { StatusBadge } from '../../../src/ui/core/StatusBadge';
import { StudentCalendarView } from '../../../src/ui/StudentCalendarView';
import { useAttendanceHistory } from '../../../src/hooks/use-attendance-history';
import { FilterChip } from '../../../src/ui/FilterChip';
import { haptics } from '../../../src/lib/haptics';
import {
  classifyAndSortHomeEvents,
  findActiveAttendanceSession,
  isSessionAttendancePresent,
  isEventCurrentlyLive
} from '../../../src/lib/home-events';
import { EVENT_TYPES } from '@nst/shared';

const CATEGORIES = [
  'ALL',
  ...EVENT_TYPES.map((t) => t.value),
] as const;

function EventRow({
  event,
  userRegistrations,
  userClubMemberships,
  mode = 'all',
  onLiveStatus
}: {
  event: EventResponse;
  userRegistrations: MyRegistrationItem[];
  userClubMemberships: Array<{ club_id: string; role: string }>;
  mode?: 'all' | 'ongoing' | 'upcoming';
  onLiveStatus?: (eventId: string, isLive: boolean) => void;
}) {
  const router = useRouter();
  const theme = useAppTheme();
  const userReg = userRegistrations.find((r) => r.eventId === event.id);
  const regStatus = userReg?.registrationStatus || 'NOT_REGISTERED';
  const isRegistered = regStatus === 'REGISTERED';
  const isWaitlisted = regStatus === 'WAITLISTED';

  const shouldFetchDetails = mode === 'ongoing' || mode === 'all';
  const { data: sessions, isLoading: sessionsLoading } = useEventSessions(event.id, {
    enabled: shouldFetchDetails,
  });
  const { data: attendanceHistory, isLoading: historyLoading } = useAttendanceHistory(event.id, {
    enabled: shouldFetchDetails && isRegistered,
  });

  const primaryClubId = event.eventClubs?.find((ec) => ec.isPrimary)?.clubId;
  const isPrimaryClubAdmin = userClubMemberships.some(
    (cm) => (cm.role === 'CLUB_ADMIN' || cm.role === 'CORE_MEMBER') && cm.club_id === primaryClubId
  );

  const now = new Date();
  const activeSession = findActiveAttendanceSession(
    sessions,
    (event as any)?.attendanceSessions,
    now
  );

  const hasAttendanceForActiveSession = isSessionAttendancePresent(
    activeSession?.id,
    attendanceHistory?.pages,
    event.id
  );

  const isSessionActive = !!activeSession;
  const canScan = isSessionActive && isRegistered && !isPrimaryClubAdmin && !hasAttendanceForActiveSession && !event.isLocked;

  const dateStr = new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isLive = isSessionActive || isEventCurrentlyLive(event, now);
  const bannerUrl = event.metadata?.banner_url as string | undefined;

  React.useEffect(() => {
    if (onLiveStatus && shouldFetchDetails && !sessionsLoading && !historyLoading) {
      onLiveStatus(event.id, isLive);
    }
  }, [event.id, isLive, onLiveStatus, sessionsLoading, historyLoading, shouldFetchDetails]);

  // Render ONGOING (ActiveAttendanceCard if scan available or already marked, otherwise EventCard with LIVE badge)
  if (mode === 'ongoing') {
    if (canScan || (isSessionActive && isRegistered && hasAttendanceForActiveSession)) {
      return (
        <ActiveAttendanceCard
          key={event.id}
          title={event.title}
          location={event.locationName || 'CAMPUS VENUE'}
          date={dateStr}
          time={timeStr}
          status={hasAttendanceForActiveSession ? 'ATTENDANCE_MARKED' : 'SCAN_QR'}
          bannerUrl={bannerUrl}
          onPressAction={() => router.push(`/(app)/events/${event.id}/scan`)}
          onPressCard={() => router.push(`/(app)/events/${event.id}`)}
        />
      );
    }

    let statusText = 'LIVE';
    let statusColor = theme.colors.error;

    if (isPrimaryClubAdmin) {
      statusText = 'LIVE · ORGANIZER';
      statusColor = theme.colors.secondary;
    } else if (isRegistered) {
      statusText = 'LIVE · REGISTERED';
      statusColor = theme.colors.primaryFixed;
    } else if (isWaitlisted) {
      statusText = 'LIVE · WAITLISTED';
      statusColor = theme.colors.warning;
    }

    return (
      <EventCard
        key={event.id}
        title={event.title}
        location={event.locationName || 'CAMPUS VENUE'}
        date={dateStr}
        time={timeStr}
        statusText={statusText}
        statusColor={statusColor}
        bannerUrl={bannerUrl}
        onPress={() => router.push(`/(app)/events/${event.id}`)}
      />
    );
  }

  // Render UPCOMING (EventCard)
  let statusText = 'AVAILABLE';
  let statusColor = theme.colors.primary;

  if (isPrimaryClubAdmin) {
    statusText = 'ORGANIZER';
    statusColor = theme.colors.secondary;
  } else if (isRegistered) {
    statusText = 'REGISTERED';
    statusColor = theme.colors.primaryFixed;
  } else if (isWaitlisted) {
    statusText = 'WAITLISTED';
    statusColor = theme.colors.warning;
  }

  return (
    <EventCard
      key={event.id}
      title={event.title}
      location={event.locationName || 'CAMPUS VENUE'}
      date={dateStr}
      time={timeStr}
      statusText={statusText}
      statusColor={statusColor}
      bannerUrl={bannerUrl}
      onPress={() => router.push(`/(app)/events/${event.id}`)}
    />
  );
}

export default function HomeAttendanceScreen() {
  const theme = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [liveEventIds, setLiveEventIds] = useState<Set<string>>(new Set());

  // Search, Category, Scope, and View Mode states
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'MY_EVENTS'>('ALL');
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const handleLiveStatus = React.useCallback((eventId: string, isLive: boolean) => {
    setLiveEventIds((prev) => {
      if (isLive && !prev.has(eventId)) {
        const next = new Set(prev);
        next.add(eventId);
        return next;
      }
      if (!isLive && prev.has(eventId)) {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      }
      return prev;
    });
  }, []);

  const router = useRouter();
  const { data: profile, refetch: refetchProfile } = useUserProfile();
  const {
    data: eventsData,
    isLoading: eventsLoading,
    isError: isEventsError,
    error: eventsError,
    refetch: refetchEvents
  } = useEvents({
    q: debouncedQuery,
    category: selectedCategory,
  });
  const { data: registrations = [], refetch: refetchRegs } = useMyRegistrations();

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchEvents(), refetchRegs()]);
    setRefreshing(false);
  };

  const now = new Date();
  const allEvents = eventsData?.pages.flatMap((page) => page.data) || [];

  // Filter events according to scope (ALL vs MY_EVENTS)
  const publishedEvents = useMemo(() => {
    let list = allEvents.filter((e) => e.state === 'PUBLISHED');
    if (scopeFilter === 'MY_EVENTS') {
      const regEventIds = new Set(
        registrations
          .filter(
            (r) =>
              r.registrationStatus === 'REGISTERED' || r.registrationStatus === 'WAITLISTED'
          )
          .map((r) => r.eventId)
      );
      list = list.filter((e) => regEventIds.has(e.id));
    }
    return list;
  }, [allEvents, scopeFilter, registrations]);

  const { ongoingEvents, upcomingEvents } = useMemo(() => {
    return classifyAndSortHomeEvents(publishedEvents, now, liveEventIds);
  }, [publishedEvents, now, liveEventIds]);

  const userClubMemberships = profile?.club_memberships || [];
  const isFilterActive = debouncedQuery.length > 0 || selectedCategory !== 'ALL' || scopeFilter === 'MY_EVENTS';

  const currentHour = now.getHours();
  const greetingText =
    currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Bento Welcome Header
        dashboardCard: {
          padding: theme.spacing.base,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.xl,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          borderTopColor: theme.mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.12)',
          gap: 12,
          marginBottom: theme.spacing.base,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme.mode === 'dark' ? 0.3 : 0.06,
          shadowRadius: 12,
          elevation: 2,
        },
        dashboardHeaderTop: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        greetingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        greetingDot: {
          width: 7,
          height: 7,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.solidEmerald,
        },
        greetingLabel: {
          fontSize: 13,
          fontFamily: theme.typography.interMedium,
          color: theme.colors.textSecondary,
        },
        rolePill: {
          backgroundColor: theme.colors.brandSubtle,
          borderWidth: 1,
          borderColor: theme.colors.brandPrimary,
          borderRadius: theme.radii.full,
          paddingHorizontal: 10,
          paddingVertical: 3,
        },
        rolePillText: {
          fontSize: 12,
          fontFamily: theme.typography.monoBold,
          color: theme.colors.brandText,
          letterSpacing: 0.5,
        },
        profileMainRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        },
        avatarCircle: {
          width: 48,
          height: 48,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.brandPrimary,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: theme.colors.surfaceElevated,
          shadowColor: theme.colors.brandPrimary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
          elevation: 3,
        },
        avatarText: {
          fontSize: 20,
          fontFamily: theme.typography.interBold,
          color: '#FFFFFF',
        },
        profileDetails: {
          flex: 1,
          gap: 2,
        },
        dashboardEyebrow: {
          fontSize: 12,
          fontFamily: theme.typography.monoMedium,
          color: theme.colors.brandText,
          letterSpacing: 0.8,
        },
        studentName: {
          fontSize: 20,
          lineHeight: 25,
          fontFamily: theme.typography.interBold,
          letterSpacing: -0.3,
          color: theme.colors.textPrimary,
        },
        academicPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          marginTop: 2,
        },
        academicText: {
          fontSize: 12,
          fontFamily: theme.typography.interRegular,
          color: theme.colors.textSecondary,
        },

        // Linear Tactile Quick Actions
        quickActionsContainer: {
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.base,
        },
        heroScanCard: {
          backgroundColor: theme.colors.brandPrimary,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.base,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          shadowColor: theme.colors.brandPrimary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 14,
          elevation: 4,
        },
        heroScanLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          flex: 1,
        },
        heroIconWell: {
          width: 44,
          height: 44,
          borderRadius: theme.radii.md,
          backgroundColor: 'rgba(255, 255, 255, 0.18)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        heroScanTitles: {
          flex: 1,
          gap: 2,
        },
        heroScanTitle: {
          fontSize: 16,
          fontFamily: theme.typography.interBold,
          color: '#FFFFFF',
          letterSpacing: -0.2,
        },
        heroScanSubtitle: {
          fontSize: 12,
          fontFamily: theme.typography.interRegular,
          color: 'rgba(255, 255, 255, 0.8)',
        },
        heroChevronWell: {
          width: 32,
          height: 32,
          borderRadius: theme.radii.full,
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          justifyContent: 'center',
          alignItems: 'center',
        },

        // Secondary Twin Bento Tiles
        twinGrid: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
        },
        actionTile: {
          flex: 1,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          padding: 14,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          borderTopColor: theme.mode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.08)',
          gap: 10,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.mode === 'dark' ? 0.2 : 0.04,
          shadowRadius: 6,
          elevation: 1,
        },
        tileHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        tileIconWell: {
          width: 36,
          height: 36,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.surfaceSubtle,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tileTitle: {
          fontSize: 14,
          fontFamily: theme.typography.interBold,
          color: theme.colors.textPrimary,
        },
        tileSubtitle: {
          fontSize: 12,
          fontFamily: theme.typography.interRegular,
          color: theme.colors.textMuted,
        },

        // Search & Discovery Filters
        filterContainer: {
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.base,
        },
        searchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          borderRadius: theme.radii.lg,
          paddingHorizontal: 12,
          minHeight: 46,
          gap: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1,
        },
        searchInput: {
          flex: 1,
          color: theme.colors.textPrimary,
          fontSize: 13,
          fontFamily: theme.typography.interMedium,
          paddingVertical: 10,
        },
        clearSearchBtn: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.surfaceSubtle,
        },
        clearText: {
          fontSize: 12,
          fontFamily: theme.typography.monoMedium,
          color: theme.colors.textMuted,
        },
        categoryScroll: {
          flexDirection: 'row',
          gap: 6,
          paddingVertical: 2,
        },
        controlsBar: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginTop: 2,
        },
        segmentGroup: {
          flexDirection: 'row',
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          backgroundColor: theme.colors.surfaceSubtle,
          padding: 2,
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 6,
          marginTop: theme.spacing.xs,
          marginBottom: theme.spacing.xs,
        },
        sectionTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        sectionLivePulse: {
          width: 7,
          height: 7,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.solidEmerald,
        },
        sectionTitle: {
          color: theme.colors.textPrimary,
          fontFamily: theme.typography.interBold,
          fontSize: 14,
          letterSpacing: 0.3,
        },
        sectionSub: {
          color: theme.colors.textMuted,
          fontFamily: theme.typography.monoMedium,
          fontSize: 12,
        },
        loadingContainer: {
          padding: theme.spacing.xl,
          alignItems: 'center',
        },
        errorContainer: {
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.xl,
          alignItems: 'center',
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.badgeTextRed,
          gap: 12,
        },
        errorTitle: {
          color: theme.colors.textPrimary,
          fontSize: 18,
          fontFamily: theme.typography.interBold,
        },
        errorSub: {
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontSize: 13,
        },
        emptyContainer: {
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.xl,
          alignItems: 'center',
          borderRadius: theme.radii.xl,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          gap: 10,
        },
        emptyRadarRingOuter: {
          width: 72,
          height: 72,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.brandSubtle,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 4,
        },
        emptyRadarRingInner: {
          width: 48,
          height: 48,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.brandPrimary,
        },
        emptyTitle: {
          color: theme.colors.textPrimary,
          fontSize: 17,
          fontFamily: theme.typography.interBold,
          letterSpacing: -0.2,
        },
        emptySub: {
          textAlign: 'center',
          color: theme.colors.textMuted,
          fontSize: 13,
          lineHeight: 18,
        },
        eventsList: {
          gap: theme.spacing.sm,
        },
        footerContainer: {
          marginTop: theme.spacing.lg,
          paddingTop: theme.spacing.base,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderSubtle,
          alignItems: 'center',
          paddingBottom: 24,
        },
        footerTitle: {
          color: theme.colors.textMuted,
          fontFamily: theme.typography.monoMedium,
          fontSize: 12,
          marginBottom: 4,
        },
        footerSub: {
          color: theme.colors.textSecondary,
          fontSize: 12,
          textAlign: 'center',
        },
      }),
    [theme]
  );

  const fullName = profile?.full_name || profile?.email || 'STUDENT';
  const programCode = profile?.academic_profile?.batch?.program?.code;
  const batchYear = profile?.academic_profile?.batch?.graduation_year;
  const avatarLetter = (fullName || 'S').trim().charAt(0).toUpperCase();

  return (
    <MobileShell
      title="HOME"
      scrollable={true}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.brandPrimary}
          colors={[theme.colors.brandPrimary]}
          progressBackgroundColor={theme.colors.surface}
        />
      }
    >
      {/* Personalized Student Dashboard Bento Header */}
      <View style={styles.dashboardCard}>
        <View style={styles.dashboardHeaderTop}>
          <View style={styles.greetingRow}>
            <View style={styles.greetingDot} />
            <Text style={styles.greetingLabel}>{greetingText}</Text>
          </View>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>[STUDENT]</Text>
          </View>
        </View>

        <View style={styles.profileMainRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={styles.profileDetails}>
            <MonoLabel style={styles.dashboardEyebrow}>STUDENT DASHBOARD</MonoLabel>
            <Display
              style={styles.studentName}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {fullName.toUpperCase()}
            </Display>
            {programCode ? (
              <View style={styles.academicPill}>
                <MaterialIcons name="school" size={13} color={theme.colors.brandText} />
                <Text style={styles.academicText}>
                  {programCode} · BATCH {batchYear || '2026'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Linear-Grade Tactile Quick Actions Tray */}
      <View style={styles.quickActionsContainer}>
        {/* Primary Hero Action: Scan Attendance */}
        <TouchableOpacity
          style={styles.heroScanCard}
          onPress={() => {
            void haptics.selection();
            const liveEvent = ongoingEvents.find((e) => !e.isLocked);
            if (liveEvent) {
              router.push(`/(app)/events/${liveEvent.id}/scan`);
            } else if (upcomingEvents[0]) {
              router.push(`/(app)/events/${upcomingEvents[0].id}/scan`);
            } else {
              router.push('/(app)/(tabs)/explore');
            }
          }}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="[ 📸 SCAN ATTENDANCE ]"
        >
          <View style={styles.heroScanLeft}>
            <View style={styles.heroIconWell}>
              <MaterialIcons name="qr-code-scanner" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.heroScanTitles}>
              <Text style={styles.heroScanTitle}>Scan Attendance</Text>
              <Text style={styles.heroScanSubtitle}>Verify presence & mark session</Text>
            </View>
          </View>
          <View style={styles.heroChevronWell}>
            <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Secondary Twin Bento Grid */}
        <View style={styles.twinGrid}>
          {/* Explore Campus Action */}
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => {
              void haptics.selection();
              router.push('/(app)/(tabs)/explore');
            }}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="[ 🔍 EXPLORE CAMPUS ]"
          >
            <View style={styles.tileHeader}>
              <View style={styles.tileIconWell}>
                <MaterialIcons name="explore" size={20} color={theme.colors.brandText} />
              </View>
              <MaterialIcons name="north-east" size={16} color={theme.colors.textMuted} />
            </View>
            <View>
              <Text style={styles.tileTitle}>Explore Campus</Text>
              <Text style={styles.tileSubtitle}>Clubs & events</Text>
            </View>
          </TouchableOpacity>

          {/* Activity / Passes Action */}
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => {
              void haptics.selection();
              router.push('/(app)/(tabs)/activity');
            }}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="[ 📋 MY ACTIVITY ]"
          >
            <View style={styles.tileHeader}>
              <View style={styles.tileIconWell}>
                <MaterialIcons name="confirmation-number" size={20} color={theme.colors.brandText} />
              </View>
              <MaterialIcons name="north-east" size={16} color={theme.colors.textMuted} />
            </View>
            <View>
              <Text style={styles.tileTitle}>My Activity</Text>
              <Text style={styles.tileSubtitle}>Passes & logs</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar & Discovery Filters */}
      <View style={styles.filterContainer}>
        {/* Search Input */}
        <View style={styles.searchRow}>
          <MaterialIcons name="search" size={20} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="SEARCH EVENTS..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchInput}
            onChangeText={setSearchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            testID="search-events-input"
          />
          {searchInput.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchInput('')}
              style={styles.clearSearchBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search text"
              testID="btn-clear-search"
            >
              <Text style={styles.clearText}>[CLEAR]</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <FilterChip
                key={cat}
                label={cat}
                selected={isSelected}
                onPress={() => setSelectedCategory(cat)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${cat}`}
                testID={`category-chip-${cat}`}
              />
            );
          })}
        </ScrollView>

        {/* Dual Segmented Controls: Scope & View Mode */}
        <View style={styles.controlsBar}>
          {/* Scope Filter: All Events vs My Passes */}
          <View style={styles.segmentGroup} accessibilityRole="tablist">
            <FilterChip
              label="ALL EVENTS"
              variant="segment"
              selected={scopeFilter === 'ALL'}
              onPress={() => setScopeFilter('ALL')}
              accessibilityRole="tab"
              accessibilityLabel="Show all events"
              testID="tab-all-events"
            />

            <FilterChip
              label="MY EVENTS"
              variant="segment"
              selected={scopeFilter === 'MY_EVENTS'}
              onPress={() => setScopeFilter('MY_EVENTS')}
              accessibilityRole="tab"
              accessibilityLabel="Show my events"
              testID="tab-my-events"
            />
          </View>

          {/* View Mode: List vs Calendar */}
          <View style={styles.segmentGroup} accessibilityRole="tablist">
            <FilterChip
              label="LIST"
              variant="segment"
              selected={viewMode === 'LIST'}
              onPress={() => setViewMode('LIST')}
              accessibilityRole="tab"
              accessibilityLabel="List view mode"
              testID="view-toggle-list"
            />

            <FilterChip
              label="CALENDAR"
              variant="segment"
              selected={viewMode === 'CALENDAR'}
              onPress={() => setViewMode('CALENDAR')}
              accessibilityRole="tab"
              accessibilityLabel="Calendar view mode"
              testID="view-toggle-calendar"
            />
          </View>
        </View>
      </View>

      {/* Main Content Area */}
      {eventsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
          <MonoLabel style={{ marginTop: 8, color: theme.colors.textMuted }}>LOADING EVENTS FEED...</MonoLabel>
        </View>
      ) : isEventsError ? (
        <View style={styles.errorContainer}>
          <StatusBadge status="[FETCH ERROR]" type="error" />
          <Display style={styles.errorTitle}>FAILED TO LOAD</Display>
          <Body style={styles.errorSub}>
            {(eventsError as any)?.message || 'Unable to load events. Check your network connection.'}
          </Body>
          <Button
            title="[ RETRY FETCH ]"
            variant="secondary"
            onPress={() => refetchEvents()}
          />
        </View>
      ) : viewMode === 'CALENDAR' ? (
        /* Calendar View (Phase 8) */
        <StudentCalendarView
          events={publishedEvents}
          registrations={registrations}
          userClubMemberships={userClubMemberships}
        />
      ) : (ongoingEvents.length === 0 && upcomingEvents.length === 0) ? (
        /* Empty States */
        <View style={styles.emptyContainer}>
          <View style={styles.emptyRadarRingOuter}>
            <View style={styles.emptyRadarRingInner}>
              <MaterialIcons name="radar" size={26} color={theme.colors.brandPrimary} />
            </View>
          </View>
          {scopeFilter === 'MY_EVENTS' ? (
            <>
              <StatusBadge status="[NO PASSES]" type="default" />
              <Text style={styles.emptyTitle}>NO REGISTERED EVENTS</Text>
              <Text style={styles.emptySub}>
                You have not registered for any events yet. Explore campus events above to secure your pass!
              </Text>
            </>
          ) : isFilterActive ? (
            <>
              <StatusBadge status="[NO MATCHES]" type="warning" />
              <Text style={styles.emptyTitle}>NO MATCHING EVENTS</Text>
              <Text style={styles.emptySub}>
                No campus events matched your current search and filter criteria. Try clearing filters.
              </Text>
              <Button
                title="[ RESET FILTERS ]"
                variant="secondary"
                onPress={() => {
                  setSearchInput('');
                  setSelectedCategory('ALL');
                  setScopeFilter('ALL');
                }}
                style={{ marginTop: 8 }}
              />
            </>
          ) : (
            <>
              <Display style={styles.emptyTitle}>NO SESSIONS</Display>
              <Text style={styles.emptySub}>Check back later when an event session begins.</Text>
            </>
          )}
        </View>
      ) : (
        /* Event Feed List (Phase 4 & 5) */
        <View style={styles.eventsList}>
          {ongoingEvents.length > 0 && (
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionLivePulse} />
                <Text style={styles.sectionTitle}>LIVE NOW // ONGOING ATTENDANCE</Text>
              </View>
            </View>
          )}
          {ongoingEvents.map((event) => (
            <EventRow
              key={`ongoing-${event.id}`}
              event={event}
              userRegistrations={registrations}
              userClubMemberships={userClubMemberships}
              mode="ongoing"
              onLiveStatus={handleLiveStatus}
            />
          ))}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>UPCOMING EVENTS</Text>
            <Text style={styles.sectionSub}>{upcomingEvents.length} AVAILABLE</Text>
          </View>
          {upcomingEvents.map((event) => (
            <EventRow
              key={`upcoming-${event.id}`}
              event={event}
              userRegistrations={registrations}
              userClubMemberships={userClubMemberships}
              mode="upcoming"
              onLiveStatus={handleLiveStatus}
            />
          ))}

          <View style={styles.footerContainer}>
            <MonoLabel style={styles.footerTitle}>PAST EVENTS</MonoLabel>
            <Body style={styles.footerSub}>View past events on the web app.</Body>
          </View>
        </View>
      )}
    </MobileShell>
  );
}
