import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/store/theme-store';
import { MobileShell } from '../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../src/ui/core/Typography';
import { StatusBadge } from '../../src/ui/core/StatusBadge';
import { Button } from '../../src/ui/Button';
import { ActivityIndicator } from '../../src/ui/core/ActivityIndicator';
import {
  useMyLeaderboardRank,
  useStudentLeaderboard,
  useClubLeaderboard,
  LeaderboardStudent,
  LeaderboardClub,
} from '../../src/hooks/use-leaderboard';
import { useUserProfile } from '../../src/hooks/use-user-profile';

type LeaderboardTab = 'students' | 'clubs';

export default function CampusLeaderboardScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('students');
  const [refreshing, setRefreshing] = useState(false);

  const { data: profile } = useUserProfile();
  const { data: myRank, isLoading: isMyRankLoading, refetch: refetchMyRank } = useMyLeaderboardRank();
  const {
    data: studentData,
    isLoading: isStudentLoading,
    isError: isStudentError,
    error: studentError,
    refetch: refetchStudents,
  } = useStudentLeaderboard(50);

  const {
    data: clubData,
    isLoading: isClubLoading,
    isError: isClubError,
    error: clubError,
    refetch: refetchClubs,
  } = useClubLeaderboard(50);

  const studentsList = useMemo(() => studentData?.data || [], [studentData]);
  const clubsList = useMemo(() => clubData?.data || [], [clubData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([refetchMyRank(), refetchStudents(), refetchClubs()]);
    setRefreshing(false);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: theme.spacing.base,
      gap: theme.spacing.md,
      paddingBottom: 40,
    },
    headerBanner: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      padding: theme.spacing.base,
      gap: 6,
    },
    headerMicro: {
      color: theme.colors.primary,
    },
    headerTitle: {
      fontSize: 22,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      lineHeight: 16,
    },
    // Personal Standing Card
    standingCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      padding: theme.spacing.base,
      gap: 10,
    },
    standingTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    standingLabel: {
      fontSize: 10,
      color: theme.colors.primary,
    },
    standingContent: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 12,
    },
    standingRank: {
      fontSize: 32,
      fontFamily: theme.typography.syneExtraBold,
      color: theme.colors.primary,
      lineHeight: 34,
    },
    standingPoints: {
      fontSize: 18,
      fontFamily: theme.typography.monoBold,
      color: theme.colors.secondary,
    },
    standingNotice: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 15,
    },
    // Segmented Tab Controls
    tabsRow: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    tabButton: {
      flex: 1,
      minHeight: 48,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 1,
    },
    tabTextActive: {
      color: theme.colors.onPrimary,
    },
    // Podium Section
    podiumSection: {
      gap: 8,
      marginVertical: 4,
    },
    podiumTitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 10,
    },
    podiumGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    podiumCard: {
      flex: 1,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      padding: 10,
      alignItems: 'center',
      gap: 6,
    },
    podiumCardRank1: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
      transform: [{ scale: 1.02 }],
    },
    podiumRankTag: {
      fontSize: 12,
      fontFamily: theme.typography.monoBold,
      color: theme.colors.primary,
    },
    podiumAvatar: {
      width: 36,
      height: 36,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    podiumAvatarText: {
      color: theme.colors.onPrimary,
      fontSize: 16,
    },
    podiumName: {
      fontSize: 11,
      textAlign: 'center',
      minHeight: 28,
    },
    podiumPoints: {
      fontSize: 10,
      color: theme.colors.secondary,
    },
    // Ranked Roster
    rosterSection: {
      gap: 8,
    },
    rosterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    rosterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      padding: 12,
      marginBottom: 6,
    },
    rosterRowSelf: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
    },
    rosterLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    rankBadge: {
      width: 34,
      height: 34,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankBadgeText: {
      fontSize: 11,
      color: theme.colors.primary,
    },
    rosterAvatar: {
      width: 30,
      height: 30,
      backgroundColor: theme.colors.surfaceContainerHighest,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rosterAvatarText: {
      color: theme.colors.primary,
      fontSize: 12,
    },
    rosterInfo: {
      flex: 1,
      gap: 2,
    },
    rosterNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rosterName: {
      fontSize: 13,
      letterSpacing: -0.2,
    },
    rosterSub: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    rosterRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    pointsPill: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    pointsText: {
      fontSize: 11,
      color: theme.colors.primary,
    },
    selfPill: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    selfPillText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 8,
      color: theme.colors.onPrimary,
    },
    emptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 10,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
    },
    emptyTitle: {
      fontSize: 15,
    },
    emptySubtitle: {
      fontSize: 12,
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
    },
  }), [theme]);

  const topThreeStudents = useMemo(() => studentsList.slice(0, 3), [studentsList]);
  const remainingStudents = useMemo(() => studentsList.slice(3), [studentsList]);

  const topThreeClubs = useMemo(() => clubsList.slice(0, 3), [clubsList]);
  const remainingClubs = useMemo(() => clubsList.slice(3), [clubsList]);

  const isLoading = activeTab === 'students' ? isStudentLoading : isClubLoading;
  const isError = activeTab === 'students' ? isStudentError : isClubError;
  const error = activeTab === 'students' ? studentError : clubError;
  const currentList = activeTab === 'students' ? studentsList : clubsList;

  const handleBackToProfile = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/profile');
    }
  };

  return (
    <MobileShell
      title="CAMPUS LEADERBOARD"
      showBackButton
      onBackPress={handleBackToProfile}
      scrollable={false}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Header Micro-annotation */}
        <View style={styles.headerBanner}>
          <MonoLabel style={styles.headerMicro}>
            HONOR ROLL // MERIT &amp; ENGAGEMENT LEDGER
          </MonoLabel>
          <Body style={styles.headerSubtitle}>
            Recognizing student participation, verified session attendance, and active club initiatives at NST.
          </Body>
        </View>

        {/* Personal Standing Card */}
        <View style={styles.standingCard}>
          <View style={styles.standingTopRow}>
            <MonoLabel style={styles.standingLabel}>STUDENT MERIT STANDING</MonoLabel>
            {isMyRankLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : myRank?.rank ? (
              <StatusBadge status="[RANKED]" type="success" />
            ) : (
              <StatusBadge status="[UNRANKED]" type="default" />
            )}
          </View>

          <View style={styles.standingContent}>
            <Display style={styles.standingRank}>
              {myRank?.rank ? `#${myRank.rank}` : 'UNRANKED'}
            </Display>
            <Mono style={styles.standingPoints}>
              {myRank?.total_points ?? 0} PTS
            </Mono>
          </View>

          <Body style={styles.standingNotice}>
            {myRank?.rank
              ? `You are ranked #${myRank.rank} campus-wide. Attend upcoming events and workshops to earn more points.`
              : 'You have not accrued recorded attendance points yet. Attend sessions and check in via QR to get ranked.'}
          </Body>
        </View>

        {/* Segmented Tab Controls */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'students' && styles.tabButtonActive]}
            onPress={() => setActiveTab('students')}
            activeOpacity={0.8}
            accessibilityLabel="Students leaderboard tab"
          >
            <Text style={[styles.tabText, activeTab === 'students' && styles.tabTextActive]}>
              STUDENTS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'clubs' && styles.tabButtonActive]}
            onPress={() => setActiveTab('clubs')}
            activeOpacity={0.8}
            accessibilityLabel="Clubs leaderboard tab"
          >
            <Text style={[styles.tabText, activeTab === 'clubs' && styles.tabTextActive]}>
              CLUBS
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content States */}
        {isLoading ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <MonoLabel>RETRIEVING LEADERBOARD LEDGER...</MonoLabel>
          </View>
        ) : isError ? (
          <View style={styles.emptyBox}>
            <StatusBadge status="[LEDGER SYNC ERROR]" type="error" />
            <Display style={styles.emptyTitle}>COULDN&apos;T LOAD LEADERBOARD</Display>
            <Body style={styles.emptySubtitle}>
              {error?.message || 'Unable to fetch leaderboard records.'}
            </Body>
            <Button
              title="RETRY ↺"
              variant="secondary"
              onPress={() => (activeTab === 'students' ? refetchStudents() : refetchClubs())}
            />
          </View>
        ) : currentList.length === 0 ? (
          <View style={styles.emptyBox}>
            <MonoLabel style={{ color: theme.colors.secondary }}>[ NO RECORDS ]</MonoLabel>
            <Display style={styles.emptyTitle}>NO RANKINGS AVAILABLE</Display>
            <Body style={styles.emptySubtitle}>
              The campus leaderboard has not been calculated yet or records are currently empty.
            </Body>
          </View>
        ) : (
          <>
            {/* Top 3 Podium Cards */}
            <View style={styles.podiumSection}>
              <MonoLabel style={styles.podiumTitle}>PODIUM // TOP 3</MonoLabel>
              <View style={styles.podiumGrid}>
                {activeTab === 'students'
                  ? topThreeStudents.map((s, idx) => (
                      <View
                        key={s.user_id}
                        style={[styles.podiumCard, idx === 0 && styles.podiumCardRank1]}
                      >
                        <Mono style={styles.podiumRankTag}>
                          {idx === 0 ? '👑 #1' : idx === 1 ? '🥈 #2' : '🥉 #3'}
                        </Mono>
                        <View style={styles.podiumAvatar}>
                          <Display style={styles.podiumAvatarText}>
                            {s.display_name?.charAt(0)?.toUpperCase() || 'S'}
                          </Display>
                        </View>
                        <Title style={styles.podiumName} numberOfLines={2}>
                          {s.display_name?.toUpperCase()}
                        </Title>
                        <Mono style={styles.podiumPoints}>{s.total_points} PTS</Mono>
                      </View>
                    ))
                  : topThreeClubs.map((c, idx) => (
                      <View
                        key={c.club_id}
                        style={[styles.podiumCard, idx === 0 && styles.podiumCardRank1]}
                      >
                        <Mono style={styles.podiumRankTag}>
                          {idx === 0 ? '👑 #1' : idx === 1 ? '🥈 #2' : '🥉 #3'}
                        </Mono>
                        <View style={styles.podiumAvatar}>
                          <Display style={styles.podiumAvatarText}>
                            {c.club_name?.charAt(0)?.toUpperCase() || 'C'}
                          </Display>
                        </View>
                        <Title style={styles.podiumName} numberOfLines={2}>
                          {c.club_name?.toUpperCase()}
                        </Title>
                        <Mono style={styles.podiumPoints}>{c.total_points} PTS</Mono>
                      </View>
                    ))}
              </View>
            </View>

            {/* Complete Ranked List */}
            <View style={styles.rosterSection}>
              <View style={styles.rosterHeader}>
                <MonoLabel>ALL RANKINGS</MonoLabel>
                <MonoLabel>{currentList.length} TOTAL</MonoLabel>
              </View>

              {activeTab === 'students'
                ? remainingStudents.map((s) => {
                    const isSelf = profile?.id === s.user_id;
                    return (
                      <View
                        key={s.user_id}
                        style={[styles.rosterRow, isSelf && styles.rosterRowSelf]}
                      >
                        <View style={styles.rosterLeft}>
                          <View style={styles.rankBadge}>
                            <Mono style={styles.rankBadgeText}>#{s.rank}</Mono>
                          </View>
                          <View style={styles.rosterAvatar}>
                            <Display style={styles.rosterAvatarText}>
                              {s.display_name?.charAt(0)?.toUpperCase() || 'S'}
                            </Display>
                          </View>
                          <View style={styles.rosterInfo}>
                            <View style={styles.rosterNameRow}>
                              <Title style={styles.rosterName} numberOfLines={1}>
                                {s.display_name}
                              </Title>
                              {isSelf && (
                                <View style={styles.selfPill}>
                                  <Text style={styles.selfPillText}>YOU</Text>
                                </View>
                              )}
                            </View>
                            <MonoLabel style={styles.rosterSub}>STUDENT OPERATIVE</MonoLabel>
                          </View>
                        </View>

                        <View style={styles.rosterRight}>
                          <View style={styles.pointsPill}>
                            <Mono style={styles.pointsText}>{s.total_points} PTS</Mono>
                          </View>
                        </View>
                      </View>
                    );
                  })
                : remainingClubs.map((c) => (
                    <View key={c.club_id} style={styles.rosterRow}>
                      <View style={styles.rosterLeft}>
                        <View style={styles.rankBadge}>
                          <Mono style={styles.rankBadgeText}>#{c.rank}</Mono>
                        </View>
                        <View style={styles.rosterAvatar}>
                          <Display style={styles.rosterAvatarText}>
                            {c.club_name?.charAt(0)?.toUpperCase() || 'C'}
                          </Display>
                        </View>
                        <View style={styles.rosterInfo}>
                          <Title style={styles.rosterName} numberOfLines={1}>
                            {c.club_name}
                          </Title>
                          <MonoLabel style={styles.rosterSub}>
                            {c.event_count || 0} EVENTS // {c.member_count || 0} MEMBERS
                          </MonoLabel>
                        </View>
                      </View>

                      <View style={styles.rosterRight}>
                        <View style={styles.pointsPill}>
                          <Mono style={styles.pointsText}>{c.total_points} PTS</Mono>
                        </View>
                      </View>
                    </View>
                  ))}
            </View>
          </>
        )}
      </ScrollView>
    </MobileShell>
  );
}
