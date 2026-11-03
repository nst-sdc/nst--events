import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';
import { ActivityIndicator } from '../../../src/ui/core/ActivityIndicator';
import { useStudentDirectory, PublicStudentCard } from '../../../src/hooks/use-student-profiles';
import { MaterialIcons } from '@expo/vector-icons';
import { FilterChip } from '../../../src/ui/FilterChip';

export default function StudentDirectoryScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const [search, setSearch] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<string | undefined>();
  const [selectedSkill, setSelectedSkill] = useState<string | undefined>();

  const { data, isLoading, isError, refetch, isRefetching } = useStudentDirectory({
    search: search.trim() || undefined,
    program: selectedProgram,
    skill: selectedSkill,
  });

  const students = data?.items || [];
  const facets = data?.facets || { programs: [], batches: [], skills: [] };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.surface,
        },
        searchSection: {
          padding: theme.spacing.base,
          backgroundColor: theme.colors.surfaceContainerLow,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderHairline,
          gap: theme.spacing.sm,
        },
        searchInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          paddingHorizontal: theme.spacing.sm,
          gap: theme.spacing.xs,
        },
        searchInput: {
          flex: 1,
          height: 42,
          fontFamily: theme.typography.monoRegular,
          fontSize: 13,
          color: theme.colors.onSurface,
        },
        filterRow: {
          flexDirection: 'row',
          gap: 6,
          flexWrap: 'wrap',
          marginTop: 4,
        },
        filterChip: {
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          backgroundColor: theme.colors.surface,
        },
        filterChipActive: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        filterChipText: {
          fontFamily: theme.typography.monoMedium,
          fontSize: 10,
          color: theme.colors.onSurfaceVariant,
          textTransform: 'uppercase',
        },
        filterChipTextActive: {
          color: theme.colors.onPrimary,
        },
        card: {
          marginHorizontal: theme.spacing.base,
          marginTop: theme.spacing.base,
          padding: theme.spacing.base,
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 2,
          borderColor: theme.colors.borderHairline,
          gap: theme.spacing.sm,
        },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        },
        avatarBox: {
          width: 48,
          height: 48,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: theme.colors.onSurface,
          overflow: 'hidden',
        },
        avatarText: {
          fontFamily: theme.typography.syneBold,
          fontSize: 18,
          color: theme.colors.onPrimary,
        },
        headerTextContainer: {
          flex: 1,
        },
        nameText: {
          fontFamily: theme.typography.syneBold,
          fontSize: 17,
          color: theme.colors.onSurface,
        },
        handleText: {
          fontFamily: theme.typography.monoMedium,
          fontSize: 11,
          color: theme.colors.primary,
          marginTop: 2,
        },
        academicBadge: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          paddingHorizontal: 6,
          paddingVertical: 2,
          alignSelf: 'flex-start',
          marginTop: 4,
        },
        academicText: {
          fontFamily: theme.typography.monoRegular,
          fontSize: 9,
          color: theme.colors.onSurfaceVariant,
          textTransform: 'uppercase',
        },
        headlineText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 12,
          color: theme.colors.secondary,
        },
        bioText: {
          fontFamily: theme.typography.interRegular,
          fontSize: 13,
          color: theme.colors.onSurfaceVariant,
          lineHeight: 18,
        },
        skillsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        },
        skillBadge: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
        skillText: {
          fontFamily: theme.typography.monoRegular,
          fontSize: 10,
          color: theme.colors.primary,
        },
        cardFooter: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderHairline,
          paddingTop: theme.spacing.sm,
          marginTop: 4,
        },
        statsRow: {
          flexDirection: 'row',
          gap: theme.spacing.md,
        },
        statText: {
          fontFamily: theme.typography.monoMedium,
          fontSize: 10,
          color: theme.colors.onSurfaceVariant,
        },
        viewBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
        },
        viewBtnText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 11,
          color: theme.colors.primary,
          letterSpacing: 0.5,
        },
        emptyBox: {
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          gap: 12,
        },
      }),
    [theme]
  );

  const handleBackToProfile = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/profile');
    }
  };

  return (
    <MobileShell
      title="STUDENT DIRECTORY"
      showBackButton={true}
      onBackPress={handleBackToProfile}
      scrollable={false}
    >
      <View style={styles.container}>
        {/* Search & Filter Header */}
        <View style={styles.searchSection}>
          <View style={styles.searchInputRow}>
            <MaterialIcons name="search" size={18} color={theme.colors.onSurfaceVariant} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, handle (@slug), headline..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search input"
              >
                <MaterialIcons name="close" size={16} color={theme.colors.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </View>

          {/* Program filter chips */}
          {facets.programs.length > 0 && (
            <View style={styles.filterRow}>
              <FilterChip
                label="ALL PROGRAMS"
                selected={!selectedProgram}
                onPress={() => setSelectedProgram(undefined)}
                accessibilityRole="button"
                accessibilityLabel="Filter by all programs"
              />
              {facets.programs.map((prog) => (
                <FilterChip
                  key={prog}
                  label={prog}
                  selected={selectedProgram === prog}
                  onPress={() => setSelectedProgram(selectedProgram === prog ? undefined : prog)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by program ${prog}`}
                />
              ))}
            </View>
          )}
        </View>

        {/* Directory List */}
        {isLoading && !isRefetching ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <MonoLabel>LOADING STUDENT DIRECTORY...</MonoLabel>
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <MaterialIcons name="person-search" size={40} color={theme.colors.onSurfaceVariant} />
                <Title style={{ fontSize: 16 }}>No students found</Title>
                <Body style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                  Try adjusting your search query or removing program filters.
                </Body>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }: { item: PublicStudentCard }) => {
              const initials = item.fullName
                ? item.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : item.slug.slice(0, 2).toUpperCase();

              return (
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/students/${item.slug}` as any)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarBox}>
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <Text style={styles.avatarText}>{initials}</Text>
                      )}
                    </View>
                    <View style={styles.headerTextContainer}>
                      <Text style={styles.nameText}>{item.fullName}</Text>
                      <Text style={styles.handleText}>@{item.slug}</Text>
                      {(item.program || item.batch) && (
                        <View style={styles.academicBadge}>
                          <Text style={styles.academicText}>
                            {[item.program, item.batch ? `Batch ${item.batch}` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {item.headline && <Text style={styles.headlineText}>{item.headline}</Text>}
                  {item.bio && (
                    <Text style={styles.bioText} numberOfLines={2}>
                      {item.bio}
                    </Text>
                  )}

                  {item.skills && item.skills.length > 0 && (
                    <View style={styles.skillsRow}>
                      {item.skills.slice(0, 4).map((sk) => (
                        <View key={sk} style={styles.skillBadge}>
                          <Text style={styles.skillText}>#{sk}</Text>
                        </View>
                      ))}
                      {item.skills.length > 4 && (
                        <View style={styles.skillBadge}>
                          <Text style={styles.skillText}>+{item.skills.length - 4}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={styles.statsRow}>
                      {item.projectsCount > 0 && (
                        <Text style={styles.statText}>⚡ {item.projectsCount} Projects</Text>
                      )}
                      {item.achievementsCount > 0 && (
                        <Text style={styles.statText}>🏆 {item.achievementsCount} Awards</Text>
                      )}
                    </View>
                    <View style={styles.viewBtn}>
                      <Text style={styles.viewBtnText}>DOSSIER</Text>
                      <MaterialIcons name="chevron-right" size={16} color={theme.colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </MobileShell>
  );
}
