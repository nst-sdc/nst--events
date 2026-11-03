/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useSubmitAttendanceDispute } from '../../../../../../hooks/useAttendance';
import { X, AlertCircle } from 'lucide-react';

interface AttendanceDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  sessionId: string;
}

export function AttendanceDisputeModal({ isOpen, onClose, eventId, sessionId }: AttendanceDisputeModalProps) {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { mutate: submitDispute, isPending } = useSubmitAttendanceDispute(eventId);

  if (!isOpen) return null;

  const handleSubmit = () => {
    setErrorMsg(null);
    if (!reason.trim()) {
      setErrorMsg('A reason is required to submit a dispute.');
      return;
    }

    submitDispute(
      { session_id: sessionId, reason: reason.trim() },
      {
        onSuccess: () => {
          onClose();
          setReason('');
        },
        onError: (err: any) => {
          if (err?.data?.error?.code === 'U0048' || err?.data?.code === 'U0048') {
            setErrorMsg('Dispute window expired.');
          } else if (err?.data?.error?.code === 'U0054' || err?.data?.code === 'U0054') {
            setErrorMsg('Attendance already recorded.');
          } else {
            setErrorMsg(err.message || 'Failed to submit dispute. Please try again.');
          }
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg bg-white dark:bg-[#090a0f] border-3 border-black dark:border-[#F5F5F2] shadow-[12px_12px_0px_#0057FF] flex flex-col max-h-[90vh] overflow-hidden text-zinc-900 dark:text-[#F5F5F2] animate-in zoom-in-95 duration-150">
        
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0057FF] via-[#059669] dark:via-[#C8FF00] to-[#0057FF] shrink-0" />

        <div className="p-6 pb-4 border-b-2 border-zinc-200 dark:border-white/15 flex justify-between items-start bg-zinc-50 dark:bg-[#0e1017] shrink-0">
          <div>
            <span className="font-mono text-[10px] text-[#0057FF] uppercase tracking-[2px] font-bold block mb-1">
              LEDGER DISPUTE
            </span>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-[#F5F5F2] uppercase tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              Report Attendance Issue
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="border-2 border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 hover:bg-[#FF3B30] hover:border-[#FF3B30] text-zinc-600 dark:text-[#a0a4b8] hover:text-white p-1.5 transition-colors shadow-[2px_2px_0px_#0A0D14] dark:shadow-[2px_2px_0px_#000]" 
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-white dark:bg-[#07080b]">
          {errorMsg && (
            <div className="mb-6 p-4 bg-[#FF3B30]/15 border-2 border-[#FF3B30] text-[#FF3B30] text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <p className="font-mono text-xs text-zinc-600 dark:text-[#a0a4b8] leading-relaxed">
              If you attended this session but your status is not marked, submit an audit request with your verification context.
            </p>
            <div className="space-y-2">
              <label htmlFor="dispute-reason" className="block font-mono text-xs font-bold tracking-widest text-zinc-900 dark:text-[#F5F5F2] uppercase">
                Explanation & Context *
              </label>
              <textarea
                id="dispute-reason"
                className="w-full min-h-[120px] p-3.5 font-mono text-xs border-2 border-black/20 dark:border-white/20 focus:border-[#0057FF] outline-none resize-y bg-zinc-50 dark:bg-[#0e1017] text-zinc-900 dark:text-[#F5F5F2] transition-colors"
                placeholder="Detail your check-in time, seat/room coordinates, or coordinator contact..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        <div className="p-5 border-t-2 border-zinc-200 dark:border-white/15 flex flex-col sm:flex-row justify-end gap-3 bg-zinc-50 dark:bg-[#0e1017] shrink-0">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-5 py-2.5 font-mono text-xs font-bold tracking-widest uppercase text-zinc-700 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white bg-transparent border-2 border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            aria-disabled={isPending}
            className="px-6 py-2.5 font-mono text-xs font-bold tracking-widest uppercase text-white bg-[#0057FF] hover:bg-[#0042c7] border-2 border-[#0057FF] shadow-[4px_4px_0px_#0A0D14] dark:shadow-[4px_4px_0px_#000] transition-all disabled:opacity-50 flex items-center justify-center min-w-[140px]"
          >
            {isPending ? 'SUBMITTING...' : 'SUBMIT DISPUTE ↗'}
          </button>
        </div>
      </div>
    </div>
  );
}
