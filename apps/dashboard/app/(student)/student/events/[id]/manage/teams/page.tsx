'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { use, useState } from 'react';
import { useTeamsList, TeamMember } from '../../../../../../../hooks/useTeams';
import { useEventDetail } from '../../../../../../../hooks/useEventDetail';
import { 
  useAdminCancelTeam, 
  useAdminPromoteWaitlist, 
  useAdminRemoveMember, 
  useAdminTransferLeadership 
} from '../../../../../../../hooks/useAdminTeams';
import { resolveEventLockState } from '../../../../../../../lib/event-utils';
import { Modal } from '../../../../../../../components/ui/Modal';
import clsx from 'clsx';
import { Search, Users, ChevronDown, ChevronUp, ShieldAlert, AlertCircle } from 'lucide-react';

export default function ManageTeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const { data: event, isLoading: isLoadingEvent } = useEventDetail(eventId);
  
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useTeamsList(eventId);
  
  // Admin Mutations
  const { mutate: cancelTeam, isPending: isCanceling } = useAdminCancelTeam(eventId);
  const { mutate: promoteWaitlist, isPending: isPromoting } = useAdminPromoteWaitlist(eventId);
  const { mutate: removeMember, isPending: isRemoving } = useAdminRemoveMember(eventId);
  const { mutate: transferLeadership, isPending: isTransferring } = useAdminTransferLeadership(eventId);

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal states
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean, teamId: string | null }>({ isOpen: false, teamId: null });
  const [removeModal, setRemoveModal] = useState<{ isOpen: boolean, teamId: string | null, member: TeamMember | null }>({ isOpen: false, teamId: null, member: null });
  const [transferModal, setTransferModal] = useState<{ isOpen: boolean, teamId: string | null, member: TeamMember | null }>({ isOpen: false, teamId: null, member: null });
  
  // Error state for mutations
  const [actionError, setActionError] = useState<string | null>(null);

  const teams = data?.pages.flatMap(p => p.data) || [];

  const filteredTeams = teams.filter(team => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (team.name || '').toLowerCase();
    const leader = (team.leader_name || '').toLowerCase();
    return name.includes(q) || leader.includes(q);
  });

  const lockState = event ? resolveEventLockState(event) : 'UNLOCKED';
  const isEffectivelyLocked = lockState !== 'UNLOCKED';

  const extractError = (err: any) => err?.data?.detail || err?.message || 'An unexpected error occurred.';

  const toggleExpand = (teamId: string) => {
    setExpandedTeamId(prev => prev === teamId ? null : teamId);
  };

  const handleCancelTeam = () => {
    if (!cancelModal.teamId) return;
    setActionError(null);
    cancelTeam(cancelModal.teamId, {
      onSuccess: () => {
        setCancelModal({ isOpen: false, teamId: null });
      },
      onError: (err: any) => {
        setActionError(extractError(err));
        setCancelModal({ isOpen: false, teamId: null });
      }
    });
  };

  const handlePromoteTeam = (teamId: string) => {
    if (isEffectivelyLocked) return;
    setActionError(null);
    promoteWaitlist(teamId, {
      onError: (err: any) => {
        setActionError(extractError(err));
      }
    });
  };

  const handleRemoveMember = () => {
    if (!removeModal.teamId || !removeModal.member) return;
    setActionError(null);
    removeMember({ teamId: removeModal.teamId, userId: removeModal.member.user_id }, {
      onSuccess: () => {
        setRemoveModal({ isOpen: false, teamId: null, member: null });
      },
      onError: (err: any) => {
        setActionError(extractError(err));
        setRemoveModal({ isOpen: false, teamId: null, member: null });
      }
    });
  };

  const handleTransferLeadership = () => {
    if (!transferModal.teamId || !transferModal.member) return;
    setActionError(null);
    transferLeadership({ teamId: transferModal.teamId, newLeaderId: transferModal.member.user_id }, {
      onSuccess: () => {
        setTransferModal({ isOpen: false, teamId: null, member: null });
      },
      onError: (err: any) => {
        setActionError(extractError(err));
        setTransferModal({ isOpen: false, teamId: null, member: null });
      }
    });
  };

  if (isLoadingEvent || isLoading) {
    return (
      <div className="w-full h-32 flex items-center justify-center border-2 border-white/15 bg-[#090a0f]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-[#0057FF] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#a0a4b8]">Loading Teams...</span>
        </div>
      </div>
    );
  }

  if (event?.registrationType !== 'TEAM') {
    return (
      <div className="p-8 text-center border-2 border-white/15 bg-[#090a0f]">
        <p className="text-sm text-[#a0a4b8] font-mono uppercase tracking-widest">This is not a team event.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Locked Banner */}
      {isEffectivelyLocked && (
        <div className="p-4 border-2 border-[#FF9500] bg-[#FF9500]/10 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#FF9500] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-mono font-bold text-[#FF9500] uppercase tracking-widest mb-1">
              Event Locked ({lockState})
            </h3>
            <p className="text-xs text-[#FF9500]/80 font-mono">
              Team management actions are disabled because this event is locked.
            </p>
          </div>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-4 border-2 border-[#FF3B30] bg-[#FF3B30]/10 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#FF3B30] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-mono font-bold text-[#FF3B30] uppercase tracking-widest mb-1">
              Action Failed
            </h3>
            <p className="text-xs text-[#FF3B30] font-mono">
              {actionError}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-[#090a0f] border-2 border-white/20 w-full sm:w-72 relative shadow-[3px_3px_0px_#000]">
          <Search className="w-4 h-4 text-[#a0a4b8] absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams by name or leader..."
            className="w-full bg-transparent pl-9 pr-3 py-2 text-xs font-mono text-[#F5F5F2] focus:outline-none"
          />
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeams.length === 0 ? (
          <div className="col-span-full p-12 text-center border-2 border-white/15 bg-[#090a0f]">
            <p className="text-xs text-[#a0a4b8] font-mono uppercase tracking-widest">No teams registered matching criteria.</p>
          </div>
        ) : (
          filteredTeams.map((team) => (
            <div key={team.id} className="border-2 border-white/15 bg-[#090a0f] flex flex-col group shadow-[4px_4px_0px_#000]">
              <div className="p-5 flex-grow">
                <div className="flex items-center justify-between mb-3">
                  <span className={clsx(
                    "text-[10px] font-mono font-bold tracking-[0.2em] uppercase px-2 py-0.5 border shadow-[2px_2px_0px_#000]",
                    team.status === 'READY' || team.status === 'REGISTERED' ? "border-black bg-[#C8FF00] text-black font-black" :
                    team.status === 'WAITLISTED' ? "border-[#FF9500] text-[#FF9500] bg-[#FF9500]/20" :
                    team.status === 'CANCELLED' ? "border-[#FF3B30] text-[#FF3B30] bg-[#FF3B30]/20" :
                    "border-white/15 text-[#a0a4b8]"
                  )}>
                    {team.status || 'UNKNOWN'}
                  </span>
                  {team.below_minimum && team.status !== 'CANCELLED' && (
                    <span className="text-[10px] font-mono tracking-widest uppercase bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500] px-2 py-0.5">
                      UNDERSIZED
                    </span>
                  )}
                </div>
                
                <h3 className="text-lg font-black text-[#F5F5F2] leading-tight mb-4 group-hover:text-[#0057FF] transition-colors truncate" style={{ fontFamily: "'Syne', sans-serif" }}>
                  {team.name}
                </h3>
                
                <div className="space-y-2 mt-auto">
                  <div className="flex items-start gap-2.5">
                    <Users className="w-3.5 h-3.5 text-[#a0a4b8] mt-0.5" />
                    <span className="text-xs text-[#a0a4b8] font-mono uppercase tracking-wide">
                      {team.member_count} Members
                    </span>
                  </div>
                  <div className="text-xs text-[#a0a4b8] truncate mt-1 font-sans">
                    Leader: <span className="font-semibold text-white">{team.leader_name}</span>
                  </div>
                </div>

                {/* Team Actions */}
                {!isEffectivelyLocked && team.status !== 'CANCELLED' && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2">
                    {team.status === 'WAITLISTED' && (
                      <button
                        onClick={() => handlePromoteTeam(team.id)}
                        disabled={isPromoting}
                        className="px-3 py-1.5 bg-white text-black font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-[#0057FF] hover:text-white transition-colors disabled:opacity-50"
                      >
                        {isPromoting ? 'Promoting...' : 'Promote'}
                      </button>
                    )}
                    <button
                      onClick={() => setCancelModal({ isOpen: true, teamId: team.id })}
                      disabled={isCanceling}
                      className="px-3 py-1.5 border border-[#FF3B30] text-[#FF3B30] font-mono text-[10px] uppercase tracking-widest hover:bg-[#FF3B30] hover:text-white transition-colors disabled:opacity-50"
                    >
                      Cancel Team
                    </button>
                  </div>
                )}
              </div>

              {/* Expand Members */}
              <div className="border-t border-white/15">
                <button 
                  onClick={() => toggleExpand(team.id)}
                  className="w-full p-3 flex justify-between items-center text-xs font-mono font-bold tracking-widest uppercase text-[#a0a4b8] hover:bg-white/5 transition-colors"
                >
                  <span>View Members</span>
                  {expandedTeamId === team.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {expandedTeamId === team.id && (
                  <div className="divide-y divide-white/10 border-t border-white/15 bg-[#0e1017]">
                    {team.members?.length > 0 ? (
                      team.members.map((member) => (
                        <div key={member.user_id} className="p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="text-sm font-semibold text-[#F5F5F2] mb-0.5 font-sans">{member.full_name}</div>
                              <div className="text-[10px] font-mono tracking-widest uppercase text-[#a0a4b8]">
                                {member.user_id === team.leader_id ? (
                                  <span className="text-[#0057FF] font-bold">Leader</span>
                                ) : (
                                  'Member'
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Member Actions */}
                          {!isEffectivelyLocked && team.status !== 'CANCELLED' && (
                            <div className="flex gap-2 mt-2">
                              {member.user_id !== team.leader_id && (
                                <button
                                  onClick={() => setTransferModal({ isOpen: true, teamId: team.id, member })}
                                  disabled={isTransferring}
                                  className="px-2 py-1 border border-white/20 text-[#a0a4b8] hover:text-white hover:bg-white/10 font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50"
                                >
                                  Transfer Leadership
                                </button>
                              )}
                              <button
                                onClick={() => setRemoveModal({ isOpen: true, teamId: team.id, member })}
                                disabled={isRemoving}
                                className="px-2 py-1 border border-[#FF3B30]/30 text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-xs font-mono text-[#a0a4b8] uppercase tracking-widest text-center">
                        No members found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {hasNextPage && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2 border-2 border-white/20 text-[#a0a4b8] font-mono text-xs uppercase tracking-widest hover:text-white hover:border-white transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading more...' : 'Load More Teams'}
          </button>
        </div>
      )}
      
      {/* Confirmation Modals */}
      <Modal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({ isOpen: false, teamId: null })}
        title="CANCEL TEAM"
      >
        <div className="p-6 bg-[#0d0e12] text-[#F5F5F2]">
          <p className="text-sm text-[#a0a4b8] mb-6 font-sans leading-relaxed">
            Are you sure you want to cancel this team? The team will become inactive. If it is registered, released capacity may allow waitlisted teams to be promoted.
          </p>
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={() => setCancelModal({ isOpen: false, teamId: null })}
              disabled={isCanceling}
              className="w-full sm:w-auto px-5 py-2.5 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono font-bold text-[10px] tracking-widest uppercase transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              onClick={handleCancelTeam}
              disabled={isCanceling}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#FF3B30] text-white font-mono font-bold text-[10px] tracking-widest uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isCanceling ? 'Canceling...' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={removeModal.isOpen}
        onClose={() => setRemoveModal({ isOpen: false, teamId: null, member: null })}
        title="REMOVE MEMBER"
      >
        <div className="p-6 bg-[#0d0e12] text-[#F5F5F2]">
          <p className="text-sm text-[#a0a4b8] mb-6 font-sans leading-relaxed">
            Are you sure you want to remove <strong className="text-white">{removeModal.member?.full_name}</strong> from this team?
          </p>
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={() => setRemoveModal({ isOpen: false, teamId: null, member: null })}
              disabled={isRemoving}
              className="w-full sm:w-auto px-5 py-2.5 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono font-bold text-[10px] tracking-widest uppercase transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRemoveMember}
              disabled={isRemoving}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#FF3B30] text-white font-mono font-bold text-[10px] tracking-widest uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isRemoving ? 'Removing...' : 'Confirm Remove'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={transferModal.isOpen}
        onClose={() => setTransferModal({ isOpen: false, teamId: null, member: null })}
        title="TRANSFER LEADERSHIP"
      >
        <div className="p-6 bg-[#0d0e12] text-[#F5F5F2]">
          <p className="text-sm text-[#a0a4b8] mb-6 font-sans leading-relaxed">
            Transfer team leadership to <strong className="text-white">{transferModal.member?.full_name}</strong>?
          </p>
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={() => setTransferModal({ isOpen: false, teamId: null, member: null })}
              disabled={isTransferring}
              className="w-full sm:w-auto px-5 py-2.5 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono font-bold text-[10px] tracking-widest uppercase transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleTransferLeadership}
              disabled={isTransferring}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#0057FF] text-white font-mono font-bold text-[10px] tracking-widest uppercase hover:bg-[#0042c7] transition-colors disabled:opacity-50 shadow-[2px_2px_0px_#000]"
            >
              {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
            </button>
          </div>
        </div>
      </Modal>
      
    </div>
  );
}
