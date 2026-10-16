import React, { useState, useMemo } from 'react';
import { Download, Search, RefreshCw, User, Calendar, ExternalLink } from 'lucide-react';
import { useEventFormResponses } from '../../hooks/useEventForms';
import { Modal } from '../ui/Modal';
import { exportSubmissionsToCSV } from '../../lib/form-studio-utils';

interface StudentFormResponsesModalProps {
  eventId: string;
  formId: string | null;
  formTitle: string;
  onClose: () => void;
}

export function StudentFormResponsesModal({
  eventId,
  formId,
  formTitle,
  onClose,
}: StudentFormResponsesModalProps) {
  const { data: rawResponses, isLoading, refetch, isFetching } = useEventFormResponses(eventId, formId);
  const [searchText, setSearchText] = useState('');
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Group responses by student registration
  const { submissions, fieldColumns } = useMemo(() => {
    if (!rawResponses || !Array.isArray(rawResponses)) {
      return { submissions: [], fieldColumns: [] };
    }

    const fieldMap = new Map<string, { id: string; label: string; key: string; fieldType: string }>();
    const submissionMap = new Map<
      string,
      {
        registrationId: string;
        user: { id: string; fullName: string; email: string };
        submittedAt: string;
        answers: Record<string, { value: string; fieldType: string }>;
      }
    >();

    rawResponses.forEach((row: any) => {
      if (row.fieldDefinition) {
        fieldMap.set(row.fieldDefinitionId, {
          id: row.fieldDefinition.id,
          label: row.fieldDefinition.label,
          key: row.fieldDefinition.key,
          fieldType: row.fieldDefinition.fieldType,
        });
      }

      const regId = row.eventRegistrationId;
      if (!submissionMap.has(regId)) {
        submissionMap.set(regId, {
          registrationId: regId,
          user: row.eventRegistration?.user || { id: 'unknown', fullName: 'Unknown Student', email: '-' },
          submittedAt: row.updatedAt || row.createdAt,
          answers: {},
        });
      }

      const sub = submissionMap.get(regId)!;
      sub.answers[row.fieldDefinitionId] = {
        value: row.value,
        fieldType: row.fieldDefinition?.fieldType || 'TEXT',
      };
    });

    return {
      submissions: Array.from(submissionMap.values()),
      fieldColumns: Array.from(fieldMap.values()),
    };
  }, [rawResponses]);

  // Filter submissions by query
  const filteredSubmissions = useMemo(() => {
    if (!searchText.trim()) return submissions;
    const q = searchText.toLowerCase();
    return submissions.filter(
      s =>
        s.user.fullName?.toLowerCase().includes(q) ||
        s.user.email?.toLowerCase().includes(q) ||
        Object.values(s.answers).some(a => a.value?.toLowerCase().includes(q))
    );
  }, [submissions, searchText]);

  // Export CSV
  const handleExportCSV = () => {
    if (submissions.length === 0) return;
    try {
      exportSubmissionsToCSV(formTitle, fieldColumns, submissions);
      setExportFeedback({
        type: 'success',
        text: `Exported ${submissions.length} submission${submissions.length === 1 ? '' : 's'} to CSV successfully.`,
      });
      setTimeout(() => setExportFeedback(null), 3000);
    } catch (err: any) {
      setExportFeedback({
        type: 'error',
        text: err.message || 'Failed to export CSV.',
      });
      setTimeout(() => setExportFeedback(null), 4000);
    }
  };

  return (
    <Modal
      isOpen={!!formId}
      onClose={onClose}
      title={`RESPONSES: ${formTitle}`}
      maxWidth="max-w-5xl"
    >
      <div className="p-6">
        {/* Export Feedback Notification */}
        {exportFeedback && (
          <div
            className={`mb-4 p-3 border-2 font-mono text-xs uppercase tracking-wider ${
              exportFeedback.type === 'success'
                ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF]'
                : 'bg-red-500/10 border-red-500 text-red-400'
            }`}
          >
            {exportFeedback.text}
          </div>
        )}

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-white/10">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a4b8]" />
            <input
              type="text"
              placeholder="Search by student, email, or response..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full bg-[#141721] border-2 border-white/15 pl-9 pr-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refetch()}
              className="p-2 border-2 border-white/20 text-[#a0a4b8] hover:text-white hover:border-white transition-all shadow-[2px_2px_0px_#000]"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={submissions.length === 0}
              className="px-4 py-2 border-2 border-white/20 hover:border-[#00E5FF] text-[#a0a4b8] hover:text-[#00E5FF] font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[2px_2px_0px_#000]"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Content Table */}
        {isLoading ? (
          <div className="text-[#a0a4b8] font-mono text-xs uppercase tracking-widest text-center py-16">
            Loading submissions...
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-white/15 bg-[#141721] p-6">
            <div className="font-mono text-sm text-[#F5F5F2] uppercase tracking-wider">
              No submissions recorded
            </div>
            <p className="text-xs text-[#a0a4b8] mt-1">
              Registered students will appear here once they complete this form.
            </p>
          </div>
        ) : (
          <div className="border-2 border-white/10 overflow-x-auto max-h-[55vh]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1a1d29] border-b-2 border-white/10 text-[10px] font-mono font-bold uppercase tracking-widest text-[#a0a4b8] sticky top-0 z-10">
                  <th className="p-3 border-r border-white/10 min-w-[200px]">Student</th>
                  <th className="p-3 border-r border-white/10 min-w-[150px]">Submitted At</th>
                  {fieldColumns.map(f => (
                    <th key={f.id} className="p-3 border-r border-white/10 min-w-[180px]">
                      <div>{f.label}</div>
                      <div className="text-[9px] text-[#00E5FF] font-normal">{f.fieldType}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#0e1017] font-mono text-xs">
                {filteredSubmissions.map(sub => (
                  <tr key={sub.registrationId} className="hover:bg-[#141721] transition-colors">
                    <td className="p-3 border-r border-white/10">
                      <div className="font-bold text-white">{sub.user.fullName}</div>
                      <div className="text-[11px] text-[#a0a4b8]">{sub.user.email}</div>
                    </td>
                    <td className="p-3 border-r border-white/10 text-[#a0a4b8] whitespace-nowrap text-[11px]">
                      {new Date(sub.submittedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    {fieldColumns.map(f => {
                      const ans = sub.answers[f.id];
                      if (!ans || !ans.value) {
                        return (
                          <td key={f.id} className="p-3 border-r border-white/10 text-white/30">
                            -
                          </td>
                        );
                      }

                      if (ans.fieldType === 'URL') {
                        return (
                          <td key={f.id} className="p-3 border-r border-white/10">
                            <a
                              href={ans.value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#00E5FF] hover:underline flex items-center gap-1 break-all"
                            >
                              <span className="truncate max-w-[220px]">{ans.value}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </td>
                        );
                      }

                      if (ans.fieldType === 'MULTI_SELECT') {
                        try {
                          const parsed = JSON.parse(ans.value);
                          if (Array.isArray(parsed)) {
                            return (
                              <td key={f.id} className="p-3 border-r border-white/10">
                                <div className="flex flex-wrap gap-1">
                                  {parsed.map((item, idx) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-[10px]"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            );
                          }
                        } catch {
                          // fallback
                        }
                      }

                      return (
                        <td key={f.id} className="p-3 border-r border-white/10 text-[#F5F5F2] break-words">
                          {ans.value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-between items-center pt-4 border-t-2 border-white/10">
          <div className="font-mono text-xs text-[#a0a4b8]">
            Total {filteredSubmissions.length} of {submissions.length} submission{submissions.length === 1 ? '' : 's'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border-2 border-white text-white hover:bg-white hover:text-black font-mono font-bold text-xs uppercase tracking-widest transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
