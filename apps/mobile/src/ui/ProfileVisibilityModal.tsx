import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Share,
} from 'react-native';
import { useAppTheme } from '../store/theme-store';
import { Title, Body, MonoLabel, Mono, Display } from './core/Typography';
import { ActivityIndicator } from './core/ActivityIndicator';
import {
  useMyStudentProfile,
  useUpdateMyVisibility,
  useCurateItem,
  useChangeHandle,
  SectionVisibility,
} from '../hooks/use-student-profiles';
import { MaterialIcons } from '@expo/vector-icons';

interface ProfileVisibilityModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileVisibilityModal({ visible, onClose }: ProfileVisibilityModalProps) {
  const theme = useAppTheme();
  const { data, isLoading, refetch } = useMyStudentProfile();
  const updateVisibilityMutation = useUpdateMyVisibility();
  const curateMutation = useCurateItem();
  const changeHandleMutation = useChangeHandle();

  const [newHandle, setNewHandle] = useState('');
  const [handleMsg, setHandleMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Local state for instantaneous switch feedback
  const [localVisibility, setLocalVisibility] = useState<SectionVisibility | null>(null);
  const [localDirectoryListed, setLocalDirectoryListed] = useState<boolean | null>(null);

  const profile = data?.profile;
  const serverVisibility: SectionVisibility = useMemo(() => {
    const raw =
      profile?.sectionVisibility ||
      (profile as any)?.section_visibility ||
      ({} as SectionVisibility);
    return {
      identity: raw.identity ?? (raw as any).name ?? true,
      avatar: (raw.avatar ?? (raw as any).avatar_url) ?? true,
      academic: raw.academic ?? true,
      bio: raw.bio ?? false,
      skills: raw.skills ?? false,
      links: (raw.links ?? (raw as any).external_links) ?? false,
      projects: raw.projects ?? false,
      achievements: raw.achievements ?? false,
      clubs: raw.clubs ?? false,
    };
  }, [profile]);

  const serverDirectoryListed =
    profile?.directoryListed ?? (profile as any)?.directory_listed ?? true;

  React.useEffect(() => {
    if (data?.profile) {
      setLocalVisibility(null);
      setLocalDirectoryListed(null);
    }
  }, [data]);

  const visibility = localVisibility || serverVisibility;
  const directoryListed = localDirectoryListed !== null ? localDirectoryListed : serverDirectoryListed;

  const curatedItems = data?.curatedItems || [];
  const projects = data?.availableProjects || [];
  const achievements = data?.availableAchievements || [];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.85)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 2,
          borderTopColor: theme.colors.primary,
          maxHeight: '88%',
          paddingBottom: 24,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: theme.spacing.base,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderHairline,
        },
        content: {
          padding: theme.spacing.base,
        },
        sectionCard: {
          backgroundColor: theme.colors.surfaceContainerLow,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        toggleRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderHairline,
        },
        toggleLabel: {
          fontFamily: theme.typography.monoBold,
          fontSize: 12,
          color: theme.colors.onSurface,
        },
        toggleSub: {
          fontFamily: theme.typography.monoRegular,
          fontSize: 9,
          color: theme.colors.onSurfaceVariant,
          marginTop: 2,
        },
        itemRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.borderHairline,
        },
        actionBtn: {
          backgroundColor: theme.colors.primary,
          paddingHorizontal: 12,
          paddingVertical: 6,
          alignItems: 'center',
        },
        actionBtnText: {
          fontFamily: theme.typography.monoBold,
          fontSize: 10,
          color: theme.colors.onPrimary,
        },
        handleRow: {
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
          marginTop: 6,
        },
        handleInput: {
          flex: 1,
          height: 38,
          borderWidth: 1,
          borderColor: theme.colors.borderHairline,
          backgroundColor: theme.colors.surface,
          fontFamily: theme.typography.monoRegular,
          fontSize: 12,
          color: theme.colors.onSurface,
          paddingHorizontal: 8,
        },
      }),
    [theme]
  );

  const toggleSection = (key: keyof SectionVisibility) => {
    const nextVal = !visibility[key];
    setLocalVisibility({
      ...visibility,
      [key]: nextVal,
    });
    updateVisibilityMutation.mutate(
      {
        section_visibility: {
          [key]: nextVal,
        },
      },
      {
        onError: () => {
          setLocalVisibility(null);
        },
      }
    );
  };

  const toggleDirectoryListed = () => {
    const nextVal = !directoryListed;
    setLocalDirectoryListed(nextVal);
    updateVisibilityMutation.mutate(
      {
        directory_listed: nextVal,
      },
      {
        onError: () => {
          setLocalDirectoryListed(null);
        },
      }
    );
  };

  const getCuration = (type: string, id: string) => {
    return curatedItems.find((c) => c.itemType === type && c.sourceRecordId === id);
  };

  const toggleItemHidden = (type: 'PROJECT' | 'ACHIEVEMENT', id: string) => {
    const cur = getCuration(type, id);
    const willBeHidden = !cur?.hidden;
    curateMutation.mutate({
      item_type: type,
      source_id: id,
      source_record_id: id,
      is_visible: !willBeHidden,
      hidden: willBeHidden,
    });
  };

  const toggleItemFeatured = (id: string) => {
    const cur = getCuration('PROJECT', id);
    const willBeFeatured = !cur?.featured;
    curateMutation.mutate({
      item_type: 'PROJECT',
      source_id: id,
      source_record_id: id,
      is_featured: willBeFeatured,
      featured: willBeFeatured,
    });
  };

  const handleUpdateHandle = async () => {
    if (!newHandle.trim()) return;
    try {
      await changeHandleMutation.mutateAsync(newHandle.trim().toLowerCase());
      setHandleMsg({ text: `Handle updated to @${newHandle.trim().toLowerCase()}!` });
      setNewHandle('');
    } catch (err: any) {
      setHandleMsg({ text: err?.message || 'Failed to update handle', error: true });
    }
  };

  const handleShare = async () => {
    if (!profile?.slug) return;
    try {
      await Share.share({
        message: `My verified NST student profile: https://events.nstsdc.org/students/${profile.slug}`,
      });
    } catch {}
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <MonoLabel style={{ color: theme.colors.primary }}>PORTFOLIO CONTROLS</MonoLabel>
              <Title style={{ fontSize: 16 }}>PROFILE & VISIBILITY SETTINGS</Title>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>

          {isLoading || !profile ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.content}>
              {/* Handle & Share */}
              <View style={styles.sectionCard}>
                <MonoLabel>CANONICAL HANDLE & SHARE</MonoLabel>
                <Text style={{ fontFamily: theme.typography.monoMedium, fontSize: 12, color: theme.colors.primary }}>
                  @{profile.slug}
                </Text>
                <View style={styles.handleRow}>
                  <TextInput
                    style={styles.handleInput}
                    placeholder="new-unique-handle"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={newHandle}
                    onChangeText={setNewHandle}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.actionBtn, { height: 38, justifyContent: 'center' }]}
                    onPress={handleUpdateHandle}
                  >
                    <Text style={styles.actionBtnText}>SAVE</Text>
                  </TouchableOpacity>
                </View>
                {handleMsg && (
                  <Text style={{ fontFamily: theme.typography.monoRegular, fontSize: 10, color: handleMsg.error ? theme.colors.error : theme.colors.success }}>
                    {handleMsg.text}
                  </Text>
                )}

                <TouchableOpacity
                  onPress={handleShare}
                  style={[styles.actionBtn, { backgroundColor: theme.colors.surfaceContainerHighest, marginTop: 6, flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 }]}
                >
                  <MaterialIcons name="share" size={14} color={theme.colors.onSurface} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.onSurface }]}>SHARE PROFILE URL</Text>
                </TouchableOpacity>

                <View style={[styles.toggleRow, { borderBottomWidth: 0, marginTop: 4 }]}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.toggleLabel}>List in Student Directory</Text>
                    <Text style={styles.toggleSub}>Allow profile to appear in /students search</Text>
                  </View>
                  <Switch
                    value={directoryListed}
                    onValueChange={toggleDirectoryListed}
                    trackColor={{ true: theme.colors.primary, false: theme.colors.borderHairline }}
                    thumbColor={directoryListed ? theme.colors.onPrimary : theme.colors.outlineVariant}
                  />
                </View>
              </View>

              {/* Section Visibility */}
              <View style={styles.sectionCard}>
                <MonoLabel>SECTION-LEVEL VISIBILITY</MonoLabel>
                {[
                  { key: 'identity', label: 'Full Display Name', desc: 'If off, @slug is shown instead' },
                  { key: 'avatar', label: 'Profile Photo', desc: 'If off, initials block is shown' },
                  { key: 'academic', label: 'Academic & Batch', desc: 'Program, batch & campus context' },
                  { key: 'bio', label: 'Headline & Biography', desc: 'Technical intro and biography' },
                  { key: 'skills', label: 'Skills & Tags', desc: 'Technical skills list' },
                  { key: 'links', label: 'External Portfolio Links', desc: 'GitHub, LinkedIn, personal URLs' },
                  { key: 'projects', label: 'Selected Projects', desc: 'Published project contributions' },
                  { key: 'achievements', label: 'Competition Honors', desc: 'Official event awards and podiums' },
                  { key: 'clubs', label: 'Clubs & Leadership', desc: 'Verified student club memberships' },
                ].map(({ key, label, desc }) => (
                  <View key={key} style={styles.toggleRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.toggleLabel}>{label}</Text>
                      <Text style={styles.toggleSub}>{desc}</Text>
                    </View>
                    <Switch
                      value={!!visibility[key as keyof SectionVisibility]}
                      onValueChange={() => toggleSection(key as keyof SectionVisibility)}
                      trackColor={{ true: theme.colors.primary, false: theme.colors.borderHairline }}
                      thumbColor={!!visibility[key as keyof SectionVisibility] ? theme.colors.onPrimary : theme.colors.outlineVariant}
                    />
                  </View>
                ))}
              </View>

              {/* Project Curation */}
              {projects.length > 0 && (
                <View style={styles.sectionCard}>
                  <MonoLabel>CURATE SELECTED PROJECTS</MonoLabel>
                  {projects.map((p) => {
                    const cur = getCuration('PROJECT', p.id);
                    const isHidden = cur?.hidden || false;
                    const isFeatured = cur?.featured || false;

                    return (
                      <View key={p.id} style={styles.itemRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.toggleLabel}>{p.title}</Text>
                          <Text style={styles.toggleSub}>
                            {p.role} · {p.category} {isFeatured ? '★ PINNED' : ''}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => toggleItemFeatured(p.id)}
                            style={[styles.actionBtn, { backgroundColor: isFeatured ? theme.colors.warning : theme.colors.surfaceContainerHighest }]}
                          >
                            <Text style={[styles.actionBtnText, { color: isFeatured ? theme.colors.onWarning : theme.colors.onSurface }]}>
                              {isFeatured ? 'UNPIN' : 'PIN'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => toggleItemHidden('PROJECT', p.id)}
                            style={[styles.actionBtn, { backgroundColor: isHidden ? theme.colors.surfaceContainerHighest : theme.colors.primary }]}
                          >
                            <Text style={[styles.actionBtnText, { color: isHidden ? theme.colors.onSurfaceVariant : theme.colors.onPrimary }]}>
                              {isHidden ? 'SHOW' : 'HIDE'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Achievement Curation */}
              {achievements.length > 0 && (
                <View style={styles.sectionCard}>
                  <MonoLabel>CURATE OFFICIAL HONORS</MonoLabel>
                  <Text style={[styles.toggleSub, { marginBottom: 6 }]}>
                    Hiding an award from your profile does NOT change the official results ledger.
                  </Text>
                  {achievements.map((ach) => {
                    const cur = getCuration('ACHIEVEMENT', ach.id);
                    const isHidden = cur?.hidden || false;

                    return (
                      <View key={ach.id} style={styles.itemRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.toggleLabel}>{ach.award_name}</Text>
                          <Text style={styles.toggleSub}>
                            {ach.event.title} · Rank #{ach.placement || 'Award'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => toggleItemHidden('ACHIEVEMENT', ach.id)}
                          style={[styles.actionBtn, { backgroundColor: isHidden ? theme.colors.surfaceContainerHighest : theme.colors.primary }]}
                        >
                          <Text style={[styles.actionBtnText, { color: isHidden ? theme.colors.onSurfaceVariant : theme.colors.onPrimary }]}>
                            {isHidden ? 'SHOW' : 'HIDE'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
