'use client';

import React, { useState } from 'react';
import { Flag, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { eventResultsApi } from '@/lib/event-results-api';

interface ResultReportModalProps {
  eventId: string;
  eventTitle: string;
}

export function ResultReportModal({ eventId, eventTitle }: ResultReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !details.trim()) {
      setError('Please provide both a reason and detailed description.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await eventResultsApi.submitReport(eventId, {
        reason: reason.trim(),
        details: details.trim(),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setReason('');
    setDetails('');
    setError(null);
    setSuccess(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/15 text-[#a0a4b8] hover:text-[#F5F5F2] hover:border-white/30 text-xs font-mono uppercase tracking-wider transition-all"
      >
        <Flag className="w-3.5 h-3.5" />
        <span>Report Inaccuracy or Dispute</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#090a0f] border-3 border-white/20 p-6 shadow-[8px_8px_0px_#000] flex flex-col gap-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-[#0057FF]">
                <Flag className="w-5 h-5" />
                <h3 className="font-mono text-sm font-black uppercase tracking-wider text-[#F5F5F2]">
                  Report Result Inaccuracy
                </h3>
              </div>
              <button onClick={handleClose} className="text-[#a0a4b8] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div className="py-6 flex flex-col items-center text-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <h4 className="font-mono text-sm font-bold uppercase text-[#F5F5F2]">
                  Report Submitted
                </h4>
                <p className="text-xs text-[#a0a4b8] max-w-sm">
                  Your report regarding results for <span className="text-white font-bold">{eventTitle}</span> has been logged. Event organizers and faculty administrators will review the official record.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-3 px-4 py-2 bg-[#0057FF] text-white font-mono text-xs font-bold uppercase"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <p className="text-xs text-[#a0a4b8]">
                  Submit an issue regarding misspelling, missing team member recognitions, or placement inaccuracies for this event.
                </p>

                {error && (
                  <div className="p-2.5 bg-red-950/40 border border-red-500 text-red-300 text-xs font-mono flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#a0a4b8] mb-1">
                    Subject / Category
                  </label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Unrecognized team member / name spelling"
                    className="w-full bg-[#050505] border border-white/20 p-2 text-xs text-[#F5F5F2] outline-none focus:border-[#0057FF]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#a0a4b8] mb-1">
                    Detailed Explanation
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Provide full details, team name, registration email, and correct information..."
                    className="w-full bg-[#050505] border border-white/20 p-2 text-xs text-[#F5F5F2] outline-none focus:border-[#0057FF]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3 py-1.5 text-xs font-mono text-[#a0a4b8] hover:text-white uppercase"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#0057FF] text-white font-mono text-xs font-black uppercase tracking-wider hover:bg-[#0047D4] transition-all shadow-[2px_2px_0px_#000] disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
