import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Modal,
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

export default function CampusClubsScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);

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
    },
    memberAvatarText: {
      color: theme.colors.onPrimary,
      fontSize: 12,
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
          {club.banner_url ? (
            <Image source={{ uri: club.banner_url }} style={styles.bannerImage} />
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
        animationType="slide"
        onRequestClose={() => setSelectedClubId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Title style={styles.modalHeaderTitle} numberOfLines={1}>
                {selectedClub?.name?.toUpperCase() || 'CLUB PROFILE'}
              </Title>
              <TouchableOpacity
                onPress={() => setSelectedClubId(null)}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close club profile"
              >
                <MonoLabel>[ CLOSE ✕ ]</MonoLabel>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContentScroll}>
              {/* Banner */}
              <View style={styles.modalBannerBox}>
                {selectedClub?.banner_url ? (
                  <Image
                    source={{ uri: selectedClub.banner_url }}
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
                <MonoLabel style={styles.modalSectionTitle}>LEADERSHIP & CORE TEAM</MonoLabel>
                {isDetailLoading ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                ) : clubDetail?.members && clubDetail.members.length > 0 ? (
                  clubDetail.members.map((member: ClubMember) => (
                    <View key={member.user_id} style={styles.memberRow}>
                      <View style={styles.memberIdentity}>
                        <View style={styles.memberAvatar}>
                          <Display style={styles.memberAvatarText}>
                            {member.full_name?.charAt(0)?.toUpperCase() || 'M'}
                          </Display>
                        </View>
                        <Title style={styles.memberName}>{member.full_name}</Title>
                      </View>
                      <View style={styles.memberRoleBadge}>
                        <Mono style={styles.memberRoleText}>[{member.role}]</Mono>
                      </View>
                    </View>
                  ))
                ) : (
                  <MonoLabel style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                    NO PUBLIC CORE TEAM MEMBERS LISTED
                  </MonoLabel>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <Button
                  title="CLOSE MODAL"
                  variant="secondary"
                  onPress={() => setSelectedClubId(null)}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </MobileShell>
  );
}
