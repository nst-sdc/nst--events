import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/store/theme-store';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';
import { StatusBadge } from '../../../src/ui/core/StatusBadge';
import { Button } from '../../../src/ui/Button';
import { ActivityIndicator } from '../../../src/ui/core/ActivityIndicator';
import { useClubs, useClub, ClubListItem, ClubMember } from '../../../src/hooks/use-clubs';

const ROLE_WEIGHT: Record<string, number> = {
  CLUB_ADMIN: 1,
  FACULTY_MENTOR: 2,
  CORE_MEMBER: 3,
  LEAD: 4,
  TECH_HEAD: 5,
  MEMBER: 10,
};

export default function CampusClubsScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  const translateY = useRef(new Animated.Value(0)).current;

  // Animate sheet sliding in from bottom when a club is selected
  useEffect(() => {
    if (selectedClubId) {
      setIsRosterExpanded(false);
      setRosterSearch('');
      translateY.setValue(600);
      Animated.spring(translateY, {
        toValue: 0,
        bounciness: 2,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedClubId, translateY]);

  const closeModal = React.useCallback(() => {
    Animated.timing(translateY, {
      toValue: 600,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setSelectedClubId(null);
    });
  }, [translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Detect intentional downward drag
          return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          // Close if dragged down past threshold or swiped downwards with velocity
          if (gestureState.dy > 100 || gestureState.vy > 0.6) {
            closeModal();
          } else {
            // Snap back up
            Animated.spring(translateY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [closeModal, translateY]
  );

  const {
    data: clubsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useClubs(searchQuery);

  const {
    data: clubDetail,
    isLoading: isDetailLoading,
  } = useClub(selectedClubId || '', !!selectedClubId);

  const clubsList = useMemo(() => {
    return clubsData?.data || [];
  }, [clubsData]);

  const sortedMembers = useMemo(() => {
    const list = [...(clubDetail?.members || [])];
    return list.sort((a, b) => {
      const weightA = ROLE_WEIGHT[a.role] ?? 8;
      const weightB = ROLE_WEIGHT[b.role] ?? 8;
      if (weightA !== weightB) return weightA - weightB;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  }, [clubDetail?.members]);

  const filteredMembers = useMemo(() => {
    if (!rosterSearch.trim()) return sortedMembers;
    const q = rosterSearch.toLowerCase();
    return sortedMembers.filter(
      (m) =>
        m.full_name?.toLowerCase().includes(q) ||
        m.role?.toLowerCase().includes(q)
    );
  }, [sortedMembers, rosterSearch]);

  const displayedMembers = useMemo(() => {
    if (rosterSearch.trim() || isRosterExpanded || filteredMembers.length <= 4) {
      return filteredMembers;
    }
    return filteredMembers.slice(0, 4);
  }, [filteredMembers, isRosterExpanded, rosterSearch]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: theme.spacing.base,
      gap: theme.spacing.md,
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
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      paddingHorizontal: theme.spacing.md,
      height: 48,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontFamily: theme.typography.monoMedium,
      fontSize: 12,
      color: theme.colors.primary,
      paddingVertical: 0,
    },
    clearButton: {
      padding: 4,
    },
    clearButtonText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    metaLabel: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    metaValue: {
      fontSize: 10,
      color: theme.colors.primary,
    },
    clubCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: theme.spacing.base,
      gap: 12,
      marginBottom: 12,
    },
    bannerContainer: {
      width: '100%',
      height: 120,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    bannerImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    bannerPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    bannerMonogram: {
      fontSize: 32,
      fontFamily: theme.typography.syneExtraBold,
      color: theme.colors.primary,
      opacity: 0.8,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    cardTitleBox: {
      flex: 1,
      gap: 2,
    },
    clubName: {
      fontSize: 16,
      letterSpacing: -0.3,
    },
    clubDescription: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
    },
    metricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    metricPill: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    metricText: {
      fontSize: 10,
      color: theme.colors.primary,
    },
    cardActionRow: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
      paddingTop: 10,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(9, 9, 11, 0.75)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
      maxHeight: '85%',
      paddingBottom: 24,
    },
    dragHandleContainer: {
      width: '100%',
      paddingTop: 10,
      paddingBottom: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dragHandleBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.outlineVariant,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    modalHeaderTitle: {
      fontSize: 16,
      flex: 1,
    },
    modalCloseBtn: {
      padding: 6,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContentScroll: {
      padding: theme.spacing.base,
      gap: theme.spacing.lg,
    },
    modalBannerBox: {
      width: '100%',
      height: 140,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      backgroundColor: theme.colors.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    modalSection: {
      gap: 8,
    },
    modalSectionTitle: {
      color: theme.colors.primary,
      fontSize: 10,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    statBox: {
      flex: 1,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      padding: 10,
      alignItems: 'center',
      gap: 2,
    },
    statNumber: {
      fontSize: 20,
    },
    statDesc: {
      fontSize: 9,
      color: theme.colors.onSurfaceVariant,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      padding: 10,
      marginBottom: 6,
    },
    memberIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    memberAvatar: {
      width: 28,
      height: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    memberAvatarImage: {
      width: '100%',
      height: '100%',
    },
    memberAvatarText: {
      color: theme.colors.onPrimary,
      fontFamily: theme.typography.syneBold,
      fontSize: 12,
      lineHeight: 14,
      textAlign: 'center',
      includeFontPadding: false,
    },
    memberName: {
      fontSize: 12,
    },
    memberRoleBadge: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    memberRoleText: {
      fontSize: 9,
      color: theme.colors.onSurfaceVariant,
    },
    rosterSearchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      paddingHorizontal: 10,
      paddingVertical: 2,
      marginBottom: 6,
    },
    rosterSearchInput: {
      flex: 1,
      color: theme.colors.onSurface,
      fontSize: 11,
      fontFamily: theme.typography.monoMedium,
      paddingVertical: 4,
    },
    rosterExpandBtn: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 4,
    },
    rosterExpandText: {
      fontSize: 10,
      fontFamily: theme.typography.monoBold,
      color: theme.colors.primary,
      letterSpacing: 0.5,
    },
    modalActions: {
      marginTop: 12,
      gap: 8,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 24,
      gap: 12,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      marginTop: 12,
    },
    emptyTitle: {
      fontSize: 16,
    },
    emptySubtitle: {
      fontSize: 12,
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
      lineHeight: 16,
    },
  }), [theme]);

  const renderClubCard = (club: ClubListItem) => {
    const initials = club.name
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 3)
      .join('')
      .toUpperCase();

    return (
      <TouchableOpacity
        key={club.id}
        style={styles.clubCard}
        onPress={() => setSelectedClubId(club.id)}
        activeOpacity={0.8}
      >
        <View style={styles.bannerContainer}>
          {(club.banner_url || club.bannerUrl) ? (
            <Image
              testID={`club-banner-${club.id}`}
              source={{ uri: (club.banner_url || club.bannerUrl)! }}
              style={styles.bannerImage}
            />
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Display style={styles.bannerMonogram}>{initials}</Display>
              <MonoLabel style={{ fontSize: 9 }}>[ CAMPUS CHAPTER ]</MonoLabel>
            </View>
          )}
        </View>

        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBox}>
            <Title style={styles.clubName} numberOfLines={1}>
              {club.name.toUpperCase()}
            </Title>
            <Body style={styles.clubDescription} numberOfLines={2}>
              {club.description || 'No public overview available for this student club.'}
            </Body>
          </View>
          <StatusBadge
            status={`[${club.status}]`}
            type={club.status === 'ACTIVE' ? 'success' : 'default'}
          />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricPill}>
            <Mono style={styles.metricText}>[ {club.event_count || 0} EVENTS ]</Mono>
          </View>
          <View style={styles.metricPill}>
            <Mono style={styles.metricText}>[ {club.member_count || 0} MEMBERS ]</Mono>
          </View>
        </View>

        <View style={styles.cardActionRow}>
          <Button
            title="VIEW PROFILE & ROSTER →"
            variant="secondary"
            onPress={() => setSelectedClubId(club.id)}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const handleBackToProfile = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/profile');
    }
  };

  const selectedClub = useMemo(() => {
    return clubsList.find((c) => c.id === selectedClubId) || null;
  }, [clubsList, selectedClubId]);

  return (
    <MobileShell
      title="STUDENT CLUBS"
      showBackButton
      onBackPress={handleBackToProfile}
      scrollable={false}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Micro-annotation */}
        <View style={styles.headerBanner}>
          <MonoLabel style={styles.headerMicro}>
            CAMPUS DIRECTORY // STUDENT COLLECTIVES & SOCIETIES
          </MonoLabel>
          <Body style={styles.headerSubtitle}>
            Browse registered student organizations, technical chapters, and creative collectives at NST.
          </Body>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={18} color={theme.colors.onSurfaceVariant} />
          <TextInput
            placeholder="Search clubs by name, domain, keywords..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Clear search input"
            >
              <Text style={styles.clearButtonText}>[CLEAR]</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Meta Row */}
        <View style={styles.metaRow}>
          <MonoLabel style={styles.metaLabel}>ACTIVE REPERTORY</MonoLabel>
          <Mono style={styles.metaValue}>
            {clubsList.length} {clubsList.length === 1 ? 'COLLECTIVE' : 'COLLECTIVES'} FOUND
          </Mono>
        </View>

        {/* Content States */}
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <MonoLabel>LOADING CAMPUS DIRECTORY...</MonoLabel>
          </View>
        ) : isError ? (
          <View style={styles.emptyContainer}>
            <StatusBadge status="[SYNC FAILED]" type="error" />
            <Display style={styles.emptyTitle}>COULDN'T LOAD CLUBS</Display>
            <Body style={styles.emptySubtitle}>
              {error?.message || 'Unable to establish connection with the campus directory ledger.'}
            </Body>
            <Button title="RETRY CONNECTION ↺" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : clubsList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MonoLabel style={{ color: theme.colors.secondary }}>[ ZERO MATCHES ]</MonoLabel>
            <Display style={styles.emptyTitle}>NO CLUBS FOUND</Display>
            <Body style={styles.emptySubtitle}>
              No student collective matches &quot;{searchQuery}&quot;. Try adjusting your keywords.
            </Body>
            {searchQuery.length > 0 && (
              <Button
                title="RESET SEARCH FILTER"
                variant="secondary"
                onPress={() => setSearchQuery('')}
              />
            )}
          </View>
        ) : (
          clubsList.map(renderClubCard)
        )}
      </ScrollView>

      {/* Club Detail Modal Sheet */}
      <Modal
        visible={!!selectedClubId}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          {/* Tap backdrop to dismiss */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeModal}
            accessibilityLabel="Dismiss club profile sheet"
          />

          <Animated.View
            style={[
              styles.modalSheet,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Slide Down Drag Handle */}
            <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
              <View style={styles.dragHandleBar} />
            </View>

            <View {...panResponder.panHandlers} style={styles.modalHeader}>
              <Title style={styles.modalHeaderTitle} numberOfLines={1}>
                {selectedClub?.name?.toUpperCase() || 'CLUB PROFILE'}
              </Title>
              <TouchableOpacity
                onPress={closeModal}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close club profile"
              >
                <MonoLabel>[ CLOSE ✕ ]</MonoLabel>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContentScroll}>
              {/* Banner */}
              <View style={styles.modalBannerBox}>
                {(selectedClub?.banner_url || selectedClub?.bannerUrl) ? (
                  <Image
                    testID="club-modal-banner"
                    source={{ uri: (selectedClub.banner_url || selectedClub.bannerUrl)! }}
                    style={styles.bannerImage}
                  />
                ) : (
                  <Display style={styles.bannerMonogram}>
                    {selectedClub?.name?.slice(0, 3)?.toUpperCase() || 'NST'}
                  </Display>
                )}
              </View>

              {/* Status and Overview */}
              <View style={styles.modalSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <MonoLabel style={styles.modalSectionTitle}>STATUS & STANDING</MonoLabel>
                  <StatusBadge
                    status={`[${selectedClub?.status || 'ACTIVE'}]`}
                    type={selectedClub?.status === 'ACTIVE' ? 'success' : 'default'}
                  />
                </View>
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Display style={styles.statNumber}>
                      {clubDetail?.event_count ?? selectedClub?.event_count ?? 0}
                    </Display>
                    <MonoLabel style={styles.statDesc}>HOSTED EVENTS</MonoLabel>
                  </View>
                  <View style={styles.statBox}>
                    <Display style={styles.statNumber}>
                      {selectedClub?.member_count ?? clubDetail?.members?.length ?? 0}
                    </Display>
                    <MonoLabel style={styles.statDesc}>TOTAL MEMBERS</MonoLabel>
                  </View>
                </View>
              </View>

              {/* Description */}
              <View style={styles.modalSection}>
                <MonoLabel style={styles.modalSectionTitle}>OVERVIEW</MonoLabel>
                <Body style={{ lineHeight: 18, color: theme.colors.onSurfaceVariant }}>
                  {clubDetail?.description || selectedClub?.description || 'No description provided.'}
                </Body>
              </View>

              {/* Core Team Roster */}
              <View style={styles.modalSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <MonoLabel style={styles.modalSectionTitle}>LEADERSHIP & CORE TEAM</MonoLabel>
                  {sortedMembers.length > 0 && (
                    <MonoLabel style={{ color: theme.colors.outline, fontSize: 9 }}>
                      [{sortedMembers.length} {sortedMembers.length === 1 ? 'MEMBER' : 'MEMBERS'}]
                    </MonoLabel>
                  )}
                </View>

                {sortedMembers.length > 4 && (
                  <View style={styles.rosterSearchBox}>
                    <TextInput
                      placeholder={`Search ${sortedMembers.length} members by name or role...`}
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                      value={rosterSearch}
                      onChangeText={setRosterSearch}
                      style={styles.rosterSearchInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {rosterSearch.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setRosterSearch('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{ color: theme.colors.primary, fontSize: 10, fontFamily: theme.typography.monoBold }}>
                          [✕]
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {isDetailLoading ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                ) : displayedMembers.length > 0 ? (
                  <>
                    {displayedMembers.map((member: ClubMember) => (
                      <View key={member.user_id} style={styles.memberRow}>
                        <View style={styles.memberIdentity}>
                          <View style={styles.memberAvatar}>
                            {member.avatar_url ? (
                              <Image
                                source={{ uri: member.avatar_url }}
                                style={styles.memberAvatarImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={styles.memberAvatarText}>
                                {member.full_name?.charAt(0)?.toUpperCase() || 'M'}
                              </Text>
                            )}
                          </View>
                          <Title style={styles.memberName}>{member.full_name}</Title>
                        </View>
                        <View style={styles.memberRoleBadge}>
                          <Mono style={styles.memberRoleText}>[{member.role}]</Mono>
                        </View>
                      </View>
                    ))}

                    {filteredMembers.length > 4 && !rosterSearch.trim() && (
                      <TouchableOpacity
                        style={styles.rosterExpandBtn}
                        onPress={() => setIsRosterExpanded(!isRosterExpanded)}
                        activeOpacity={0.8}
                      >
                        <Mono style={styles.rosterExpandText}>
                          {isRosterExpanded
                            ? '▲ SHOW LESS'
                            : `▼ SHOW ALL ${filteredMembers.length} MEMBERS (${filteredMembers.length - 4} MORE)`}
                        </Mono>
                      </TouchableOpacity>
                    )}
                  </>
                ) : rosterSearch.trim().length > 0 ? (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <MonoLabel style={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}>
                      NO MEMBERS MATCHING "{rosterSearch.toUpperCase()}"
                    </MonoLabel>
                  </View>
                ) : (
                  <MonoLabel style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                    NO PUBLIC CORE TEAM MEMBERS LISTED
                  </MonoLabel>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </MobileShell>
  );
}
