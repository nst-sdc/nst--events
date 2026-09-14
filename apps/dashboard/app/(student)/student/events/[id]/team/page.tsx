'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Info, Users, ShieldAlert } from 'lucide-react';
import { useEventDetail, useMyRegistration } from '../../../../../../hooks/useEventDetail';
import { useTeamLookup, useLeaveTeam } from '../../../../../../hooks/useTeams';
import { useCurrentUser } from '../../../../../../hooks/useCurrentUser';
import { Modal } from '../../../../../../components/ui/Modal';
import { TransferLeadershipModal } from './components/TransferLeadershipModal';
import { useState } from 'react';

export default function TeamHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();

  const { data: event, isLoading: isLoadingEvent } = useEventDetail(eventId);
  const { data: registration, isLoading: isLoadingReg } = useMyRegistration(eventId);
  const { data: currentUser } = useCurrentUser();

  // Redirect to event detail if not a team event
  if (event && event.registrationType !== 'TEAM') {
    router.push(`/student/events/${eventId}`);
  }

  // Determine team ID to lookup
  const teamId = registration?.team_id;

  const { data: team, isLoading: isLoadingTeam } = useTeamLookup(teamId);
  const { mutate: leaveTeam, isPending: isLeaving } = useLeaveTeam(eventId);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Grouped loading
  if (isLoadingEvent || isLoadingReg || isLoadingTeam) {
    return (
      <div className="w-full flex-grow flex justify-center items-center h-64 bg-[#050505]">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 border-3 border-[#0057FF] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-mono text-[#a0a4b8] uppercase tracking-widest">Loading Squad Command...</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  // Locks and Status
  const dbNow = new Date();
  const isPermanentLock = new Date(event.endTime).getTime() + 24 * 60 * 60 * 1000 <= dbNow.getTime();
  const isLocked = event.lock_state !== 'UNLOCKED' || isPermanentLock || new Date(event.endTime) <= dbNow;

  const isLeader = team?.leader_id === currentUser?.id;
  const teamStatus = team?.status || 'UNKNOWN';
  const isBelowMinimum = team?.below_minimum === true;

  const handleLeaveConfirm = () => {
    if (!team) return;
    leaveTeam(team.id, {
      onSuccess: () => {
        setIsLeaveModalOpen(false);
        router.push(`/student/events/${eventId}`);
      }
    });
  };

  const getStatusBadge = () => {
    switch (teamStatus) {
      case 'REGISTERED':
        return 'bg-[#C8FF00] text-black border border-black font-black';
      case 'WAITLISTED':
        return 'border border-[#FF9500] bg-[#FF9500]/20 text-[#FF9500] font-bold';
      case 'FORMING':
        return 'bg-[#0057FF]/20 border border-[#0057FF] text-[#93c5fd] font-bold';
      default:
        return 'bg-white/10 text-[#a0a4b8] border border-white/10';
    }
  };

  return (
    <div className="w-full flex-grow bg-[#050505] text-[#F5F5F2] font-sans min-h-screen">
      
      {/* TRANSFER LEADERSHIP MODAL */}
      {team && (
        <TransferLeadershipModal
          eventId={eventId}
          team={team}
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
        />
      )}

      {/* LEAVE TEAM MODAL */}
      <Modal isOpen={isLeaveModalOpen} onClose={() => !isLeaving && setIsLeaveModalOpen(false)} title="LEAVE SQUAD">
        <div className="p-6 pt-2 font-sans">
          <p className="font-mono text-xs text-[#a0a4b8] mb-8 leading-relaxed">
            {isLeader 
              ? "You are the squad leader. You must transfer leadership before you can leave, or disband the squad if you are the sole member."
              : `Are you sure you want to abandon squad "${team?.name}"? Your slot will be vacated immediately.`}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => setIsLeaveModalOpen(false)}
              disabled={isLeaving}
              className="w-full sm:w-auto px-5 py-3 border-2 border-white/20 text-[#a0a4b8] hover:text-white hover:border-white font-mono font-bold text-xs tracking-widest uppercase transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleLeaveConfirm}
              disabled={isLeaving || (isLeader && team!.member_count > 1)}
              className="w-full sm:flex-1 px-6 py-3 bg-[#FF3B30] text-white font-mono font-bold text-xs tracking-widest hover:bg-[#d63026] border-2 border-[#FF3B30] shadow-[4px_4px_0px_#000] uppercase disabled:opacity-50 transition-all"
            >
              {isLeaving ? 'Processing...' : 'Confirm Leave ↗'}
            </button>
          </div>
        </div>
      </Modal>

      <div className="w-full max-w-[1320px] mx-auto px-6 py-8 md:px-10 md:py-12">
        
        {/* Back Link */}
        <Link 
          href={`/student/events/${eventId}`}
          className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-[#0057FF] hover:text-white transition-colors mb-6 inline-flex"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Event Log
        </Link>

        {isLocked && (
          <div className="w-full text-center px-4 py-3 mb-6 bg-[#0e1017] text-[#FF9500] font-mono font-bold text-xs tracking-widest uppercase border-2 border-[#FF9500] shadow-[4px_4px_0px_#000]">
            Squad Roster Locked — Read-Only Mode Active
          </div>
        )}

        {!team ? (
          <div className="text-center py-20 border-2 border-dashed border-white/15 bg-[#090a0f] p-8">
            <Users className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="font-mono text-sm uppercase tracking-wider text-[#a0a4b8] mb-6">You are not enrolled in a squad for this event.</p>
            <Link 
              href={`/student/events/${eventId}`}
              className="inline-flex items-center justify-center px-6 py-3 bg-[#0057FF] text-white font-mono font-bold text-xs tracking-widest hover:bg-[#0042c7] border-2 border-[#0057FF] shadow-[4px_4px_0px_#000] uppercase transition-all"
            >
              Return to Event
            </Link>
          </div>
        ) : (
          /* 2-Column Composition */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            
            {/* Left Column (Primary Squad Content) */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Squad Header Card */}
              <div className="p-6 md:p-8 bg-[#090a0f] border-3 border-[#F5F5F2] shadow-[10px_10px_0px_#0057FF] relative overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-[#0057FF] via-[#C8FF00] to-[#0057FF] absolute top-0 left-0" />
                
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#0057FF] font-bold block mb-1">
                      SQUAD HEADQUARTERS // {team.member_count} OPERATIVES
                    </span>
                    <h1 
                      className="text-3xl sm:text-4xl md:text-5xl font-black text-[#F5F5F2] uppercase tracking-tight leading-none"
                      style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                      {team.name}
                    </h1>
                    <div className="font-mono text-xs text-[#a0a4b8] mt-2">
                      Registered for <span className="text-white font-semibold">{event.title}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest flex-shrink-0 self-start sm:self-auto shadow-[2px_2px_0px_#000] ${getStatusBadge()}`}>
                    {teamStatus}
                  </div>
                </div>
              </div>

              {/* Below Minimum Warning */}
              {isBelowMinimum && (
                <div className="p-4 bg-[#FF9500]/15 border-2 border-[#FF9500] text-[#FF9500] flex items-start gap-3 text-xs font-mono">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold uppercase tracking-wider mb-0.5">Below Minimum Required Size</h4>
                    <p className="leading-relaxed text-white/80">Additional operatives must enlist to validate your squad entry before check-in begins.</p>
                  </div>
                </div>
              )}

              {/* Members Section */}
              <section className="bg-[#090a0f] border-2 border-white/15 p-6 shadow-[6px_6px_0px_#000]">
                <div className="flex items-center justify-between border-b-2 border-white/10 pb-3 mb-4">
                  <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-[#F5F5F2] uppercase flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#0057FF]" /> Squad Roster ({team.member_count}{event.metadata?.maximum_team_size ? `/${event.metadata.maximum_team_size}` : ''})
                  </h2>
                </div>
                <div className="space-y-2.5">
                  {team.members?.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between p-4 bg-[#0e1017] border-2 border-white/10 hover:border-[#0057FF] transition-all">
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 bg-[#0057FF]/20 text-[#0057FF] flex items-center justify-center border border-[#0057FF]/40 font-mono font-bold text-xs">
                          {member.full_name ? member.full_name.charAt(0) : 'U'}
                        </div>
                        <div>
                          <span className="font-bold text-sm uppercase text-[#F5F5F2]" style={{ fontFamily: "'Syne', sans-serif" }}>
                            {member.full_name || 'Anonymous Operative'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {member.user_id === team.leader_id && (
                          <span className="px-2.5 py-0.5 bg-[#C8FF00] text-black text-[10px] font-mono font-black tracking-wider uppercase shadow-[2px_2px_0px_#000]">
                            Squad Leader
                          </span>
                        )}
                        {member.user_id === currentUser?.id && (
                          <span className="px-2.5 py-0.5 bg-[#0057FF] text-white text-[10px] font-mono font-bold tracking-wider uppercase">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Danger Zone Actions */}
              <section className="bg-[#090a0f] border-2 border-[#FF3B30]/40 p-6 shadow-[6px_6px_0px_#000]">
                <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-[#FF3B30] uppercase border-b border-[#FF3B30]/30 pb-3 mb-4 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Danger Corridor
                </h2>
                
                <div className="flex flex-col gap-3">
                  {isLeader && (
                    <button 
                      onClick={() => setIsTransferModalOpen(true)}
                      disabled={isLocked || team.member_count <= 1}
                      className="w-full flex items-center justify-between p-4 bg-[#0e1017] border-2 border-white/15 hover:border-white transition-all disabled:opacity-40 text-left"
                    >
                      <div>
                        <div className="text-xs font-mono font-bold uppercase text-[#F5F5F2]">Transfer Leadership</div>
                        <div className="font-mono text-[11px] text-[#a0a4b8] mt-0.5">Delegate command to another confirmed squad member</div>
                      </div>
                      <div className="font-mono text-sm text-[#a0a4b8]">→</div>
                    </button>
                  )}

                  <button 
                    onClick={() => setIsLeaveModalOpen(true)}
                    disabled={isLocked}
                    className="w-full flex items-center justify-between p-4 bg-[#FF3B30]/10 border-2 border-[#FF3B30]/40 hover:border-[#FF3B30] hover:bg-[#FF3B30]/20 transition-all text-left disabled:opacity-40"
                  >
                    <div>
                      <div className="text-xs font-mono font-bold uppercase text-[#FF3B30]">Leave Squad</div>
                      <div className="font-mono text-[11px] text-[#FF3B30]/70 mt-0.5">Abandon roster and release your reserved seat</div>
                    </div>
                    <LogOut className="w-4 h-4 text-[#FF3B30]" />
                  </button>
                </div>
              </section>
            </div>

            {/* Right Column (Squad Specs Rail) */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-[#090a0f] border-2 border-white/15 p-6 shadow-[6px_6px_0px_#000]">
                <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-[#a0a4b8] uppercase border-b border-white/10 pb-3 mb-5">
                  Squad Specifications
                </h3>
                
                <div className="space-y-4 font-mono">
                  <div>
                    <div className="text-[10px] text-[#a0a4b8] uppercase tracking-wider mb-1">Target Event</div>
                    <div className="text-sm font-bold text-white leading-snug">{event.title}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-[#a0a4b8] uppercase tracking-wider mb-1">Total Capacity</div>
                    <div className="text-sm font-bold text-white">
                      {team.member_count} {event.metadata?.maximum_team_size ? `/ ${event.metadata.maximum_team_size}` : ''} <span className="text-[#a0a4b8] font-normal text-xs">Members</span>
                    </div>
                  </div>

                  {event.metadata?.minimum_team_size && (
                    <div>
                      <div className="text-[10px] text-[#a0a4b8] uppercase tracking-wider mb-1">Required Threshold</div>
                      <div className="text-sm font-bold text-[#C8FF00]">{event.metadata.minimum_team_size} members minimum</div>
                    </div>
                  )}

                  {event.metadata?.maximum_team_size && (
                    <div>
                      <div className="text-[10px] text-[#a0a4b8] uppercase tracking-wider mb-1">Max Ceiling</div>
                      <div className="text-sm font-bold text-white">{event.metadata.maximum_team_size} members max</div>
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] text-[#a0a4b8] uppercase tracking-wider mb-1">Squad Status</div>
                    <div className="text-sm font-bold uppercase text-[#0057FF]">{teamStatus}</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
