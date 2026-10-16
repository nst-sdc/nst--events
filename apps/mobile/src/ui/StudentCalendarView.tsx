import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../store/theme-store';
import { Title, Body, MonoLabel, Mono } from './core/Typography';
import { EventResponse } from '../hooks/use-events';
import { MyRegistrationItem } from '../hooks/use-registration';
import { EventCard } from './core/Cards';

interface StudentCalendarViewProps {
  events: EventResponse[];
  registrations: MyRegistrationItem[];
  userClubMemberships: Array<{ club_id: string; role: string }>;
}

function toLocalDateString(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

export function StudentCalendarView({
  events,
  registrations,
  userClubMemberships,
}: StudentCalendarViewProps) {
  const router = useRouter();
  const theme = useAppTheme();

  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(toLocalDateString(today));

  // Map events to date strings
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventResponse[]>();
    events.forEach((ev) => {
      const dateKey = toLocalDateString(ev.startTime);
      const list = map.get(dateKey) || [];
      list.push(ev);
      map.set(dateKey, list);
    });
    return map;
  }, [events]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days: Array<{
      dayNumber: number | null;
      dateStr: string | null;
      hasEvents: boolean;
      eventCount: number;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Leading empty slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dayNumber: null,
        dateStr: null,
        hasEvents: false,
        eventCount: 0,
        isToday: false,
        isSelected: false,
      });
    }

    const todayStr = toLocalDateString(today);

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(currentMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${mStr}-${dStr}`;
      const evList = eventsByDate.get(dateStr) || [];

      days.push({
        dayNumber: d,
        dateStr,
        hasEvents: evList.length > 0,
        eventCount: evList.length,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
      });
    }

    return days;
  }, [currentYear, currentMonth, eventsByDate, today, selectedDateStr]);

  // Selected date events
  const selectedEvents = useMemo(() => {
    if (!selectedDateStr) return [];
    return eventsByDate.get(selectedDateStr) || [];
  }, [selectedDateStr, eventsByDate]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: theme.spacing.lg,
        },
        headerNav: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
        },
        monthTitle: {
          fontSize: 16,
          fontFamily: theme.typography.monoBold,
          color: theme.colors.onSurface,
        },
        navButton: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: 6,
          backgroundColor: theme.colors.surfaceContainerHighest,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        weekHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 4,
        },
        weekDayCell: {
          flex: 1,
          alignItems: 'center',
        },
        weekDayLabel: {
          fontSize: 10,
          color: theme.colors.onSurfaceVariant,
        },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surfaceContainerLowest,
        },
        dayCell: {
          width: '14.285%',
          aspectRatio: 1,
          borderWidth: 0.5,
          borderColor: theme.colors.outlineVariant,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        },
        dayCellSelected: {
          backgroundColor: theme.colors.surfaceContainerHighest,
          borderColor: theme.colors.primary,
          borderWidth: 1.5,
        },
        dayCellToday: {
          borderColor: theme.colors.primary,
        },
        dayText: {
          fontSize: 12,
          fontFamily: theme.typography.monoMedium,
          color: theme.colors.onSurface,
        },
        dayTextSelected: {
          color: theme.colors.primary,
          fontFamily: theme.typography.monoBold,
        },
        dotIndicator: {
          width: 5,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: theme.colors.primary,
          position: 'absolute',
          bottom: 4,
        },
        eventsSection: {
          gap: theme.spacing.md,
          marginTop: theme.spacing.md,
        },
        sectionTitleRow: {
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
          paddingBottom: 6,
        },
        emptyDayCard: {
          padding: theme.spacing.lg,
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          alignItems: 'center',
        },
      }),
    [theme]
  );

  return (
    <View style={styles.container}>
      {/* Month Navigation */}
      <View style={styles.headerNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navButton} activeOpacity={0.7} testID="btn-prev-month">
          <MonoLabel style={{ color: theme.colors.primary }}>&lt; PREV</MonoLabel>
        </TouchableOpacity>

        <Mono style={styles.monthTitle}>
          {MONTH_NAMES[currentMonth]} {currentYear}
        </Mono>

        <TouchableOpacity onPress={nextMonth} style={styles.navButton} activeOpacity={0.7} testID="btn-next-month">
          <MonoLabel style={{ color: theme.colors.primary }}>NEXT &gt;</MonoLabel>
        </TouchableOpacity>
      </View>

      {/* Weekday Row */}
      <View style={styles.weekHeader}>
        {DAYS_OF_WEEK.map((w) => (
          <View key={w} style={styles.weekDayCell}>
            <MonoLabel style={styles.weekDayLabel}>{w}</MonoLabel>
          </View>
        ))}
      </View>

      {/* Days Grid */}
      <View style={styles.grid}>
        {calendarDays.map((item, idx) => {
          if (!item.dayNumber || !item.dateStr) {
            return <View key={`empty-${idx}`} style={styles.dayCell} />;
          }

          return (
            <TouchableOpacity
              key={item.dateStr}
              onPress={() => item.dateStr && setSelectedDateStr(item.dateStr)}
              style={[
                styles.dayCell,
                item.isSelected && styles.dayCellSelected,
                item.isToday && styles.dayCellToday,
              ]}
              activeOpacity={0.7}
              testID={`calendar-day-${item.dateStr}`}
            >
              <Mono
                style={[
                  styles.dayText,
                  item.isSelected && styles.dayTextSelected,
                ]}
              >
                {item.dayNumber}
              </Mono>
              {item.hasEvents && <View style={styles.dotIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Date Events Listing */}
      <View style={styles.eventsSection}>
        <View style={styles.sectionTitleRow}>
          <MonoLabel style={{ color: theme.colors.primary, fontFamily: theme.typography.monoBold }}>
            AGENDA FOR {selectedDateStr} ({selectedEvents.length} EVENT{selectedEvents.length === 1 ? '' : 'S'})
          </MonoLabel>
        </View>

        {selectedEvents.length === 0 ? (
          <View style={styles.emptyDayCard}>
            <MonoLabel style={{ color: theme.colors.onSurfaceVariant }}>
              NO EVENTS SCHEDULED ON THIS DATE.
            </MonoLabel>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {selectedEvents.map((event) => {
              const userReg = registrations.find((r) => r.eventId === event.id);
              const isRegistered = userReg?.registrationStatus === 'REGISTERED';
              const isWaitlisted = userReg?.registrationStatus === 'WAITLISTED';

              const dateStr = new Date(event.startTime).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              });
              const timeStr = new Date(event.startTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              let statusText = 'AVAILABLE';
              let statusColor = theme.colors.primary;
              if (isRegistered) {
                statusText = 'REGISTERED';
                statusColor = theme.colors.primaryFixed;
              } else if (isWaitlisted) {
                statusText = 'WAITLISTED';
                statusColor = theme.colors.warning;
              }

              return (
                <EventCard
                  key={`cal-${event.id}`}
                  title={event.title}
                  location={event.locationName || 'CAMPUS VENUE'}
                  date={dateStr}
                  time={timeStr}
                  statusText={statusText}
                  statusColor={statusColor}
                  bannerUrl={event.metadata?.banner_url as string | undefined}
                  onPress={() => router.push(`/events/${event.id}`)}
                />
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
