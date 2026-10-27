import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Share,
  Linking,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../../../src/store/theme-store';
import { MobileShell } from '../../../../src/ui/core/MobileShell';
import { Title, Display, Body, MonoLabel, Mono } from '../../../../src/ui/core/Typography';
import { StatusBadge } from '../../../../src/ui/core/StatusBadge';
import { Button } from '../../../../src/ui/Button';
import { ActivityIndicator } from '../../../../src/ui/core/ActivityIndicator';
import {
  useEventResults,
  FormattedAward,
  AwardRecipientData,
} from '../../../../src/hooks/use-event-results';
import { ResultReportModal } from '../../../../src/ui/ResultReportModal';
import { openProjectShowcase } from '../../../../src/lib/project-showcase';

export default function MobileEventResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();

  const [showReportModal, setShowReportModal] = useState(false);

  const {
    data: resultsResponse,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useEventResults(id as string);

  const event = resultsResponse?.event;
  const results = resultsResponse?.results;
  const status = resultsResponse?.status;

  const handleShare = async () => {
    if (!event?.slug) return;
    try {
      const shareUrl = `https://events.nstsdc.org/event/${event.slug}/results`;
      await Share.share({
        title: `${event.title} - Official Results`,
        message: `Check out the official results for ${event.title} on NST Events: ${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      // Ignored
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: theme.spacing.base,
      gap: theme.spacing.lg,
    },
    loadingBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
      gap: 12,
    },
    errorBox: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.error,
      padding: theme.spacing.lg,
      alignItems: 'center',
      gap: 12,
    },
    restrictedBox: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: theme.spacing.lg,
      gap: 12,
      alignItems: 'center',
    },
    headerCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: theme.spacing.base,
      gap: 8,
    },
    eventMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    eventTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      color: theme.colors.onSurface,
    },
    correctionBanner: {
      backgroundColor: theme.colors.warningContainer,
      borderWidth: 1,
      borderColor: theme.colors.warning,
      padding: 10,
      gap: 4,
    },
    correctionTitle: {
      color: theme.colors.warning,
      fontSize: 10,
    },
    correctionText: {
      color: theme.colors.onSurface,
      fontSize: 11,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    sectionCard: {
      gap: theme.spacing.md,
    },
    sectionHeading: {
      color: theme.colors.primary,
      fontSize: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      paddingBottom: 4,
    },
    podiumCard: {
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderWidth: 2,
      padding: theme.spacing.base,
      gap: 10,
    },
    goldPodium: {
      borderColor: theme.colors.podiumGold,
    },
    silverPodium: {
      borderColor: theme.colors.podiumSilver,
    },
    bronzePodium: {
      borderColor: theme.colors.podiumBronze,
    },
    standardPodium: {
      borderColor: theme.colors.outlineVariant,
    },
    awardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rankBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    awardTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      color: theme.colors.onSurface,
    },
    recipientBox: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      padding: 10,
      gap: 6,
    },
    recipientNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 6,
    },
    recipientName: {
      fontSize: 13,
      fontWeight: 'bold',
      color: theme.colors.onSurface,
      textTransform: 'uppercase',
    },
    recipientTypeBadge: {
      fontSize: 9,
    },
    membersBox: {
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
      gap: 4,
    },
    memberRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    memberName: {
      fontSize: 11,
      color: theme.colors.onSurface,
    },
    memberRole: {
      fontSize: 10,
      color: theme.colors.outline,
    },
    projectLinkBox: {
      marginTop: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: 8,
      minHeight: 48,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    projectLinkText: {
      fontSize: 11,
      color: theme.colors.primary,
      fontFamily: theme.typography.monoBold,
    },
    footerNotes: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
      gap: 8,
      alignItems: 'center',
    },
    noticeText: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
  }), [theme]);

  const renderAwardCard = (award: FormattedAward, isPodium = false) => {
    let podiumStyle = styles.standardPodium;
    let rankBadgeText = `#${award.placement || '-'}`;

    if (award.placement === 1) {
      podiumStyle = styles.goldPodium;
      rankBadgeText = '🥇 1ST PLACE';
    } else if (award.placement === 2) {
      podiumStyle = styles.silverPodium;
      rankBadgeText = '🥈 2ND PLACE';
    } else if (award.placement === 3) {
      podiumStyle = styles.bronzePodium;
      rankBadgeText = '🥉 3RD PLACE';
    }

    if (award.is_tied) {
      rankBadgeText = `${rankBadgeText} (TIE)`;
    }

    return (
      <View
        key={award.id || award.title}
        style={[styles.podiumCard, isPodium ? podiumStyle : styles.standardPodium]}
      >
        <View style={styles.awardHeader}>
          <MonoLabel style={{ color: theme.colors.primary, fontSize: 11 }}>
            {rankBadgeText}
          </MonoLabel>
          <MonoLabel style={{ color: theme.colors.outline, fontSize: 9 }}>
            {award.award_type.replace(/_/g, ' ')}
          </MonoLabel>
        </View>

        <Title style={styles.awardTitle}>{award.title}</Title>
        {award.description && (
          <Body style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>
            {award.description}
          </Body>
        )}

        <View style={{ gap: 8, marginTop: 4 }}>
          {award.recipients.map((rec: AwardRecipientData, rIdx: number) => {
            const isIndividual = rec.recipient_type === 'INDIVIDUAL';
            const isTeam = rec.recipient_type === 'TEAM';
            const isExternal = rec.recipient_type === 'EXTERNAL';

            const displayName = isIndividual
              ? rec.student?.name || 'VERIFIED STUDENT'
              : isTeam
              ? rec.team?.name || 'STUDENT TEAM'
              : rec.external?.name || 'EXTERNAL RECIPIENT';

            return (
              <View key={rec.id || `rec-${rIdx}`} style={styles.recipientBox}>
                <View style={styles.recipientNameRow}>
                  <Body style={styles.recipientName}>{displayName}</Body>
                  <MonoLabel style={styles.recipientTypeBadge}>
                    {isIndividual && '[VERIFIED STUDENT]'}
                    {isTeam && '[REGISTERED TEAM]'}
                    {isExternal && '[EXTERNAL / GUEST]'}
                  </MonoLabel>
                </View>

                {isIndividual && (rec.student?.program || rec.student?.batch) && (
                  <Mono style={{ fontSize: 10, color: theme.colors.outline }}>
                    {[rec.student?.program, rec.student?.batch ? `Batch ${rec.student?.batch}` : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </Mono>
                )}

                {isTeam && rec.members && rec.members.length > 0 && (
                  <View style={styles.membersBox}>
                    <MonoLabel style={{ fontSize: 9, color: theme.colors.outline }}>
                      RECOGNIZED TEAM MEMBERS:
                    </MonoLabel>
                    {rec.members.map((m, mIdx) => (
                      <View key={m.id || `m-${mIdx}`} style={styles.memberRow}>
                        <Body style={styles.memberName}>• {m.name}</Body>
                        <Mono style={styles.memberRole}>
                          {m.team_role || (m.is_authorized_exception ? '[SUBSTITUTE]' : '')}
                        </Mono>
                      </View>
                    ))}
                  </View>
                )}

                {isExternal && rec.external?.details && (
                  <Body style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>
                    {rec.external.details}
                  </Body>
                )}
              </View>
            );
          })}
        </View>

        {award.project_links && award.project_links.length > 0 && (
          <View style={{ gap: 6, marginTop: 6 }}>
            {award.project_links.map((pl, pIdx) => {
              const hasProject = pl.type === 'NST_PROJECT' && pl.project;
              const linkTitle = hasProject
                ? pl.project?.title
                : pl.title_snapshot || pl.external_url || 'Project Link';

              return (
                <TouchableOpacity
                  key={pl.id || `pl-${pIdx}`}
                  style={styles.projectLinkBox}
                  onPress={() => {
                    if (pl.external_url) {
                      Linking.openURL(pl.external_url).catch(() => {});
                    } else if (hasProject) {
                      openProjectShowcase(pl.project?.slug);
                    }
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <MonoLabel style={{ fontSize: 9, color: theme.colors.outline }}>
                      {hasProject ? 'NST SHOWCASE PROJECT' : 'EXTERNAL SUBMISSION'}
                    </MonoLabel>
                    <Mono style={styles.projectLinkText} numberOfLines={1}>
                      {linkTitle} ↗
                    </Mono>
                  </View>
                  <MaterialIcons name="open-in-new" size={16} color={theme.colors.primary} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const handleReturnToEvent = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/(app)/events/${id}`);
    }
  };

  return (
    <MobileShell
      title="RESULTS & WINNERS"
      showBackButton
      onBackPress={handleReturnToEvent}
      scrollable={false}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <MonoLabel>LOADING OFFICIAL RESULTS...</MonoLabel>
          </View>
        ) : isError || !resultsResponse ? (
          <View style={styles.errorBox}>
            <StatusBadge status="[ERROR]" type="error" />
            <Display style={{ fontSize: 16 }}>FAILED TO LOAD RESULTS</Display>
            <Body style={styles.noticeText}>
              {(error as any)?.message || 'Unable to connect to results service.'}
            </Body>
            <Button title="[ RETRY ]" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : status === 'UNAUTHENTICATED_RESTRICTED' ? (
          <View style={styles.restrictedBox}>
            <MaterialIcons name="lock" size={32} color={theme.colors.outline} />
            <Display style={{ fontSize: 16 }}>RESTRICTED EVENT</Display>
            <Body style={styles.noticeText}>
              These results are restricted to verified institutional members. Please ensure you are logged into your institutional account.
            </Body>
            <Button
              title="[ RETURN TO EVENT ]"
              variant="secondary"
              onPress={handleReturnToEvent}
            />
          </View>
        ) : status === 'WITHDRAWN' ? (
          <View style={styles.restrictedBox}>
            <StatusBadge status="[WITHDRAWN]" type="default" />
            <Display style={{ fontSize: 16 }}>RESULTS WITHDRAWN</Display>
            <Body style={styles.noticeText}>
              The official results for this event have been withdrawn by organizers for administrative review.
            </Body>
            <Button
              title="[ RETURN TO EVENT ]"
              variant="secondary"
              onPress={handleReturnToEvent}
            />
          </View>
        ) : (!results || status !== 'PUBLISHED') ? (
          <View style={styles.restrictedBox}>
            <StatusBadge status="[PENDING]" type="info" />
            <Display style={{ fontSize: 16 }}>RESULTS PENDING</Display>
            <Body style={styles.noticeText}>
              Official results for this event have not been published yet. Please check back after organizers conclude judging and certification.
            </Body>
            <Button
              title="[ RETURN TO EVENT ]"
              variant="secondary"
              onPress={handleReturnToEvent}
            />
          </View>
        ) : (
          <>
            {/* Header info */}
            <View style={styles.headerCard}>
              <View style={styles.eventMetaRow}>
                <MonoLabel style={{ color: theme.colors.primary }}>
                  OFFICIAL INSTITUTIONAL RECORD
                </MonoLabel>
                <Mono style={{ fontSize: 10, color: theme.colors.outline }}>
                  REV #{results.revision_number}
                </Mono>
              </View>

              <Title style={styles.eventTitle}>{event?.title}</Title>
              <Mono style={{ fontSize: 11, color: theme.colors.outline }}>
                Published: {new Date(results.published_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Mono>

              {results.is_correction && results.correction_reason && (
                <View style={styles.correctionBanner}>
                  <MonoLabel style={styles.correctionTitle}>[OFFICIAL CORRECTION APPLIED]</MonoLabel>
                  <Body style={styles.correctionText}>{results.correction_reason}</Body>
                </View>
              )}

              <View style={styles.actionsRow}>
                <Button
                  title="[ SHARE RESULTS ↗ ]"
                  variant="secondary"
                  onPress={handleShare}
                  style={{ flex: 1, minHeight: 48, height: 48 }}
                />
                <Button
                  title="[ REPORT INACCURACY ]"
                  variant="secondary"
                  onPress={() => setShowReportModal(true)}
                  style={{ flex: 1, minHeight: 48, height: 48 }}
                />
              </View>
            </View>

            {/* Podium Section */}
            {results.podium && results.podium.length > 0 && (
              <View style={styles.sectionCard}>
                <MonoLabel style={styles.sectionHeading}>PODIUM PLACEMENTS</MonoLabel>
                {results.podium.map((award) => renderAwardCard(award, true))}
              </View>
            )}

            {/* Additional Ranked Section */}
            {results.additional_ranked && results.additional_ranked.length > 0 && (
              <View style={styles.sectionCard}>
                <MonoLabel style={styles.sectionHeading}>ADDITIONAL RANKED PLACEMENTS</MonoLabel>
                {results.additional_ranked.map((award) => renderAwardCard(award, false))}
              </View>
            )}

            {/* Special Awards */}
            {results.special_awards && results.special_awards.length > 0 && (
              <View style={styles.sectionCard}>
                <MonoLabel style={styles.sectionHeading}>SPECIAL AWARDS & HONORS</MonoLabel>
                {results.special_awards.map((award) => renderAwardCard(award, false))}
              </View>
            )}

            {/* Inaccuracy / Dispute Footer Note */}
            <View style={styles.footerNotes}>
              <Body style={styles.noticeText}>
                Results are certified by event organizers and verified on the NST institutional ledger.
              </Body>
              <TouchableOpacity
                onPress={() => setShowReportModal(true)}
                style={{ minHeight: 48, justifyContent: 'center' }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Mono style={{ fontSize: 11, color: theme.colors.primary, textDecorationLine: 'underline' }}>
                  Report a discrepancy or missing member attribution
                </Mono>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {event && (
        <ResultReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          eventId={event.id || (id as string)}
          eventTitle={event.title || 'Event'}
        />
      )}
    </MobileShell>
  );
}
