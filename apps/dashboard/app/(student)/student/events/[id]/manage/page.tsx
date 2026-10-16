'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { use } from 'react';
import { useEventDetail } from '../../../../../../hooks/useEventDetail';
import { useEventLifecycle } from '../../../../../../hooks/useEventLifecycle';
import { useCurrentUser } from '../../../../../../hooks/useCurrentUser';
import { resolveEventLockState } from '../../../../../../lib/event-utils';
import { Modal } from '../../../../../../components/ui/Modal';
import { Users, ShieldAlert, FileText, CheckCircle, Clock, AlertCircle, Lock, Edit2, Send, Unlock } from 'lucide-react';
import Link from 'next/link';

export default function EventManageOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const { data: event, isLoading } = useEventDetail(eventId);
  const { submitMutation, lockMutation, unlockMutation } = useEventLifecycle();
  const { data: currentUser } = useCurrentUser();

  const [isLockModalOpen, setIsLockModalOpen] = React.useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = React.useState(false);

  const isClubAdmin = React.useMemo(() => {
    if (!event || !currentUser) return false;
    const primaryClubId = event.eventClubs?.find((ec: any) => ec.isPrimary)?.clubId;
    if (!primaryClubId) return false;
    const membership = currentUser.club_memberships.find((m: any) => m.club_id === primaryClubId);
    return membership?.role === 'CLUB_ADMIN';
  }, [event, currentUser]);

  if (isLoading || !event) return null;

  const lockState = resolveEventLockState(event);
  const showLockEvent = event.state === 'PUBLISHED' && isClubAdmin && lockState === 'UNLOCKED';
  const showUnlockEvent = event.state === 'PUBLISHED' && isClubAdmin && lockState === 'MANUALLY_LOCKED';

  const handleSubmitForApproval = () => {
    if (confirm('Are you sure you want to submit this event for approval? You will no longer be able to edit it.')) {
      submitMutation.mutate(eventId);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* State Call to Actions */}
      {event.state === 'DRAFT' && (
        <div className="p-6 border-2 border-[#FF9500] bg-[#FF9500]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[4px_4px_0px_#000]">
          <div>
            <h3 className="text-sm font-mono font-bold text-[#FF9500] uppercase tracking-widest mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Event Status: Draft
            </h3>
            <p className="text-xs text-[#a0a4b8] font-mono">Review all parameters and logistics before submitting for institutional approval.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Link 
              href={`/student/events/${eventId}/manage/edit`}
              className="flex-1 sm:flex-none px-5 py-2.5 border-2 border-[#FF9500] text-[#FF9500] font-mono font-bold text-xs tracking-widest hover:bg-[#FF9500] hover:text-black transition-colors uppercase whitespace-nowrap text-center flex items-center justify-center gap-2"
            >
              <Edit2 className="w-4 h-4" /> Edit Draft
            </Link>
            <button 
              onClick={handleSubmitForApproval}
              disabled={submitMutation.isPending}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-[#C8FF00] text-black font-mono font-black text-xs tracking-widest hover:bg-white transition-colors uppercase disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2 border-2 border-black shadow-[2px_2px_0px_#000]"
            >
              <Send className="w-4 h-4" />
              {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval ↗'}
            </button>
          </div>
        </div>
      )}

      {event.state === 'PENDING_APPROVAL' && (
        <div className="p-6 border-2 border-[#0057FF] bg-[#0057FF]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[4px_4px_0px_#000]">
          <div>
            <h3 className="text-sm font-mono font-bold text-[#3b82f6] uppercase tracking-widest mb-1 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Awaiting Higher Approval
            </h3>
            <p className="text-xs text-[#a0a4b8] font-mono">This event proposal is queued for faculty review. Modifications are frozen during review.</p>
          </div>
        </div>
      )}

      {event.state === 'PUBLISHED' && (
        <div className="p-6 border-2 border-[#C8FF00] bg-[#C8FF00]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[4px_4px_0px_#000]">
          <div>
            <h3 className="text-sm font-mono font-black text-[#C8FF00] uppercase tracking-widest mb-1 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Published & Live
            </h3>
            <p className="text-xs text-[#a0a4b8] font-mono">Event is visible on the student directory. Registrations and tickets are active.</p>
          </div>
          {isClubAdmin && lockState === 'UNLOCKED' && (
            <div className="flex gap-3 w-full sm:w-auto">
              <Link 
                href={`/student/events/${eventId}/manage/edit`}
                className="flex-1 sm:flex-none px-5 py-2.5 border-2 border-[#C8FF00] text-[#C8FF00] font-mono font-bold text-xs tracking-widest hover:bg-[#C8FF00] hover:text-black transition-colors uppercase whitespace-nowrap text-center flex items-center justify-center gap-2"
              >
                <Edit2 className="w-4 h-4" /> Edit Event & Forms
              </Link>
            </div>
          )}
        </div>
      )}

      {event.state === 'REJECTED' && (
        <div className="p-6 border-2 border-[#FF3B30] bg-[#FF3B30]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[4px_4px_0px_#000]">
          <div>
            <h3 className="text-sm font-mono font-bold text-[#FF3B30] uppercase tracking-widest mb-1 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Rejected Proposal
            </h3>
            <p className="text-xs text-[#a0a4b8] font-mono">
              Event proposal was declined during faculty review.
              {(event.metadata as any)?.rejection_reason && (
                <span className="block mt-2 font-bold text-[#FF3B30]">Reason: {(event.metadata as any).rejection_reason}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {event.state === 'ARCHIVED' && (
        <div className="p-6 border-2 border-white/20 bg-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[4px_4px_0px_#000]">
          <div>
            <h3 className="text-sm font-mono font-bold text-white/70 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Archived Event
            </h3>
            <p className="text-xs text-[#a0a4b8] font-mono">Event records are archived and stored in read-only mode.</p>
          </div>
        </div>
      )}

      {/* EVENT LIFECYCLE (LOCK / UNLOCK) */}
      {(showLockEvent || showUnlockEvent || lockState === 'PERMANENTLY_LOCKED') && (
        <div className="p-6 border-2 border-white/15 bg-[#090a0f] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[4px_4px_0px_#000]">
          <div>
            <h3 className="text-sm font-mono font-bold text-[#F5F5F2] uppercase tracking-widest mb-1 flex items-center gap-2">
              {lockState === 'UNLOCKED' ? <Unlock className="w-4 h-4 text-[#C8FF00]" /> : <Lock className="w-4 h-4 text-[#FF3B30]" />}
              Lifecycle Gate
            </h3>
            <p className="text-xs text-[#a0a4b8] font-mono">
              {lockState === 'UNLOCKED' ? 'Event is live. Student registrations and squad mutations are permitted.' :
               lockState === 'MANUALLY_LOCKED' ? 'Event is manually locked. Registrations and cancellations are paused.' :
               'Event is permanently frozen (concluded over 24h ago).'}
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {showLockEvent && (
              <button 
                onClick={() => setIsLockModalOpen(true)}
                disabled={lockMutation.isPending}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-[#FF3B30] text-white font-mono font-bold text-xs tracking-widest hover:bg-[#d63026] transition-colors uppercase disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2 border-2 border-[#FF3B30] shadow-[2px_2px_0px_#000]"
              >
                <Lock className="w-4 h-4" />
                {lockMutation.isPending ? 'Locking...' : 'Lock Event'}
              </button>
            )}
            {showUnlockEvent && (
              <button 
                onClick={() => setIsUnlockModalOpen(true)}
                disabled={unlockMutation.isPending}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-[#0057FF] text-white font-mono font-bold text-xs tracking-widest hover:bg-[#0042c7] transition-colors uppercase disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2 border-2 border-[#0057FF] shadow-[2px_2px_0px_#000]"
              >
                <Unlock className="w-4 h-4" />
                {unlockMutation.isPending ? 'Unlocking...' : 'Unlock Event'}
              </button>
            )}
            {lockState !== 'UNLOCKED' && !showUnlockEvent && (
              <div className="px-5 py-2.5 border-2 border-white/20 bg-white/5 text-[#a0a4b8] font-mono font-bold text-xs tracking-widest uppercase whitespace-nowrap flex items-center justify-center">
                LOCKED — READ-ONLY
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-6 border-2 border-white/15 bg-[#090a0f] flex flex-col justify-between shadow-[4px_4px_0px_#000]">
          <div className="flex items-center gap-2 text-[#a0a4b8] mb-4">
            <Users className="w-4 h-4 text-[#0057FF]" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Enlisted Students</span>
          </div>
          <div className="text-3xl font-black text-[#F5F5F2]" style={{ fontFamily: "'Syne', sans-serif" }}>
            {event.registrationCount}
            {event.maxCapacity && <span className="text-sm font-mono text-[#a0a4b8] ml-2">/ {event.maxCapacity}</span>}
          </div>
        </div>

        {event.registrationType === 'TEAM' && (
          <div className="p-6 border-2 border-white/15 bg-[#090a0f] flex flex-col justify-between shadow-[4px_4px_0px_#000]">
            <div className="flex items-center gap-2 text-[#a0a4b8] mb-4">
              <ShieldAlert className="w-4 h-4 text-[#0057FF]" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Squad Units</span>
            </div>
            <div className="text-3xl font-black text-[#F5F5F2]" style={{ fontFamily: "'Syne', sans-serif" }}>
              Active
            </div>
          </div>
        )}

      </div>

      {/* Lock Modal */}
      <Modal 
        isOpen={isLockModalOpen} 
        onClose={() => !lockMutation.isPending && setIsLockModalOpen(false)} 
        title="FREEZE EVENT"
      >
        <div className="p-6 pt-2 font-sans space-y-6">
          <p className="text-xs font-mono text-[#a0a4b8] leading-relaxed">
            Are you sure you want to freeze this event? Locking prevents any further registrations, waitlisting, or squad operations.
          </p>
          {lockMutation.isError && (
            <div className="p-3 bg-[#FF3B30]/15 border-2 border-[#FF3B30] text-[#FF3B30] text-xs font-mono">
              {(lockMutation.error as any)?.data?.error || lockMutation.error?.message || 'Failed to lock event'}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-white/10">
            <button 
              onClick={() => setIsLockModalOpen(false)}
              disabled={lockMutation.isPending}
              className="px-5 py-2.5 text-xs font-mono font-bold tracking-widest text-[#a0a4b8] hover:text-white border-2 border-white/20 uppercase transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                lockMutation.mutate(eventId, {
                  onSuccess: () => setIsLockModalOpen(false)
                });
              }}
              disabled={lockMutation.isPending}
              className="px-5 py-2.5 text-xs font-mono font-bold tracking-widest bg-[#FF3B30] hover:bg-[#d63026] text-white uppercase border-2 border-[#FF3B30] shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50"
            >
              {lockMutation.isPending ? 'Locking...' : 'Confirm Freeze ↗'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unlock Modal */}
      <Modal 
        isOpen={isUnlockModalOpen} 
        onClose={() => !unlockMutation.isPending && setIsUnlockModalOpen(false)} 
        title="UNFREEZE EVENT"
      >
        <div className="p-6 pt-2 font-sans space-y-6">
          <p className="text-xs font-mono text-[#a0a4b8] leading-relaxed">
            Are you sure you want to unfreeze this event? This will re-enable student pass registration and squad roster changes.
          </p>
          {unlockMutation.isError && (
            <div className="p-3 bg-[#FF3B30]/15 border-2 border-[#FF3B30] text-[#FF3B30] text-xs font-mono">
              {(unlockMutation.error as any)?.data?.error || unlockMutation.error?.message || 'Failed to unlock event'}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-white/10">
            <button 
              onClick={() => setIsUnlockModalOpen(false)}
              disabled={unlockMutation.isPending}
              className="px-5 py-2.5 text-xs font-mono font-bold tracking-widest text-[#a0a4b8] hover:text-white border-2 border-white/20 uppercase transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                unlockMutation.mutate(eventId, {
                  onSuccess: () => setIsUnlockModalOpen(false)
                });
              }}
              disabled={unlockMutation.isPending}
              className="px-5 py-2.5 text-xs font-mono font-bold tracking-widest bg-[#0057FF] hover:bg-[#0042c7] text-white uppercase border-2 border-[#0057FF] shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50"
            >
              {unlockMutation.isPending ? 'Unlocking...' : 'Confirm Unfreeze ↗'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
