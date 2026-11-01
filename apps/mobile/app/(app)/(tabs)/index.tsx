import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
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
import { usePendingInvitations } from '../../../src/hooks/use-invitations';
import { FilterChip } from '../../../src/ui/FilterChip';
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

  // Only ongoing events require per-event session windows and attendance verification.
  // Upcoming events render cards based on static event timing and registration status,
  // preventing unnecessary request fan-out on initial feed render.
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
  const { data: invitations = [], refetch: refetchInvites } = usePendingInvitations();
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
    await Promise.all([refetchProfile(), refetchEvents(), refetchRegs(), refetchInvites()]);
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        dashboardHeader: {
          padding: theme.spacing.base,
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.md,
        },
        studentGreeting: {
          fontSize: 16,
          color: theme.colors.onSurface,
        },
        roleBadgeContainer: {
          borderWidth: 1,
          borderColor: theme.colors.primaryFixed,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        roleBadgeText: {
          fontSize: 9,
          fontFamily: theme.typography.monoBold,
          color: theme.colors.primaryFixed,
        },
        quickActionsTray: {
          gap: 8,
          marginBottom: theme.spacing.md,
        },
        quickActionBtn: {
          flex: 1,
          paddingVertical: 10,
          alignItems: 'center',
          backgroundColor: theme.colors.surfaceContainerLowest,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
        },
        quickActionPrimary: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        quickActionPrimaryText: {
          fontSize: 10,
          fontFamily: theme.typography.monoBold,
          color: theme.colors.onPrimary,
        },
        quickActionText: {
          fontSize: 10,
          fontFamily: theme.typography.monoBold,
          color: theme.colors.onSurface,
        },
        alertBanner: {
          padding: 12,
          backgroundColor: theme.colors.surfaceContainerLowest,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          marginBottom: theme.spacing.md,
        },
        alertDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.colors.primary,
        },
        filterContainer: {
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        },
        searchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surfaceContainerLowest,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          paddingHorizontal: theme.spacing.md,
          minHeight: 44,
        },
        searchInput: {
          flex: 1,
          color: theme.colors.onSurface,
          fontSize: 13,
          fontFamily: theme.typography.monoMedium,
          paddingVertical: 8,
        },
        clearSearchBtn: {
          paddingHorizontal: 8,
          paddingVertical: 4,
        },
        categoryScroll: {
          flexDirection: 'row',
          gap: 6,
          paddingVertical: 2,
        },
        categoryChip: {
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surfaceContainerLow,
        },
        categoryChipActive: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary,
        },
        categoryChipText: {
          fontSize: 10,
          color: theme.colors.onSurfaceVariant,
          fontFamily: theme.typography.monoBold,
          letterSpacing: 0.5,
        },
        categoryChipTextActive: {
          color: theme.colors.onPrimary,
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
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surfaceContainerLowest,
        },
        segmentBtn: {
          paddingVertical: 6,
          paddingHorizontal: 10,
        },
        segmentBtnActive: {
          backgroundColor: theme.colors.surfaceContainerHighest,
        },
        segmentText: {
          fontSize: 10,
          color: theme.colors.onSurfaceVariant,
          fontFamily: theme.typography.monoBold,
        },
        segmentTextActive: {
          color: theme.colors.primary,
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderHairline,
          paddingBottom: 8,
          marginBottom: theme.spacing.md,
        },
        sectionTitle: {
          color: theme.colors.onSurfaceVariant,
        },
        sectionSub: {
          color: theme.colors.outline,
        },
        loadingContainer: {
          padding: theme.spacing.xl,
          alignItems: 'center',
        },
        errorContainer: {
          backgroundColor: theme.colors.surfaceContainerLow,
          padding: theme.spacing.xl,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.error,
          gap: 12,
        },
        errorTitle: {
          color: theme.colors.onSurface,
          fontSize: 20,
        },
        errorSub: {
          textAlign: 'center',
          color: theme.colors.onSurfaceVariant,
        },
        emptyContainer: {
          backgroundColor: theme.colors.surfaceContainerLow,
          padding: theme.spacing.xl,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          gap: 8,
        },
        emptyTitle: {
          color: theme.colors.primary,
          marginBottom: 4,
          fontSize: 18,
        },
        emptySub: {
          textAlign: 'center',
          color: theme.colors.onSurfaceVariant,
          fontSize: 11,
        },
        eventsList: {
          gap: theme.spacing.sm,
        },
        footerContainer: {
          marginTop: theme.spacing.xl,
          paddingTop: theme.spacing.xl,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderHairline,
          alignItems: 'center',
          paddingBottom: 32,
        },
        footerTitle: {
          color: theme.colors.onSurfaceVariant,
          marginBottom: 4,
        },
        footerSub: {
          color: theme.colors.outline,
          textAlign: 'center',
        },
      }),
    [theme]
  );

  const fullName = profile?.full_name || profile?.email || 'STUDENT';
  const programCode = profile?.academic_profile?.batch?.program?.code;
  const batchYear = profile?.academic_profile?.batch?.graduation_year;

  return (
    <MobileShell 
      title="HOME" 
      scrollable={true}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={handleRefresh} 
          tintColor={theme.colors.primary} 
          colors={[theme.colors.primary]}
          progressBackgroundColor={theme.colors.surface}
        />
      }
    >
      {/* Personalized Welcome Header */}
      <View style={styles.dashboardHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <MonoLabel style={{ color: theme.colors.primary, fontSize: 9 }}>STUDENT DASHBOARD</MonoLabel>
          <Display style={styles.studentGreeting} numberOfLines={1}>
            {fullName.toUpperCase()}
          </Display>
          {programCode && (
            <Mono style={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}>
              {programCode} · BATCH {batchYear || '2026'}
            </Mono>
          )}
        </View>
        <View style={styles.roleBadgeContainer}>
          <Mono style={styles.roleBadgeText}>[STUDENT]</Mono>
        </View>
      </View>

      {/* Quick Actions Tray */}
      <View style={styles.quickActionsTray}>
        <TouchableOpacity
          style={[styles.quickActionBtn, styles.quickActionPrimary]}
          onPress={() => {
            const liveEvent = ongoingEvents.find((e) => !e.isLocked);
            if (liveEvent) {
              router.push(`/(app)/events/${liveEvent.id}/scan`);
            } else if (upcomingEvents[0]) {
              router.push(`/(app)/events/${upcomingEvents[0].id}/scan`);
            } else {
              router.push('/(app)/(tabs)/explore');
            }
          }}
          activeOpacity={0.8}
        >
          <Mono style={styles.quickActionPrimaryText}>[ 📸 SCAN ATTENDANCE ]</Mono>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => router.push('/(app)/(tabs)/explore')}
            activeOpacity={0.8}
          >
            <Mono style={styles.quickActionText}>[ 🔍 EXPLORE CAMPUS ]</Mono>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => router.push('/(app)/(tabs)/activity')}
            activeOpacity={0.8}
          >
            <Mono style={styles.quickActionText}>[ 📋 MY ACTIVITY ]</Mono>
          </TouchableOpacity>
        </View>
      </View>

      {/* Actionable Alerts (Pending Invites) */}
      {invitations.length > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => router.push('/(app)/(tabs)/activity?tab=invites')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.alertDot} />
              <MonoLabel style={{ color: theme.colors.primary, fontSize: 10 }}>
                PENDING SQUAD INVITATION{invitations.length > 1 ? 'S' : ''} ({invitations.length})
              </MonoLabel>
            </View>
            <MonoLabel style={{ color: theme.colors.primary }}>REVIEW →</MonoLabel>
          </View>
          <Body style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            You have received squad invitation{invitations.length > 1 ? 's' : ''} for upcoming team competitions.
          </Body>
        </TouchableOpacity>
      )}

      {/* Search Bar & Discovery Filters */}
      <View style={styles.filterContainer}>
        {/* Search Input */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="SEARCH EVENTS..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
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
              <MonoLabel style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>[CLEAR]</MonoLabel>
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
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>LOADING EVENTS FEED...</MonoLabel>
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
          {scopeFilter === 'MY_EVENTS' ? (
            <>
              <StatusBadge status="[NO PASSES]" type="default" />
              <Display style={styles.emptyTitle}>NO REGISTERED EVENTS</Display>
              <Body style={styles.emptySub}>
                You have not registered for any events yet. Explore events above to secure your pass!
              </Body>
            </>
          ) : isFilterActive ? (
            <>
              <StatusBadge status="[NO MATCHES]" type="warning" />
              <Display style={styles.emptyTitle}>NO MATCHING EVENTS</Display>
              <Body style={styles.emptySub}>
                No campus events matched your current search and filter criteria. Try clearing filters.
              </Body>
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
              <Body style={styles.emptySub}>Check back later when an event session begins.</Body>
            </>
          )}
        </View>
      ) : (
        /* Event Feed List (Phase 4 & 5) */
        <View style={styles.eventsList}>
          {ongoingEvents.length > 0 && (
            <View style={styles.sectionHeader}>
              <MonoLabel style={styles.sectionTitle}>LIVE NOW // ONGOING ATTENDANCE</MonoLabel>
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
            <MonoLabel style={styles.sectionTitle}>UPCOMING EVENTS</MonoLabel>
            <MonoLabel style={styles.sectionSub}>{upcomingEvents.length} AVAILABLE</MonoLabel>
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

