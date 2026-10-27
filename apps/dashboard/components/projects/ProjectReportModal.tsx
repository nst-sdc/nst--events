'use client';

import React, { useState } from 'react';
import { Flag, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { projectsApi } from '../../lib/projects-api';

interface ProjectReportModalProps {
  projectId: string;
  projectTitle: string;
}

const REPORT_REASONS = [
  { value: 'PLAGIARISM', label: 'Plagiarism or incorrect attribution' },
  { value: 'SPAM', label: 'Spam or misleading content' },
  { value: 'ABUSIVE', label: 'Abusive or prohibited material' },
  { value: 'VOTE_MANIPULATION', label: 'Suspicious vote manipulation' },
  { value: 'MALICIOUS_LINKS', label: 'Unsafe or malicious links' },
  { value: 'IP_PRIVACY', label: 'Intellectual-property or privacy concerns' },
  { value: 'OTHER', label: 'Other concern' },
];

export function ProjectReportModal({ projectId, projectTitle }: ProjectReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('PLAGIARISM');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await projectsApi.submitReport(projectId, reason, details);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setIsOpen(false);
        setDetails('');
      }, 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-label="Report this project"
      >
        <Flag className="w-3.5 h-3.5" />
        <span>Report project</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-2xl shadow-2xl relative text-left">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-900 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {submitted ? (
              <div className="py-8 text-center flex flex-col items-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mb-3" />
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Report Received
                </h3>
                <p className="mt-1 text-xs text-zinc-400 max-w-sm">
                  Thank you for keeping our student showcase trustworthy. A platform moderator will review this submission confidentially.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex items-center gap-2 text-amber-400 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Report Project
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Reporting: <strong className="text-zinc-200">{projectTitle}</strong>. Your identity remains private and confidential.
                </p>

                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-300">
                    {error}
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                      Reason for report *
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-[#0057FF]"
                    >
                      {REPORT_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                      Additional details (optional)
                    </label>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      rows={3}
                      placeholder="Please provide any context or links to help our moderation team verify the issue..."
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] leading-relaxed"
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
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
