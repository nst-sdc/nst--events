import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
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
import { openProjectShowcase } from '../../../src/lib/project-showcase';
import {
  classifyAndSortHomeEvents,
  findActiveAttendanceSession,
  isSessionAttendancePresent,
  isEventCurrentlyLive,
} from '../../../src/lib/home-events';

const CATEGORIES = [
  'ALL',
  'HACKATHON',
  'WORKSHOP',
  'SEMINAR',
  'COMPETITION',
  'CULTURAL',
  'SPORTS',
  'MEETUP',
] as const;

function ExploreEventRow({
  event,
  userRegistrations,
  userClubMemberships,
  mode = 'all',
  onLiveStatus,
}: {
  event: EventResponse;
  userRegistrations: MyRegistrationItem[];
  userClubMemberships: Array<{ club_id: string; role: string }>;
  mode?: 'all' | 'ongoing' | 'upcoming';
  onLiveStatus?: (eventId: string, isLive: boolean) => void;
}) {
  const router = useRouter();
  const theme = useAppTheme();
  const { data: sessions, isLoading: sessionsLoading } = useEventSessions(event.id);
  const { data: attendanceHistory, isLoading: historyLoading } = useAttendanceHistory(event.id);

  const primaryClubId = event.eventClubs?.find((ec) => ec.isPrimary)?.clubId;
  const isPrimaryClubAdmin = userClubMemberships.some(
    (cm) => (cm.role === 'CLUB_ADMIN' || cm.role === 'CORE_MEMBER') && cm.club_id === primaryClubId
  );

  const userReg = userRegistrations.find((r) => r.eventId === event.id);
  const regStatus = userReg?.registrationStatus || 'NOT_REGISTERED';

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
  const isRegistered = regStatus === 'REGISTERED';
  const isWaitlisted = regStatus === 'WAITLISTED';
  const canScan = isSessionActive && isRegistered && !isPrimaryClubAdmin && !hasAttendanceForActiveSession && !event.isLocked;

  const dateStr = new Date(event.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isLive = isSessionActive || isEventCurrentlyLive(event, now);
  const bannerUrl = event.metadata?.banner_url as string | undefined;

  useEffect(() => {
    if (onLiveStatus && !sessionsLoading && !historyLoading) {
      onLiveStatus(event.id, isLive);
    }
  }, [event.id, isLive, onLiveStatus, sessionsLoading, historyLoading]);

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

export default function ExploreScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [liveEventIds, setLiveEventIds] = useState<Set<string>>(new Set());

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'MY_CLUBS'>('ALL');
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const handleLiveStatus = useCallback((eventId: string, isLive: boolean) => {
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

  const { data: profile, refetch: refetchProfile } = useUserProfile();
  const {
    data: eventsData,
    isLoading: eventsLoading,
    isError: isEventsError,
    error: eventsError,
    refetch: refetchEvents,
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
  const userClubMemberships = profile?.club_memberships || [];
  const userClubIds = useMemo(() => new Set(userClubMemberships.map((c) => c.club_id)), [userClubMemberships]);

  const publishedEvents = useMemo(() => {
    let list = allEvents.filter((e) => e.state === 'PUBLISHED');
    if (scopeFilter === 'MY_CLUBS') {
      list = list.filter((e) => {
        const clubs = e.eventClubs || [];
        return clubs.some((ec) => userClubIds.has(ec.clubId));
      });
    }
    return list;
  }, [allEvents, scopeFilter, userClubIds]);

  const { ongoingEvents, upcomingEvents } = useMemo(() => {
    return classifyAndSortHomeEvents(publishedEvents, now, liveEventIds);
  }, [publishedEvents, now, liveEventIds]);

  const isFilterActive = debouncedQuery.length > 0 || selectedCategory !== 'ALL' || scopeFilter === 'MY_CLUBS';

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        directoryShortcutsBar: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: theme.spacing.md,
        },
        shortcutChip: {
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          backgroundColor: theme.colors.surfaceContainerLow,
        },
        shortcutText: {
          fontSize: 10,
          fontFamily: theme.typography.monoBold,
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
      }),
    [theme]
  );

  return (
    <MobileShell
      title="EXPLORE"
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
      {/* Search & Filter Controls */}
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
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                activeOpacity={0.7}
                testID={`category-chip-${cat}`}
              >
                <Mono style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                  {cat}
                </Mono>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Scope and View Mode Controls */}
        <View style={styles.controlsBar}>
          <View style={styles.segmentGroup}>
            <TouchableOpacity
              onPress={() => setScopeFilter('ALL')}
              style={[styles.segmentBtn, scopeFilter === 'ALL' && styles.segmentBtnActive]}
              activeOpacity={0.8}
              testID="tab-all-events"
            >
              <Mono style={[styles.segmentText, scopeFilter === 'ALL' && styles.segmentTextActive]}>
                ALL EVENTS
              </Mono>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setScopeFilter('MY_CLUBS')}
              style={[styles.segmentBtn, scopeFilter === 'MY_CLUBS' && styles.segmentBtnActive]}
              activeOpacity={0.8}
              testID="tab-my-clubs"
            >
              <Mono style={[styles.segmentText, scopeFilter === 'MY_CLUBS' && styles.segmentTextActive]}>
                MY CLUBS
              </Mono>
            </TouchableOpacity>
          </View>

          <View style={styles.segmentGroup}>
            <TouchableOpacity
              onPress={() => setViewMode('LIST')}
              style={[styles.segmentBtn, viewMode === 'LIST' && styles.segmentBtnActive]}
              activeOpacity={0.8}
              testID="view-toggle-list"
            >
              <Mono style={[styles.segmentText, viewMode === 'LIST' && styles.segmentTextActive]}>
                LIST
              </Mono>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setViewMode('CALENDAR')}
              style={[styles.segmentBtn, viewMode === 'CALENDAR' && styles.segmentBtnActive]}
              activeOpacity={0.8}
              testID="view-toggle-calendar"
            >
              <Mono style={[styles.segmentText, viewMode === 'CALENDAR' && styles.segmentTextActive]}>
                CALENDAR
              </Mono>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Campus Directory Shortcuts */}
      <View style={styles.directoryShortcutsBar}>
        <TouchableOpacity
          style={styles.shortcutChip}
          onPress={() => router.push('/(app)/clubs')}
          activeOpacity={0.8}
        >
          <Mono style={styles.shortcutText}>[ 👥 CLUBS ]</Mono>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shortcutChip}
          onPress={() => router.push('/(app)/students')}
          activeOpacity={0.8}
        >
          <Mono style={styles.shortcutText}>[ 🔍 DIRECTORY ]</Mono>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shortcutChip}
          onPress={() => openProjectShowcase()}
          activeOpacity={0.8}
        >
          <Mono style={styles.shortcutText}>[ 🚀 PROJECTS ↗ ]</Mono>
        </TouchableOpacity>
      </View>

      {/* Content Feed */}
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
        <StudentCalendarView
          events={publishedEvents}
          registrations={registrations}
          userClubMemberships={userClubMemberships}
        />
      ) : (ongoingEvents.length === 0 && upcomingEvents.length === 0) ? (
        <View style={styles.emptyContainer}>
          {isFilterActive ? (
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
              <Display style={styles.emptyTitle}>NO EVENTS</Display>
              <Body style={styles.emptySub}>No campus events are currently published.</Body>
            </>
          )}
        </View>
      ) : (
        <View style={styles.eventsList}>
          {ongoingEvents.length > 0 && (
            <View style={styles.sectionHeader}>
              <MonoLabel style={styles.sectionTitle}>LIVE NOW // ONGOING</MonoLabel>
            </View>
          )}
          {ongoingEvents.map((event) => (
            <ExploreEventRow
              key={`explore-ongoing-${event.id}`}
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
            <ExploreEventRow
              key={`explore-upcoming-${event.id}`}
              event={event}
              userRegistrations={registrations}
              userClubMemberships={userClubMemberships}
              mode="upcoming"
              onLiveStatus={handleLiveStatus}
            />
          ))}
        </View>
      )}
    </MobileShell>
  );
}
