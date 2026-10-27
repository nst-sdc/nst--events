import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Share,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '../../../src/store/theme-store';
import { MobileShell } from '../../../src/ui/core/MobileShell';
import { Title, Body, MonoLabel, Mono, Display } from '../../../src/ui/core/Typography';
import { ActivityIndicator } from '../../../src/ui/core/ActivityIndicator';
import { usePublicStudentProfile } from '../../../src/hooks/use-student-profiles';
import { MaterialIcons } from '@expo/vector-icons';

export default function PublicStudentProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const theme = useAppTheme();

  const { data: student, isLoading, isError, error, refetch } = usePublicStudentProfile(slug || '');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.surface,
        },
        dossierCard: {
          margin: theme.spacing.base,
          padding: theme.spacing.base,
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 2,
          borderColor: theme.colors.primary,
          gap: theme.spacing.md,
        },
        headerRow: {
          flexDirection: 'row',
          gap: theme.spacing.md,
          alignItems: 'center',
        },
        avatarBox: {
          width: 64,
          height: 64,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: theme.colors.onSurface,
          overflow: 'hidden',
        },
        avatarText: {
          fontFamily: theme.typography.syneBold,
          fontSize: 24,
          color: theme.colors.onPrimary,
        },
        nameBlock: {
          flex: 1,
        },
        nameText: {
          fontFamily: theme.typography.syneBold,
          fontSize: 20,
          color: theme.colors.onSurface,
        },
        handleText: {
          fontFamily: theme.typography.monoMedium,
          fontSize: 13,
          color: theme.colors.primary,
          marginTop: 2,
        },
        badgeRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 6,
        },
        badge: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        badgeText: {
          fontFamily: theme.typography.monoRegular,
          fontSize: 10,
          color: theme.colors.onSurfaceVariant,
          textTransform: 'uppercase',
        },
        headlineText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 13,
          color: theme.colors.secondary,
          lineHeight: 18,
        },
        bioText: {
          fontFamily: theme.typography.interRegular,
          fontSize: 14,
          color: theme.colors.onSurface,
          lineHeight: 20,
        },
        shareRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderHairline,
          paddingTop: theme.spacing.sm,
        },
        shareBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          paddingHorizontal: 12,
          paddingVertical: 6,
        },
        shareBtnText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 11,
          color: theme.colors.onSurface,
        },
        sectionBox: {
          marginHorizontal: theme.spacing.base,
          marginBottom: theme.spacing.base,
          padding: theme.spacing.base,
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          gap: theme.spacing.sm,
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderHairline,
          paddingBottom: 6,
          marginBottom: 4,
        },
        sectionTitle: {
          fontFamily: theme.typography.syneBold,
          fontSize: 15,
          color: theme.colors.onSurface,
          textTransform: 'uppercase',
        },
        itemCard: {
          padding: theme.spacing.sm,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          gap: 4,
          marginBottom: 8,
        },
        itemTitle: {
          fontFamily: theme.typography.syneBold,
          fontSize: 14,
          color: theme.colors.onSurface,
        },
        itemSub: {
          fontFamily: theme.typography.monoRegular,
          fontSize: 11,
          color: theme.colors.onSurfaceVariant,
        },
        rankBadge: {
          backgroundColor: theme.colors.warning,
          paddingHorizontal: 6,
          paddingVertical: 2,
          alignSelf: 'flex-start',
          marginBottom: 4,
        },
        rankText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 9,
          color: theme.colors.onWarning,
          textTransform: 'uppercase',
        },
        minimalBox: {
          margin: theme.spacing.base,
          padding: 24,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.colors.borderHairline,
          gap: 8,
        },
        errorBox: {
          margin: theme.spacing.base,
          padding: 24,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        },
      }),
    [theme]
  );

  const handleShare = async () => {
    if (!student?.slug) return;
    const displayName = student.fullName || `@${student.slug}`;
    try {
      await Share.share({
        message: `Check out ${displayName}'s verified student portfolio at Newton School of Technology: https://events.nstsdc.org/students/${student.slug}`,
      });
    } catch {}
  };

  const openUrl = (url?: string) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      Linking.openURL(url).catch(() => {});
    }
  };

  const handleBackToDirectory = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/students');
    }
  };

  React.useEffect(() => {
    if (student?.redirect && student.canonical_slug) {
      router.replace(`/students/${student.canonical_slug}` as any);
    }
  }, [student, router]);

  if (isLoading) {
    return (
      <MobileShell title="STUDENT PROFILE" showBackButton={true} onBackPress={handleBackToDirectory} scrollable={false}>
        <View style={styles.errorBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel>LOADING VERIFIED DOSSIER...</MonoLabel>
        </View>
      </MobileShell>
    );
  }

  if (student?.redirect && student.canonical_slug) {
    return (
      <MobileShell title="REDIRECTING..." showBackButton={true} onBackPress={handleBackToDirectory} scrollable={false}>
        <View style={styles.errorBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <MonoLabel>REDIRECTING TO @{student.canonical_slug}...</MonoLabel>
        </View>
      </MobileShell>
    );
  }

  if (isError || !student) {
    return (
      <MobileShell title="STUDENT PROFILE" showBackButton={true} onBackPress={handleBackToDirectory} scrollable={false}>
        <View style={styles.errorBox}>
          <MaterialIcons name="person-off" size={48} color={theme.colors.error} />
          <Title>Profile Not Found</Title>
          <Body style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant, fontSize: 13 }}>
            This student profile does not exist or may have been unlisted.
          </Body>
          <TouchableOpacity onPress={handleBackToDirectory} style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>RETURN TO DIRECTORY</Text>
          </TouchableOpacity>
        </View>
      </MobileShell>
    );
  }

  const displayName = student.fullName || `@${student.slug}`;
  const initials = (student.fullName
    ? student.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
    : student.slug
  ).slice(0, 2).toUpperCase();

  return (
    <MobileShell
      title={`@${student.slug}`}
      showBackButton={true}
      onBackPress={handleBackToDirectory}
      scrollable={false}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header Dossier */}
        <View style={styles.dossierCard}>
          <View style={styles.headerRow}>
            <View style={styles.avatarBox}>
              {student.avatarUrl ? (
                <Image source={{ uri: student.avatarUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
            <View style={styles.nameBlock}>
              <Text style={styles.nameText}>{displayName}</Text>
              <Text style={styles.handleText}>@{student.slug}</Text>

              <View style={styles.badgeRow}>
                {student.program && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>🎓 {student.program}</Text>
                  </View>
                )}
                {student.batch && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>📅 Batch {student.batch}</Text>
                  </View>
                )}
                {student.campus && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>🏛 {student.campus}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {student.headline && <Text style={styles.headlineText}>{student.headline}</Text>}
          {student.bio && <Text style={styles.bioText}>{student.bio}</Text>}

          {/* Links & Share Tray */}
          <View style={styles.shareRow}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {student.externalLinks?.github && (
                <TouchableOpacity
                  onPress={() => openUrl(student.externalLinks.github)}
                  style={styles.shareBtn}
                >
                  <Text style={styles.shareBtnText}>GITHUB ↗</Text>
                </TouchableOpacity>
              )}
              {student.externalLinks?.linkedin && (
                <TouchableOpacity
                  onPress={() => openUrl(student.externalLinks.linkedin)}
                  style={styles.shareBtn}
                >
                  <Text style={styles.shareBtnText}>LINKEDIN ↗</Text>
                </TouchableOpacity>
              )}
              {student.externalLinks?.portfolio && (
                <TouchableOpacity
                  onPress={() => openUrl(student.externalLinks.portfolio)}
                  style={styles.shareBtn}
                >
                  <Text style={styles.shareBtnText}>PORTFOLIO ↗</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
              <MaterialIcons name="share" size={14} color={theme.colors.onSurface} />
              <Text style={styles.shareBtnText}>SHARE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Skills Section */}
        {student.skills && student.skills.length > 0 && (
          <View style={styles.sectionBox}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>SKILLS & SPECIALIZATIONS</Text>
              <MonoLabel>{student.skills.length} TAGS</MonoLabel>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {student.skills.map((s) => (
                <View key={s} style={[styles.badge, { borderColor: theme.colors.primary }]}>
                  <Text style={[styles.badgeText, { color: theme.colors.primary }]}>#{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Selected Projects */}
        {student.projects && student.projects.length > 0 && (
          <View style={styles.sectionBox}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>SELECTED PROJECTS</Text>
              <MonoLabel>{student.projects.length} PROJECTS</MonoLabel>
            </View>
            {student.projects.map((p) => (
              <View key={p.id} style={styles.itemCard}>
                {p.featured && (
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>★ PINNED WORK</Text>
                  </View>
                )}
                <Text style={styles.itemTitle}>{p.title}</Text>
                <Text style={styles.itemSub}>{p.tagline}</Text>
                <Text style={[styles.itemSub, { color: theme.colors.primary, marginTop: 4 }]}>
                  {p.role} · {p.category}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Official Honors & Achievements */}
        {student.achievements && student.achievements.length > 0 && (
          <View style={styles.sectionBox}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>OFFICIAL COMPETITION HONORS</Text>
              <MonoLabel style={{ color: theme.colors.success }}>[VERIFIED RECORD]</MonoLabel>
            </View>
            {student.achievements.map((ach) => (
              <View key={ach.id} style={[styles.itemCard, { borderLeftWidth: 3, borderLeftColor: theme.colors.podiumGold }]}>
                {ach.placement && (
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{ach.placement.toUpperCase()} PLACE</Text>
                  </View>
                )}
                <Text style={styles.itemTitle}>{ach.award_name}</Text>
                <Text style={styles.itemSub}>
                  {ach.event.title} · {new Date(ach.awarded_at).getFullYear()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Clubs & Leadership */}
        {student.clubs && student.clubs.length > 0 && (
          <View style={styles.sectionBox}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>CLUBS & LEADERSHIP</Text>
              <MonoLabel style={{ color: theme.colors.primary }}>[VERIFIED]</MonoLabel>
            </View>
            {student.clubs.map((c) => (
              <View key={c.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{c.club_name}</Text>
                <Text style={[styles.itemSub, { color: theme.colors.primary }]}>
                  {c.role.replace('_', ' ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Minimal Profile State */}
        {student.isMinimal && (
          <View style={styles.minimalBox}>
            <MaterialIcons name="security" size={28} color={theme.colors.primary} />
            <Title style={{ fontSize: 14 }}>Verified NST Student Identity</Title>
            <Body style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
              Portfolio sections are hidden according to student privacy preferences.
            </Body>
          </View>
        )}
      </ScrollView>
    </MobileShell>
  );
}
