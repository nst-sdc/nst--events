import React, { useState } from 'react';
import { Plus, Settings, Eye, Edit2, Trash2, Clock, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import { useEventForms, useCreateEventForm, useUpdateEventForm, useDeleteEventForm, EventForm } from '../../hooks/useEventForms';
import { StudentEventFormFieldsConfigModal } from './StudentEventFormFieldsConfigModal';
import { StudentFormResponsesModal } from './StudentFormResponsesModal';
import { Modal } from '../ui/Modal';

interface StudentEventFormsManagerProps {
  eventId: string;
}

export function StudentEventFormsManager({ eventId }: StudentEventFormsManagerProps) {
  const { data: forms, isLoading } = useEventForms(eventId);
  const { mutateAsync: createForm, isPending: isCreating } = useCreateEventForm(eventId);
  const { mutateAsync: updateForm, isPending: isUpdating } = useUpdateEventForm(eventId);
  const { mutateAsync: deleteForm } = useDeleteEventForm(eventId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<EventForm | null>(null);
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);
  const [selectedFormForFields, setSelectedFormForFields] = useState<EventForm | null>(null);
  const [selectedFormForResponses, setSelectedFormForResponses] = useState<EventForm | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState<'SUBMISSION' | 'FEEDBACK' | 'CUSTOM'>('SUBMISSION');
  const [releaseAt, setReleaseAt] = useState('');
  const [closeAt, setCloseAt] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setTitle('');
    setPurpose('SUBMISSION');
    setReleaseAt('');
    setCloseAt('');
    setErrorMsg(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (form: EventForm) => {
    setEditingForm(form);
    setTitle(form.title);
    setPurpose(form.purpose as any);
    setReleaseAt(form.releaseAt ? form.releaseAt.slice(0, 16) : '');
    setCloseAt(form.closeAt ? form.closeAt.slice(0, 16) : '');
    setErrorMsg(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setErrorMsg(null);

    try {
      await createForm({
        title: title.trim(),
        purpose,
        releaseAt: releaseAt ? new Date(releaseAt).toISOString() : null,
        closeAt: closeAt ? new Date(closeAt).toISOString() : null,
      });
      setIsCreateOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create form');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingForm || !title.trim()) return;
    setErrorMsg(null);

    try {
      await updateForm({
        formId: editingForm.id,
        data: {
          title: title.trim(),
          releaseAt: releaseAt ? new Date(releaseAt).toISOString() : null,
          closeAt: closeAt ? new Date(closeAt).toISOString() : null,
        },
      });
      setEditingForm(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update form');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingFormId) return;
    try {
      await deleteForm(deletingFormId);
      setDeletingFormId(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete form');
    }
  };

  const getStatusBadge = (form: EventForm) => {
    const now = new Date();
    const release = form.releaseAt ? new Date(form.releaseAt) : null;
    const close = form.closeAt ? new Date(form.closeAt) : null;

    if (release && release > now) {
      return (
        <span className="px-2 py-0.5 border border-[#FFE600]/40 bg-[#FFE600]/10 text-[#FFE600] font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> Scheduled
        </span>
      );
    }
    if (close && close <= now) {
      return (
        <span className="px-2 py-0.5 border border-white/20 bg-white/5 text-[#a0a4b8] font-mono text-[10px] font-bold uppercase tracking-wider">
          Closed
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 border border-[#00E5FF]/40 bg-[#00E5FF]/10 text-[#00E5FF] font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
        <CheckCircle className="w-2.5 h-2.5" /> Active
      </span>
    );
  };

  const getPurposeTag = (p: string) => {
    switch (p) {
      case 'SUBMISSION':
        return <span className="text-[#00E5FF] font-mono text-[10px] tracking-wider font-bold">[SUBMISSION]</span>;
      case 'FEEDBACK':
        return <span className="text-[#FFE600] font-mono text-[10px] tracking-wider font-bold">[FEEDBACK]</span>;
      default:
        return <span className="text-purple-400 font-mono text-[10px] tracking-wider font-bold">[{p}]</span>;
    }
  };

  return (
    <section className="mb-8 border-2 border-white/10 bg-[#0e1017]">
      {/* Header */}
      <div className="bg-[#1a1d29] border-b-2 border-white/10 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-mono font-bold text-white text-lg tracking-wide uppercase flex items-center gap-2">
            <span className="w-2 h-2 bg-[#FFE600]"></span>
            Scheduled Event Forms
          </h2>
          <p className="text-sm font-mono text-[#a0a4b8] mt-1">
            Create submission checkpoints, mid-event questions, or feedback forms with custom release windows.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#FFE600] text-black border-2 border-[#FFE600] hover:bg-[#e6cf00] font-mono font-bold text-xs tracking-widest uppercase flex items-center gap-2 shadow-[2px_2px_0px_#000] transition-all self-start md:self-auto"
        >
          <Plus className="w-3.5 h-3.5" /> Create Form
        </button>
      </div>

      {/* Forms List */}
      <div className="p-6">
        {isLoading ? (
          <div className="py-12 text-center font-mono text-xs text-[#a0a4b8] uppercase tracking-widest">
            Loading scheduled forms...
          </div>
        ) : !forms || forms.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-white/15 bg-[#141721] p-6">
            <Calendar className="w-8 h-8 text-[#a0a4b8] mx-auto mb-2 opacity-50" />
            <div className="font-mono text-sm text-[#F5F5F2] uppercase tracking-wider">
              No scheduled forms configured
            </div>
            <p className="text-xs text-[#a0a4b8] mt-1 mb-4">
              Add submissions, quizzes, or feedback surveys that unlock for attendees at specific times.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-white text-black font-mono font-bold text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-[#FFE600]"
            >
              Create First Form
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {forms.map(form => (
              <div
                key={form.id}
                className="bg-[#141721] border-2 border-white/10 hover:border-white/20 transition-all p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-bold text-white tracking-wide truncate">
                      {form.title}
                    </span>
                    {getPurposeTag(form.purpose)}
                    {getStatusBadge(form)}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs text-[#a0a4b8]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/40">Release:</span>
                      <span>
                        {form.releaseAt
                          ? new Date(form.releaseAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Immediate'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/40">Close:</span>
                      <span>
                        {form.closeAt
                          ? new Date(form.closeAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Open Indefinitely'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedFormForFields(form)}
                    className="px-3 py-1.5 bg-[#1a1d29] border-2 border-white/20 hover:border-[#00E5FF] text-white hover:text-[#00E5FF] font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_#000]"
                  >
                    <Settings className="w-3.5 h-3.5" /> Fields
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFormForResponses(form)}
                    className="px-3 py-1.5 bg-[#1a1d29] border-2 border-white/20 hover:border-[#FFE600] text-white hover:text-[#FFE600] font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_#000]"
                  >
                    <Eye className="w-3.5 h-3.5" /> Responses
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(form)}
                    className="p-1.5 border-2 border-white/10 hover:border-white/40 text-[#a0a4b8] hover:text-white transition-colors"
                    title="Edit Schedule"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingFormId(form.id)}
                    className="p-1.5 border-2 border-white/10 hover:border-[#FF3B30] text-[#a0a4b8] hover:text-[#FF3B30] transition-colors"
                    title="Delete Form"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="NEW SCHEDULED FORM"
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border-2 border-[#FF3B30] text-[#FF3B30] font-mono text-xs">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                Form Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Project Demo Submission, Feedback Survey"
                className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#FFE600] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                Purpose *
              </label>
              <select
                value={purpose}
                onChange={e => setPurpose(e.target.value as any)}
                className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#FFE600] focus:outline-none"
              >
                <option value="SUBMISSION">Assignment / Project Submission</option>
                <option value="FEEDBACK">Post-Event Feedback</option>
                <option value="CUSTOM">Custom Questionnaire</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                  Release At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={releaseAt}
                  onChange={e => setReleaseAt(e.target.value)}
                  className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#FFE600] focus:outline-none"
                />
                <p className="text-[10px] font-mono text-[#a0a4b8]/70 mt-1">Empty = immediate</p>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                  Close At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={closeAt}
                  onChange={e => setCloseAt(e.target.value)}
                  className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#FFE600] focus:outline-none"
                />
                <p className="text-[10px] font-mono text-[#a0a4b8]/70 mt-1">Empty = no deadline</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t-2 border-white/10">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono font-bold text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-6 py-2 bg-[#FFE600] text-black border-2 border-[#FFE600] font-mono font-bold text-xs uppercase tracking-widest shadow-[2px_2px_0px_#000] hover:bg-[#e6cf00]"
              >
                {isCreating ? 'Creating...' : 'Create Form'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editingForm && (
        <Modal
          isOpen={!!editingForm}
          onClose={() => setEditingForm(null)}
          title="EDIT FORM SCHEDULE"
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border-2 border-[#FF3B30] text-[#FF3B30] font-mono text-xs">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                Form Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#FFE600] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                  Release At
                </label>
                <input
                  type="datetime-local"
                  value={releaseAt}
                  onChange={e => setReleaseAt(e.target.value)}
                  className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#FFE600] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                  Close At
                </label>
                <input
                  type="datetime-local"
                  value={closeAt}
                  onChange={e => setCloseAt(e.target.value)}
                  className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#FFE600] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t-2 border-white/10">
              <button
                type="button"
                onClick={() => setEditingForm(null)}
                className="px-4 py-2 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono font-bold text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="px-6 py-2 bg-white text-black border-2 border-white hover:bg-[#FFE600] hover:border-[#FFE600] font-mono font-bold text-xs uppercase tracking-widest shadow-[2px_2px_0px_#000]"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingFormId && (
        <Modal
          isOpen={!!deletingFormId}
          onClose={() => setDeletingFormId(null)}
          title="DELETE FORM"
          maxWidth="max-w-md"
        >
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-[#FF3B30] shrink-0 mt-0.5" />
              <div className="text-xs font-mono text-[#F5F5F2] leading-relaxed">
                Are you sure you want to permanently delete this form? All questions and student responses associated with it will be removed.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t-2 border-white/10">
              <button
                type="button"
                onClick={() => setDeletingFormId(null)}
                className="px-4 py-2 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono font-bold text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-5 py-2 bg-[#FF3B30] text-white border-2 border-[#FF3B30] font-mono font-bold text-xs uppercase tracking-wider hover:bg-red-700 shadow-[2px_2px_0px_#000]"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Fields Configuration Modal */}
      {selectedFormForFields && (
        <StudentEventFormFieldsConfigModal
          eventId={eventId}
          formId={selectedFormForFields.id}
          formTitle={selectedFormForFields.title}
          onClose={() => setSelectedFormForFields(null)}
        />
      )}

      {/* Responses Modal */}
      {selectedFormForResponses && (
        <StudentFormResponsesModal
          eventId={eventId}
          formId={selectedFormForResponses.id}
          formTitle={selectedFormForResponses.title}
          onClose={() => setSelectedFormForResponses(null)}
        />
      )}
    </section>
  );
}
