/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useTransferLeadership, Team, TeamMember } from '../../../../../../../hooks/useTeams';
import { Modal } from '../../../../../../../components/ui/Modal';
import { AlertTriangle } from 'lucide-react';

interface TransferLeadershipModalProps {
  eventId: string;
  team: Team;
  isOpen: boolean;
  onClose: () => void;
}

export function TransferLeadershipModal({ eventId, team, isOpen, onClose }: TransferLeadershipModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { mutate: transferLeadership, isPending } = useTransferLeadership(eventId);

  const eligibleMembers = team.members.filter((m: TeamMember) => m.user_id !== team.leader_id);

  if (!isOpen) return null;

  const handleTransfer = () => {
    setErrorMsg(null);
    if (!selectedMemberId) {
      setErrorMsg('Please select a member to transfer leadership to.');
      return;
    }

    transferLeadership(
      { teamId: team.id, newLeaderId: selectedMemberId },
      {
        onSuccess: () => {
          onClose();
          setSelectedMemberId(null);
        },
        onError: (err: any) => {
          setErrorMsg(err.message || 'Failed to transfer leadership. Please try again.');
        },
      }
    );
  };

  const handleClose = () => {
    if (!isPending) {
      onClose();
      setSelectedMemberId(null);
      setErrorMsg(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="TRANSFER SQUAD LEADERSHIP">
      <div className="p-6 pt-2 font-sans">
        <div className="mb-6 p-4 bg-[#FFF8E6] dark:bg-[#FF9500]/15 border-2 border-[#D97706] dark:border-[#FF9500] text-[#B45309] dark:text-[#FF9500] text-xs font-mono" role="alert">
          <div className="flex items-center gap-2 font-bold mb-1 uppercase tracking-widest text-xs">
            <AlertTriangle className="w-4 h-4" />
            Warning: Irreversible Action
          </div>
          <p className="leading-relaxed">If you transfer leadership, you will become a regular member and yield control of the squad roster.</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-[#FF3B30]/15 border-2 border-[#FF3B30] text-[#D32F2F] dark:text-[#FF3B30] text-xs font-mono font-bold uppercase" role="alert">
            {errorMsg}
          </div>
        )}

        <div className="mb-8">
          <h3 className="text-xs font-mono font-bold tracking-[0.2em] text-[#475467] dark:text-[#a0a4b8] uppercase mb-3">
            Select Successor
          </h3>
          
          {eligibleMembers.length === 0 ? (
            <p className="font-mono text-xs text-[#475467] dark:text-[#a0a4b8] border border-dashed border-black/15 dark:border-white/15 p-4 text-center">
              There are no other members currently in this squad.
            </p>
          ) : (
            <div className="space-y-2">
              {eligibleMembers.map((member: TeamMember) => (
                <button
                  key={member.user_id}
                  onClick={() => setSelectedMemberId(member.user_id)}
                  disabled={isPending}
                  className={`w-full flex items-center justify-between p-3.5 border-2 transition-all text-left disabled:opacity-50 ${
                    selectedMemberId === member.user_id 
                      ? 'border-[#0057FF] bg-[#0057FF]/15 text-[#0057FF] dark:text-white shadow-[3px_3px_0px_#000]' 
                      : 'border-black/15 dark:border-white/15 bg-[#F8F9FA] dark:bg-[#0e1017] text-[#0A0D14] dark:text-[#F5F5F2] hover:border-black/40 dark:hover:border-white/40'
                  }`}
                >
                  <div className="font-bold text-xs uppercase font-mono">{member.full_name}</div>
                  {selectedMemberId === member.user_id && (
                    <div className="w-2.5 h-2.5 bg-[#0057FF] shadow-[1px_1px_0px_#000] dark:shadow-[1px_1px_0px_#fff]"></div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={handleClose}
            disabled={isPending}
            className="w-full sm:w-auto px-5 py-3 border-2 border-black/20 dark:border-white/20 text-[#475467] dark:text-[#a0a4b8] hover:text-black dark:hover:text-white hover:border-black dark:hover:border-white font-mono font-bold text-xs tracking-widest uppercase transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleTransfer}
            disabled={!selectedMemberId || isPending}
            className="w-full sm:flex-1 px-6 py-3 bg-[#FF3B30] text-white font-mono font-bold text-xs tracking-widest hover:bg-[#d63026] border-2 border-[#FF3B30] shadow-[4px_4px_0px_#000] uppercase disabled:opacity-50 transition-all flex items-center justify-center"
          >
            {isPending ? 'Processing...' : 'Confirm Transfer ↗'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
