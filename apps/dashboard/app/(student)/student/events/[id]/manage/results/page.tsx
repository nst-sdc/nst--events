'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  Trophy,
  Plus,
  Trash2,
  Save,
  Send,
  AlertTriangle,
  CheckCircle2,
  Users,
  User,
  Globe,
  ExternalLink,
  RotateCcw,
  Search,
  X,
  FileEdit
} from 'lucide-react';
import {
  eventResultsApi,
  OrganizerWorkspaceResponse,
  EligibleParticipant,
  EligibleTeam,
  EligibleTeamMember,
  AwardType,
  RecipientType,
  TieRankingType
} from '@/lib/event-results-api';

interface EditingMember {
  id?: string;
  user_id: string;
  registration_id: string;
  name: string;
  avatar_url?: string | null;
  roll_number?: string | null;
  team_role?: string | null;
  is_authorized_exception?: boolean;
  confirmed?: boolean;
}

interface EditingRecipient {
  id?: string;
  recipient_type: RecipientType;
  user_id?: string | null;
  registration_id?: string | null;
  team_id?: string | null;
  external_name?: string | null;
  external_details?: string | null;
  student?: {
    id: string;
    name: string;
    avatar_url?: string | null;
    roll_number?: string | null;
    program?: string | null;
    batch?: string | null;
  };
  team?: {
    id: string;
    name: string;
  };
  members?: EditingMember[];
}

interface EditingProjectLink {
  project_id?: string | null;
  external_project_url?: string | null;
  project_title_snapshot?: string | null;
}

interface EditingAward {
  id?: string;
  title: string;
  award_type: AwardType;
  placement?: number | null;
  description?: string;
  display_order: number;
  is_tied: boolean;
  tie_ranking_type: TieRankingType;
  recipients: EditingRecipient[];
  project_links: EditingProjectLink[];
}

interface RawMember {
  id?: string;
  userId: string;
  registrationId: string;
  displayNameSnapshot: string;
  avatarUrlSnapshot?: string | null;
  rollNumberSnapshot?: string | null;
  teamRoleSnapshot?: string | null;
  isAuthorizedException?: boolean;
}

interface RawRecipient {
  id?: string;
  recipientType: RecipientType;
  userId?: string | null;
  user?: {
    id: string;
    fullName?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
    academicProfile?: {
      batch?: {
        graduationYear?: number | null;
        program?: {
          code?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
  registrationId?: string | null;
  teamId?: string | null;
  team?: {
    id: string;
    name: string;
  } | null;
  externalName?: string | null;
  externalDetails?: string | null;
  members?: RawMember[];
}

interface RawProjectLink {
  projectId?: string | null;
  externalProjectUrl?: string | null;
  projectTitleSnapshot?: string | null;
}

interface RawAward {
  id?: string;
  title?: string;
  awardType?: AwardType;
  placement?: number | null;
  description?: string;
  displayOrder?: number;
  isTied?: boolean;
  tieRankingType?: TieRankingType;
  recipients?: RawRecipient[];
  projectLinks?: RawProjectLink[];
}

interface RawRevision {
  id: string;
  revisionNumber: number;
  version: number;
  awards?: RawAward[];
}

function mapRevisionToAwards(workingRevision: RawRevision | null | undefined): EditingAward[] {
  if (!workingRevision) {
    return [
      {
        title: '1st Place Winner',
        award_type: 'RANKED_PLACEMENT',
        placement: 1,
        description: 'Winner of the competition',
        display_order: 1,
        is_tied: false,
        tie_ranking_type: 'COMPETITION',
        recipients: [],
        project_links: []
      },
      {
        title: '2nd Place Runner-Up',
        award_type: 'RANKED_PLACEMENT',
        placement: 2,
        description: 'Second place',
        display_order: 2,
        is_tied: false,
        tie_ranking_type: 'COMPETITION',
        recipients: [],
        project_links: []
      },
      {
        title: '3rd Place',
        award_type: 'RANKED_PLACEMENT',
        placement: 3,
        description: 'Third place',
        display_order: 3,
        is_tied: false,
        tie_ranking_type: 'COMPETITION',
        recipients: [],
        project_links: []
      }
    ];
  }

  return (workingRevision.awards || []).map((award: RawAward, idx: number) => ({
    id: award.id,
    title: award.title || '',
    award_type: award.awardType || 'RANKED_PLACEMENT',
    placement: award.placement ?? (idx + 1),
    description: award.description || '',
    display_order: award.displayOrder ?? idx,
    is_tied: Boolean(award.isTied),
    tie_ranking_type: award.tieRankingType || 'COMPETITION',
    recipients: (award.recipients || []).map((rec: RawRecipient) => ({
      id: rec.id,
      recipient_type: rec.recipientType,
      user_id: rec.userId || rec.user?.id,
      registration_id: rec.registrationId,
      team_id: rec.teamId || rec.team?.id,
      external_name: rec.externalName || '',
      external_details: rec.externalDetails || '',
      student: rec.user ? {
        id: rec.user.id,
        name: rec.user.fullName || 'Student',
        avatar_url: rec.user.avatarUrl,
        roll_number: rec.user.email ? rec.user.email.split('@')[0] : null,
        program: rec.user.academicProfile?.batch?.program?.code,
        batch: rec.user.academicProfile?.batch?.graduationYear ? String(rec.user.academicProfile.batch.graduationYear) : null
      } : undefined,
      team: rec.team ? {
        id: rec.team.id,
        name: rec.team.name
      } : undefined,
      members: (rec.members || []).map((m: RawMember) => ({
        id: m.id,
        user_id: m.userId,
        registration_id: m.registrationId,
        name: m.displayNameSnapshot,
        avatar_url: m.avatarUrlSnapshot,
        roll_number: m.rollNumberSnapshot,
        team_role: m.teamRoleSnapshot || 'MEMBER',
        is_authorized_exception: m.isAuthorizedException,
        confirmed: true
      }))
    })),
    project_links: (award.projectLinks || []).map((pl: RawProjectLink) => ({
      project_id: pl.projectId,
      external_project_url: pl.externalProjectUrl,
      project_title_snapshot: pl.projectTitleSnapshot
    }))
  }));
}

export default function EventResultsManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<OrganizerWorkspaceResponse | null>(null);
  const [awards, setAwards] = useState<EditingAward[]>([]);
  const [version, setVersion] = useState(1);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [revisionNumber, setRevisionNumber] = useState(1);
  const [isPublished, setIsPublished] = useState(false);
  const [isWithdrawn, setIsWithdrawn] = useState(false);

  // Modals & Action States
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [notifyWinners, setNotifyWinners] = useState(true);
  const [announceParticipants, setAnnounceParticipants] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreReason, setRestoreReason] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Participant & Team search caches
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantResults, setParticipantResults] = useState<EligibleParticipant[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamResults, setTeamResults] = useState<EligibleTeam[]>([]);
  const [activePickerAwardIndex, setActivePickerAwardIndex] = useState<number | null>(null);
  const [pickerType, setPickerType] = useState<RecipientType | null>(null);

  const applyWorkspaceData = useCallback((data: OrganizerWorkspaceResponse) => {
    setWorkspace(data);
    setIsPublished(data.result_set.status === 'PUBLISHED');
    setIsWithdrawn(data.result_set.status === 'WITHDRAWN');

    const workingRevision = (data.draft || data.active_published) as RawRevision | null | undefined;
    if (workingRevision) {
      setRevisionId(workingRevision.id);
      setRevisionNumber(workingRevision.revisionNumber);
      setVersion(workingRevision.version);
    }
    setAwards(mapRevisionToAwards(workingRevision));
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      const data = await eventResultsApi.getOrganizerWorkspace(eventId);
      applyWorkspaceData(data);
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load workspace' });
    } finally {
      setLoading(false);
    }
  }, [eventId, applyWorkspaceData]);

  useEffect(() => {
    void eventResultsApi
      .getOrganizerWorkspace(eventId)
      .then((data) => {
        applyWorkspaceData(data);
      })
      .catch((err: unknown) => {
        setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load workspace' });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [eventId, applyWorkspaceData]);

  // Searches
  useEffect(() => {
    if (pickerType === 'INDIVIDUAL' && activePickerAwardIndex !== null) {
      const timer = setTimeout(async () => {
        try {
          const res = await eventResultsApi.getEligibleParticipants(eventId, participantSearch);
          setParticipantResults(res.participants);
        } catch {}
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [participantSearch, pickerType, activePickerAwardIndex, eventId]);

  useEffect(() => {
    if (pickerType === 'TEAM' && activePickerAwardIndex !== null) {
      const timer = setTimeout(async () => {
        try {
          const res = await eventResultsApi.getEligibleTeams(eventId, teamSearch);
          setTeamResults(res.teams);
        } catch {}
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [teamSearch, pickerType, activePickerAwardIndex, eventId]);

  // Actions
  const handleAddAward = () => {
    const nextOrder = awards.length + 1;
    setAwards([
      ...awards,
      {
        title: `Award #${nextOrder}`,
        award_type: 'SPECIAL_AWARD',
        placement: null,
        description: '',
        display_order: nextOrder,
        is_tied: false,
        tie_ranking_type: 'COMPETITION',
        recipients: [],
        project_links: []
      }
    ]);
  };

  const handleRemoveAward = (index: number) => {
    setAwards(awards.filter((_, i) => i !== index));
  };

  const handleUpdateAward = (index: number, updates: Partial<EditingAward>) => {
    setAwards(awards.map((a, i) => i === index ? { ...a, ...updates } : a));
  };

  const handleAddIndividualRecipient = (awardIndex: number, student: EligibleParticipant) => {
    const currentAward = awards[awardIndex];
    if (currentAward.recipients.some((r: EditingRecipient) => r.user_id === student.user_id)) {
      setStatusMessage({ type: 'error', text: 'Student already added to this award' });
      return;
    }

    const newRecipient: EditingRecipient = {
      recipient_type: 'INDIVIDUAL',
      user_id: student.user_id,
      registration_id: student.registration_id,
      student: {
        id: student.user_id,
        name: student.full_name,
        avatar_url: student.avatar_url,
        roll_number: student.roll_number,
        program: student.program,
        batch: student.batch
      }
    };

    handleUpdateAward(awardIndex, {
      recipients: [...currentAward.recipients, newRecipient]
    });
    setActivePickerAwardIndex(null);
    setPickerType(null);
    setParticipantSearch('');
  };

  const handleAddTeamRecipient = (awardIndex: number, team: EligibleTeam) => {
    const currentAward = awards[awardIndex];
    if (currentAward.recipients.some((r: EditingRecipient) => r.team_id === team.team_id)) {
      setStatusMessage({ type: 'error', text: 'Team already added to this award' });
      return;
    }

    const newRecipient: EditingRecipient = {
      recipient_type: 'TEAM',
      team_id: team.team_id,
      team: {
        id: team.team_id,
        name: team.name
      },
      members: team.members.map((m: EligibleTeamMember) => ({
        user_id: m.user_id,
        registration_id: m.registration_id,
        name: m.full_name,
        avatar_url: m.avatar_url,
        roll_number: m.roll_number,
        team_role: 'MEMBER',
        confirmed: true
      }))
    };

    handleUpdateAward(awardIndex, {
      recipients: [...currentAward.recipients, newRecipient]
    });
    setActivePickerAwardIndex(null);
    setPickerType(null);
    setTeamSearch('');
  };

  const handleAddExternalRecipient = (awardIndex: number) => {
    const currentAward = awards[awardIndex];
    const newRecipient: EditingRecipient = {
      recipient_type: 'EXTERNAL',
      external_name: 'External Winner',
      external_details: 'Guest or Visiting Participant'
    };

    handleUpdateAward(awardIndex, {
      recipients: [...currentAward.recipients, newRecipient]
    });
  };

  const handleRemoveRecipient = (awardIndex: number, recipientIndex: number) => {
    const currentAward = awards[awardIndex];
    handleUpdateAward(awardIndex, {
      recipients: currentAward.recipients.filter((_: EditingRecipient, i: number) => i !== recipientIndex)
    });
  };

  const handleToggleMemberConfirmed = (awardIndex: number, recipientIndex: number, memberIndex: number) => {
    const currentAward = awards[awardIndex];
    const recipients = [...currentAward.recipients];
    const targetRecipient = { ...recipients[recipientIndex] };
    const members = [...(targetRecipient.members || [])];
    members[memberIndex] = {
      ...members[memberIndex],
      confirmed: !members[memberIndex].confirmed
    };
    targetRecipient.members = members;
    recipients[recipientIndex] = targetRecipient;
    handleUpdateAward(awardIndex, { recipients });
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setStatusMessage(null);

      // Sanitize payload for backend validation
      const payloadAwards = awards.map((award, i) => ({
        title: award.title,
        award_type: award.award_type,
        placement: award.award_type === 'RANKED_PLACEMENT' ? Number(award.placement) || (i + 1) : null,
        description: award.description || null,
        display_order: i + 1,
        is_tied: Boolean(award.is_tied),
        tie_ranking_type: award.is_tied ? award.tie_ranking_type : null,
        recipients: award.recipients.map((rec: EditingRecipient) => ({
          recipient_type: rec.recipient_type,
          user_id: rec.recipient_type === 'INDIVIDUAL' ? rec.user_id : null,
          registration_id: rec.recipient_type === 'INDIVIDUAL' ? rec.registration_id : null,
          team_id: rec.recipient_type === 'TEAM' ? rec.team_id : null,
          external_name: rec.recipient_type === 'EXTERNAL' ? rec.external_name : null,
          external_details: rec.recipient_type === 'EXTERNAL' ? rec.external_details : null,
          members: rec.recipient_type === 'TEAM'
            ? (rec.members || []).filter((m: EditingMember) => m.confirmed).map((m: EditingMember) => ({
                user_id: m.user_id,
                registration_id: m.registration_id,
                display_name_snapshot: m.name,
                avatar_url_snapshot: m.avatar_url,
                roll_number_snapshot: m.roll_number,
                team_role_snapshot: m.team_role,
                is_authorized_exception: Boolean(m.is_authorized_exception)
              }))
            : undefined
        })),
        project_links: award.project_links || []
      }));

      const res = await eventResultsApi.saveDraft(eventId, {
        version,
        awards: payloadAwards
      });

      setVersion(res.version);
      setStatusMessage({ type: 'success', text: `Draft saved successfully (v${res.version})` });
      await loadWorkspace();
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save draft' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      setStatusMessage(null);

      if (!revisionId) {
        throw new Error('No draft revision found. Please save a draft first.');
      }

      await eventResultsApi.publish(eventId, {
        revision_id: revisionId,
        version,
        notify_winners: notifyWinners,
        announce_participants: announceParticipants
      });

      setPublishModalOpen(false);
      setStatusMessage({ type: 'success', text: 'Official results published successfully!' });
      await loadWorkspace();
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to publish results' });
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateCorrection = async () => {
    try {
      if (!correctionReason.trim()) {
        setStatusMessage({ type: 'error', text: 'Correction reason is required' });
        return;
      }
      setLoading(true);
      await eventResultsApi.createCorrection(eventId, {
        correction_reason: correctionReason.trim()
      });
      setCorrectionModalOpen(false);
      setCorrectionReason('');
      setStatusMessage({ type: 'success', text: 'Correction draft created. Edit the winners and republish.' });
      await loadWorkspace();
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create correction draft' });
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      if (!withdrawReason.trim()) {
        setStatusMessage({ type: 'error', text: 'Withdrawal reason is required' });
        return;
      }
      setLoading(true);
      await eventResultsApi.withdraw(eventId, {
        reason: withdrawReason.trim()
      });
      setWithdrawModalOpen(false);
      setWithdrawReason('');
      setStatusMessage({ type: 'success', text: 'Results withdrawn and hidden from public display.' });
      await loadWorkspace();
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to withdraw results' });
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      if (!restoreReason.trim()) {
        setStatusMessage({ type: 'error', text: 'Restoration reason is required' });
        return;
      }
      setLoading(true);
      await eventResultsApi.restore(eventId, {
        reason: restoreReason.trim()
      });
      setRestoreModalOpen(false);
      setRestoreReason('');
      setStatusMessage({ type: 'success', text: 'Results restored to public display.' });
      await loadWorkspace();
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to restore results' });
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-[#090a0f] border-2 border-white/10">
        <div className="h-8 w-8 border-3 border-[#0057FF] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-mono text-[#a0a4b8] uppercase tracking-widest">
          Loading Event Results & Awards...
        </p>
      </div>
    );
  }

  const isLockedForEdits = isPublished && !workspace?.draft;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header & Lifecycle Status Banner */}
      <div className="p-6 bg-[#090a0f] border-2 border-white/15 shadow-[4px_4px_0px_#000] relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-[#C8FF00]" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#0057FF]">
                Official Event Results & Recognition
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase text-[#F5F5F2]" style={{ fontFamily: "'Syne', sans-serif" }}>
              Awards, Podium & Winner Snapshots
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {workspace?.event.slug && isPublished && (
              <Link
                href={`/event/${workspace.event.slug}/results`}
                target="_blank"
                className="flex items-center gap-2 px-3 py-2 bg-[#0057FF] text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#0047D4] transition-all shadow-[2px_2px_0px_#000]"
              >
                <span>Live Results</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}

            {isLockedForEdits ? (
              <button
                onClick={() => setCorrectionModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-[#FF9500] text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#E08500] transition-all shadow-[2px_2px_0px_#000]"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Issue Correction Draft</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 bg-[#090a0f] border border-white/20 text-[#F5F5F2] font-mono text-xs font-bold uppercase tracking-wider hover:border-white transition-all shadow-[2px_2px_0px_#000] disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 text-[#0057FF]" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </button>

                <button
                  onClick={() => setPublishModalOpen(true)}
                  disabled={publishing || awards.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-[#C8FF00] text-black font-mono text-xs font-black uppercase tracking-wider hover:bg-[#B5E600] transition-all shadow-[2px_2px_0px_#000] disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Official Results</span>
                </button>
              </>
            )}

            {isPublished && !isWithdrawn && (
              <button
                onClick={() => setWithdrawModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-500/50 text-red-400 font-mono text-xs font-bold uppercase tracking-wider hover:bg-red-900/60 transition-all shadow-[2px_2px_0px_#000]"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Withdraw</span>
              </button>
            )}

            {isWithdrawn && (
              <button
                onClick={() => setRestoreModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-950/40 border border-emerald-500/50 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider hover:bg-emerald-900/60 transition-all shadow-[2px_2px_0px_#000]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Results</span>
              </button>
            )}
          </div>
        </div>

        {/* State Banner */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={clsx(
              "px-2.5 py-1 text-xs font-mono font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]",
              isWithdrawn ? "bg-red-500 text-white" :
              isPublished ? "bg-[#C8FF00] text-black" :
              "bg-[#FF9500] text-black"
            )}>
              {isWithdrawn ? 'WITHDRAWN' : isPublished ? (workspace?.draft ? 'PUBLISHED (DRAFT CORRECTION)' : `PUBLISHED (REV #${revisionNumber})`) : `DRAFT (REV #${revisionNumber})`}
            </span>

            <span className="text-xs font-mono text-[#a0a4b8]">
              {isWithdrawn ? 'Results withdrawn from public discovery' :
               isPublished ? (workspace?.draft ? 'A draft correction is in progress. Current published results remain live.' : 'Active official results visible to all authorized attendees.') :
               'Draft results are visible only to event managers.'}
            </span>
          </div>

          <div className="text-xs font-mono text-white/50">
            Version {version} • {awards.length} Award{awards.length === 1 ? '' : 's'}
          </div>
        </div>

        {statusMessage && (
          <div className={clsx(
            "mt-4 p-3 border font-mono text-xs flex items-center gap-2 shadow-[2px_2px_0px_#000]",
            statusMessage.type === 'success' ? "bg-emerald-950/40 border-emerald-500 text-emerald-300" : "bg-red-950/40 border-red-500 text-red-300"
          )}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* 2. Awards Configuration List */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-[#F5F5F2]">
              Configured Awards & Winner Placements
            </h3>
            <p className="text-xs text-[#a0a4b8] mt-0.5">
              Ranked podium placements (1st, 2nd, 3rd), special category awards, and verified recipient rosters.
            </p>
          </div>

          {!isLockedForEdits && (
            <button
              onClick={handleAddAward}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#0057FF] text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#0047D4] transition-all shadow-[2px_2px_0px_#000]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Award</span>
            </button>
          )}
        </div>

        {awards.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-white/15 bg-[#090a0f]">
            <Trophy className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-sm font-mono text-[#a0a4b8] uppercase tracking-wider">
              No awards configured yet. Click &quot;Add Award&quot; above to create 1st place, runner-up, or special awards.
            </p>
          </div>
        ) : (
          awards.map((award, aIndex) => {
            const isRanked = award.award_type === 'RANKED_PLACEMENT';

            return (
              <div
                key={aIndex}
                className={clsx(
                  "p-5 bg-[#090a0f] border-2 shadow-[4px_4px_0px_#000] flex flex-col gap-4 relative",
                  isRanked && award.placement === 1 ? "border-[#C8FF00]" :
                  isRanked && award.placement === 2 ? "border-slate-300" :
                  isRanked && award.placement === 3 ? "border-amber-600" :
                  "border-white/15"
                )}
              >
                {/* Award Header Line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={clsx(
                      "w-8 h-8 flex items-center justify-center font-mono font-black text-sm border-2 shadow-[2px_2px_0px_#000]",
                      isRanked && award.placement === 1 ? "bg-[#C8FF00] text-black border-black" :
                      isRanked && award.placement === 2 ? "bg-slate-300 text-black border-black" :
                      isRanked && award.placement === 3 ? "bg-amber-600 text-white border-black" :
                      "bg-white/10 text-white border-white/20"
                    )}>
                      {isRanked ? (award.placement || aIndex + 1) : '★'}
                    </span>

                    <input
                      type="text"
                      disabled={isLockedForEdits}
                      value={award.title}
                      onChange={(e) => handleUpdateAward(aIndex, { title: e.target.value })}
                      placeholder="Award Title (e.g. 1st Place Grand Winner)"
                      className="bg-[#050505] border border-white/20 px-3 py-1.5 text-sm font-bold text-[#F5F5F2] uppercase tracking-wide focus:border-[#0057FF] outline-none w-72 max-w-full"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Award Type Selector */}
                    <select
                      disabled={isLockedForEdits}
                      value={award.award_type}
                      onChange={(e) => handleUpdateAward(aIndex, { award_type: e.target.value as AwardType })}
                      className="bg-[#050505] border border-white/20 px-3 py-1.5 text-xs font-mono font-bold text-[#F5F5F2] uppercase tracking-wide focus:border-[#0057FF] outline-none"
                    >
                      <option value="RANKED_PLACEMENT">Ranked Placement</option>
                      <option value="SPECIAL_AWARD">Special Award</option>
                      <option value="HONORABLE_MENTION">Honorable Mention</option>
                      <option value="CUSTOM">Custom Award</option>
                    </select>

                    {isRanked && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-[#a0a4b8]">Rank:</span>
                        <input
                          type="number"
                          min={1}
                          disabled={isLockedForEdits}
                          value={award.placement ?? ''}
                          onChange={(e) => handleUpdateAward(aIndex, { placement: parseInt(e.target.value, 10) || null })}
                          className="w-16 bg-[#050505] border border-white/20 px-2 py-1 text-xs font-mono font-bold text-center text-[#F5F5F2] outline-none"
                        />
                      </div>
                    )}

                    {!isLockedForEdits && (
                      <button
                        onClick={() => handleRemoveAward(aIndex)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-all border border-transparent hover:border-red-500/40"
                        title="Delete Award"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Description & Ties Config */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/5">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      disabled={isLockedForEdits}
                      value={award.description}
                      onChange={(e) => handleUpdateAward(aIndex, { description: e.target.value })}
                      placeholder="Optional award description or criteria..."
                      className="w-full bg-[#050505] border border-white/10 px-3 py-1 text-xs text-[#a0a4b8] focus:border-white/30 outline-none"
                    />
                  </div>

                  {isRanked && (
                    <div className="flex items-center gap-4 bg-[#050505] border border-white/10 px-3 py-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-[#a0a4b8]">
                        <input
                          type="checkbox"
                          disabled={isLockedForEdits}
                          checked={award.is_tied}
                          onChange={(e) => handleUpdateAward(aIndex, { is_tied: e.target.checked })}
                          className="accent-[#0057FF]"
                        />
                        <span>Is Tied Placement</span>
                      </label>

                      {award.is_tied && (
                        <select
                          disabled={isLockedForEdits}
                          value={award.tie_ranking_type}
                          onChange={(e) => handleUpdateAward(aIndex, { tie_ranking_type: e.target.value as TieRankingType })}
                          className="bg-transparent border-none text-[11px] font-mono text-[#C8FF00] outline-none"
                        >
                          <option value="COMPETITION">Competition (1, 1, 3)</option>
                          <option value="DENSE">Dense (1, 1, 2)</option>
                        </select>
                      )}
                    </div>
                  )}
                </div>

                {/* Recipients Section */}
                <div className="mt-2 bg-[#050505] border border-white/10 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#a0a4b8] flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-[#0057FF]" />
                      Recipients ({award.recipients.length})
                    </span>

                    {!isLockedForEdits && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActivePickerAwardIndex(aIndex);
                            setPickerType('INDIVIDUAL');
                            setParticipantSearch('');
                          }}
                          className="px-2 py-1 bg-white/5 border border-white/15 text-xs font-mono font-medium hover:border-[#0057FF] hover:text-[#0057FF] transition-all flex items-center gap-1.5"
                        >
                          <User className="w-3 h-3" />
                          <span>+ Student</span>
                        </button>

                        <button
                          onClick={() => {
                            setActivePickerAwardIndex(aIndex);
                            setPickerType('TEAM');
                            setTeamSearch('');
                          }}
                          className="px-2 py-1 bg-white/5 border border-white/15 text-xs font-mono font-medium hover:border-[#C8FF00] hover:text-[#C8FF00] transition-all flex items-center gap-1.5"
                        >
                          <Users className="w-3 h-3" />
                          <span>+ Team</span>
                        </button>

                        <button
                          onClick={() => handleAddExternalRecipient(aIndex)}
                          className="px-2 py-1 bg-white/5 border border-white/15 text-xs font-mono font-medium hover:border-amber-400 hover:text-amber-400 transition-all flex items-center gap-1.5"
                        >
                          <Globe className="w-3 h-3" />
                          <span>+ External Winner</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Active Picker Drawer */}
                  {activePickerAwardIndex === aIndex && (
                    <div className="mb-4 p-3 bg-[#0d0f18] border-2 border-[#0057FF] shadow-[2px_2px_0px_#000]">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                        <span className="font-mono text-xs font-bold text-[#0057FF] uppercase tracking-wider">
                          Select {pickerType === 'INDIVIDUAL' ? 'Individually Registered Student' : 'Registered Team'}
                        </span>
                        <button
                          onClick={() => {
                            setActivePickerAwardIndex(null);
                            setPickerType(null);
                          }}
                          className="text-[#a0a4b8] hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {pickerType === 'INDIVIDUAL' && (
                        <div>
                          <div className="flex items-center gap-2 bg-[#050505] border border-white/20 px-3 py-1.5 mb-2">
                            <Search className="w-3.5 h-3.5 text-[#a0a4b8]" />
                            <input
                              type="text"
                              autoFocus
                              value={participantSearch}
                              onChange={(e) => setParticipantSearch(e.target.value)}
                              placeholder="Search registered student by name or roll number..."
                              className="bg-transparent border-none text-xs text-[#F5F5F2] outline-none w-full"
                            />
                          </div>

                          <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
                            {participantResults.length === 0 ? (
                              <p className="text-xs font-mono text-[#a0a4b8] py-2 text-center">
                                No registered students found matching search.
                              </p>
                            ) : (
                              participantResults.map((p) => (
                                <div
                                  key={p.registration_id}
                                  onClick={() => handleAddIndividualRecipient(aIndex, p)}
                                  className="flex items-center justify-between p-2 bg-[#050505] border border-white/10 hover:border-[#0057FF] cursor-pointer transition-all"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] text-white">
                                      {p.full_name[0]}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-[#F5F5F2]">{p.full_name}</p>
                                      <p className="text-[10px] font-mono text-[#a0a4b8]">
                                        {p.roll_number || 'N/A'} • {p.program || 'Student'} {p.batch ? `'${p.batch.slice(-2)}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="font-mono text-[10px] text-[#0057FF] uppercase font-bold">Select</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {pickerType === 'TEAM' && (
                        <div>
                          <div className="flex items-center gap-2 bg-[#050505] border border-white/20 px-3 py-1.5 mb-2">
                            <Search className="w-3.5 h-3.5 text-[#a0a4b8]" />
                            <input
                              type="text"
                              autoFocus
                              value={teamSearch}
                              onChange={(e) => setTeamSearch(e.target.value)}
                              placeholder="Search registered team by name..."
                              className="bg-transparent border-none text-xs text-[#F5F5F2] outline-none w-full"
                            />
                          </div>

                          <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
                            {teamResults.length === 0 ? (
                              <p className="text-xs font-mono text-[#a0a4b8] py-2 text-center">
                                No registered teams found matching search.
                              </p>
                            ) : (
                              teamResults.map((t) => (
                                <div
                                  key={t.team_id}
                                  onClick={() => handleAddTeamRecipient(aIndex, t)}
                                  className="flex items-center justify-between p-2 bg-[#050505] border border-white/10 hover:border-[#C8FF00] cursor-pointer transition-all"
                                >
                                  <div>
                                    <p className="text-xs font-bold text-[#F5F5F2]">{t.name}</p>
                                    <p className="text-[10px] font-mono text-[#a0a4b8]">
                                      {t.members.length} member{t.members.length === 1 ? '' : 's'} registered
                                    </p>
                                  </div>
                                  <span className="font-mono text-[10px] text-[#C8FF00] uppercase font-bold">Select Team</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recipient Cards */}
                  {award.recipients.length === 0 ? (
                    <p className="text-xs font-mono text-white/30 italic py-1">
                      No recipients assigned yet. Add a student, team, or external winner above.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {award.recipients.map((rec: EditingRecipient, rIndex: number) => {
                        if (rec.recipient_type === 'INDIVIDUAL') {
                          return (
                            <div
                              key={rIndex}
                              className="flex items-center justify-between p-2.5 bg-[#090a0f] border border-white/15"
                            >
                              <div className="flex items-center gap-3">
                                <span className="px-1.5 py-0.5 bg-[#0057FF]/20 text-[#0057FF] border border-[#0057FF]/40 text-[10px] font-mono font-bold uppercase">
                                  Student
                                </span>
                                <div>
                                  <p className="text-xs font-bold text-[#F5F5F2]">{rec.student?.name || 'Verified Student'}</p>
                                  <p className="text-[11px] font-mono text-[#a0a4b8]">
                                    {rec.student?.roll_number} • {rec.student?.program || 'NST'} {rec.student?.batch ? `'${rec.student.batch.slice(-2)}` : ''}
                                  </p>
                                </div>
                              </div>

                              {!isLockedForEdits && (
                                <button
                                  onClick={() => handleRemoveRecipient(aIndex, rIndex)}
                                  className="text-[#a0a4b8] hover:text-red-400 p-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        }

                        if (rec.recipient_type === 'TEAM') {
                          return (
                            <div
                              key={rIndex}
                              className="p-3 bg-[#090a0f] border border-[#C8FF00]/40 flex flex-col gap-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 bg-[#C8FF00]/20 text-[#C8FF00] border border-[#C8FF00]/40 text-[10px] font-mono font-black uppercase">
                                    Team
                                  </span>
                                  <span className="text-xs font-bold text-[#F5F5F2]">{rec.team?.name}</span>
                                </div>

                                {!isLockedForEdits && (
                                  <button
                                    onClick={() => handleRemoveRecipient(aIndex, rIndex)}
                                    className="text-[#a0a4b8] hover:text-red-400 p-1"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Explicit Member Snapshot Confirmation */}
                              <div className="pl-3 border-l-2 border-white/10 flex flex-col gap-1.5">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[#a0a4b8]">
                                  Recognized Member Snapshots (Check to confirm for awards & student achievements):
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {(rec.members || []).map((m: EditingMember, mIndex: number) => (
                                    <label
                                      key={mIndex}
                                      className={clsx(
                                        "flex items-center gap-2 p-1.5 border text-xs cursor-pointer transition-all",
                                        m.confirmed ? "bg-white/5 border-white/20 text-[#F5F5F2]" : "bg-black/30 border-white/5 text-white/30 line-through"
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        disabled={isLockedForEdits}
                                        checked={m.confirmed}
                                        onChange={() => handleToggleMemberConfirmed(aIndex, rIndex, mIndex)}
                                        className="accent-[#C8FF00]"
                                      />
                                      <span className="truncate">{m.name}</span>
                                      <span className="text-[10px] font-mono text-[#a0a4b8] ml-auto">
                                        {m.team_role || 'MEMBER'}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (rec.recipient_type === 'EXTERNAL') {
                          return (
                            <div
                              key={rIndex}
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-[#090a0f] border border-amber-500/40 gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-mono font-bold uppercase">
                                  External
                                </span>
                                <input
                                  type="text"
                                  disabled={isLockedForEdits}
                                  value={rec.external_name || ''}
                                  onChange={(e) => {
                                    const currentAward = awards[aIndex];
                                    const recipients = [...currentAward.recipients];
                                    recipients[rIndex] = { ...recipients[rIndex], external_name: e.target.value };
                                    handleUpdateAward(aIndex, { recipients });
                                  }}
                                  placeholder="External Winner Name"
                                  className="bg-[#050505] border border-white/10 px-2 py-0.5 text-xs text-[#F5F5F2] font-bold outline-none"
                                />
                                <input
                                  type="text"
                                  disabled={isLockedForEdits}
                                  value={rec.external_details || ''}
                                  onChange={(e) => {
                                    const currentAward = awards[aIndex];
                                    const recipients = [...currentAward.recipients];
                                    recipients[rIndex] = { ...recipients[rIndex], external_details: e.target.value };
                                    handleUpdateAward(aIndex, { recipients });
                                  }}
                                  placeholder="Organization / Role"
                                  className="bg-[#050505] border border-white/10 px-2 py-0.5 text-xs text-[#a0a4b8] outline-none"
                                />
                              </div>

                              {!isLockedForEdits && (
                                <button
                                  onClick={() => handleRemoveRecipient(aIndex, rIndex)}
                                  className="text-[#a0a4b8] hover:text-red-400 p-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Publish Confirmation Modal */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#090a0f] border-3 border-[#C8FF00] p-6 shadow-[8px_8px_0px_#000] flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[#C8FF00]">
              <Trophy className="w-6 h-6" />
              <h3 className="font-mono text-base font-black uppercase tracking-wider text-[#F5F5F2]">
                Publish Official Event Results
              </h3>
            </div>

            <p className="text-xs text-[#a0a4b8] leading-relaxed">
              Publishing will make these results visible to all authorized participants and students. Official student achievements will be permanently issued to all recognized winners.
            </p>

            <div className="p-3 bg-[#050505] border border-white/10 flex flex-col gap-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-mono text-[#F5F5F2]">
                <input
                  type="checkbox"
                  checked={notifyWinners}
                  onChange={(e) => setNotifyWinners(e.target.checked)}
                  className="accent-[#C8FF00]"
                />
                <span>Send in-app trophy notification to recognized winners</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-mono text-[#a0a4b8]">
                <input
                  type="checkbox"
                  checked={announceParticipants}
                  onChange={(e) => setAnnounceParticipants(e.target.checked)}
                  className="accent-[#0057FF]"
                />
                <span>Broadcast result announcement to all event attendees</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setPublishModalOpen(false)}
                className="px-4 py-2 bg-transparent text-[#a0a4b8] hover:text-white font-mono text-xs uppercase"
              >
                Cancel
              </button>

              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-5 py-2.5 bg-[#C8FF00] text-black font-mono text-xs font-black uppercase tracking-wider hover:bg-[#B5E600] transition-all shadow-[2px_2px_0px_#000] disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : 'Confirm & Publish Results'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Issue Correction Draft Modal */}
      {correctionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#090a0f] border-3 border-[#FF9500] p-6 shadow-[8px_8px_0px_#000] flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[#FF9500]">
              <FileEdit className="w-6 h-6" />
              <h3 className="font-mono text-base font-black uppercase tracking-wider text-[#F5F5F2]">
                Issue Result Correction Draft
              </h3>
            </div>

            <p className="text-xs text-[#a0a4b8] leading-relaxed">
              Published revisions are immutable. To correct an award, winner placement, or team member roster, specify a reason. A new draft revision will be initialized copying all existing awards.
            </p>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#a0a4b8] mb-1">
                Correction Reason (Publicly audited):
              </label>
              <textarea
                rows={3}
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="e.g., Corrected 2nd place team member roster after dispute review..."
                className="w-full bg-[#050505] border border-white/20 p-2.5 text-xs text-[#F5F5F2] focus:border-[#FF9500] outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setCorrectionModalOpen(false)}
                className="px-4 py-2 bg-transparent text-[#a0a4b8] hover:text-white font-mono text-xs uppercase"
              >
                Cancel
              </button>

              <button
                onClick={handleCreateCorrection}
                className="px-5 py-2.5 bg-[#FF9500] text-black font-mono text-xs font-black uppercase tracking-wider hover:bg-[#E08500] transition-all shadow-[2px_2px_0px_#000]"
              >
                Create Correction Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Withdraw Results Modal */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#090a0f] border-3 border-red-500 p-6 shadow-[8px_8px_0px_#000] flex flex-col gap-4">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-mono text-base font-black uppercase tracking-wider text-[#F5F5F2]">
                Withdraw Official Results
              </h3>
            </div>

            <p className="text-xs text-[#a0a4b8] leading-relaxed">
              Withdrawing results will hide them from public view and deactivate all associated student achievements pending investigation or correction.
            </p>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#a0a4b8] mb-1">
                Withdrawal Reason:
              </label>
              <textarea
                rows={3}
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="e.g., Pending dispute resolution on project submission originality..."
                className="w-full bg-[#050505] border border-white/20 p-2.5 text-xs text-[#F5F5F2] focus:border-red-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setWithdrawModalOpen(false)}
                className="px-4 py-2 bg-transparent text-[#a0a4b8] hover:text-white font-mono text-xs uppercase"
              >
                Cancel
              </button>

              <button
                onClick={handleWithdraw}
                className="px-5 py-2.5 bg-red-600 text-white font-mono text-xs font-black uppercase tracking-wider hover:bg-red-700 transition-all shadow-[2px_2px_0px_#000]"
              >
                Withdraw Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Restore Results Modal */}
      {restoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#090a0f] border-3 border-emerald-500 p-6 shadow-[8px_8px_0px_#000] flex flex-col gap-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <RotateCcw className="w-6 h-6" />
              <h3 className="font-mono text-base font-black uppercase tracking-wider text-[#F5F5F2]">
                Restore Withdrawn Results
              </h3>
            </div>

            <p className="text-xs text-[#a0a4b8] leading-relaxed">
              Restoring results will reactivate the previous published revision and reinstate verified student achievements.
            </p>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#a0a4b8] mb-1">
                Restoration Reason:
              </label>
              <textarea
                rows={3}
                value={restoreReason}
                onChange={(e) => setRestoreReason(e.target.value)}
                placeholder="e.g., Review completed; all scores verified original..."
                className="w-full bg-[#050505] border border-white/20 p-2.5 text-xs text-[#F5F5F2] focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setRestoreModalOpen(false)}
                className="px-4 py-2 bg-transparent text-[#a0a4b8] hover:text-white font-mono text-xs uppercase"
              >
                Cancel
              </button>

              <button
                onClick={handleRestore}
                className="px-5 py-2.5 bg-emerald-500 text-black font-mono text-xs font-black uppercase tracking-wider hover:bg-emerald-400 transition-all shadow-[2px_2px_0px_#000]"
              >
                Restore Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
