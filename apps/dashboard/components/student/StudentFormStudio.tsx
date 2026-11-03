import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Settings,
  Eye,
  Edit2,
  Copy,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle,
  FileText,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  useAttachableFieldDefinitions,
  useCreateFieldDefinition,
  FieldDefinition,
  FieldType,
} from '../../hooks/useFieldDefinitions';
import {
  useEventFormFields,
  useUpdateEventFormFields,
  EventFormField,
} from '../../hooks/useEventFormFields';
import {
  useEventForms,
  useCreateEventForm,
  useUpdateEventForm,
  useDeleteEventForm,
  useDuplicateEventForm,
  usePublishEventForm,
  useUnpublishEventForm,
  EventForm,
  EventFormWithFields,
} from '../../hooks/useEventForms';
import { apiClient } from '../../lib/api';
import {
  QUESTION_PRESETS,
  QuestionPreset,
  generateFieldKey,
  getFormAvailability,
  validateScheduleTimeRange,
  getLocalTimezoneDisplay,
  validateFormTitle,
  validateQuestionChoices,
} from '../../lib/form-studio-utils';
import { QuestionCardPreview } from '../forms/QuestionCardPreview';
import { StudentEventFormFieldsConfigModal } from './StudentEventFormFieldsConfigModal';
import { StudentFormResponsesModal } from './StudentFormResponsesModal';
import { Modal } from '../ui/Modal';

interface StudentFormStudioProps {
  eventId: string;
  defaultTab?: 'registration' | 'forms';
}

export function StudentFormStudio({ eventId, defaultTab = 'registration' }: StudentFormStudioProps) {
  // Queries & Mutations for Registration Fields
  const { data: allFieldDefinitions } = useAttachableFieldDefinitions();
  const { data: serverEventFields, isLoading: isLoadingRegFields } = useEventFormFields(eventId);
  const { mutateAsync: saveEventFields, isPending: isSavingRegFields } = useUpdateEventFormFields(eventId);
  const { mutateAsync: createFieldDefinition, isPending: isCreatingDef } = useCreateFieldDefinition();

  // Queries & Mutations for In-Event Forms
  const { data: eventForms, isLoading: isLoadingForms } = useEventForms(eventId);
  const { mutateAsync: createForm, isPending: isCreatingForm } = useCreateEventForm(eventId);
  const { mutateAsync: updateForm, isPending: isUpdatingForm } = useUpdateEventForm(eventId);
  const { mutateAsync: deleteForm, isPending: isDeletingForm } = useDeleteEventForm(eventId);
  const { mutateAsync: duplicateForm, isPending: isDuplicatingForm } = useDuplicateEventForm(eventId);
  const { mutateAsync: publishForm, isPending: isPublishingForm } = usePublishEventForm(eventId);
  const { mutateAsync: unpublishForm, isPending: isUnpublishingForm } = useUnpublishEventForm(eventId);
  const [unpublishingFormItem, setUnpublishingFormItem] = useState<EventForm | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'registration' | 'forms'>(defaultTab);

  // Registration Questions Local State
  const [localQuestions, setLocalQuestions] = useState<EventFormField[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals for Registration Questions
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isCreateQuestionModalOpen, setIsCreateQuestionModalOpen] = useState(false);

  // Create Custom Question State
  const [customLabel, setCustomLabel] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customType, setCustomType] = useState<FieldType>('TEXT');
  const [customOptions, setCustomOptions] = useState('');
  const [customReusable, setCustomReusable] = useState(true);
  const [customRequired, setCustomRequired] = useState(true);
  const [questionToRemove, setQuestionToRemove] = useState<EventFormField | null>(null);

  // Modals for In-Event Forms
  const [isCreateFormModalOpen, setIsCreateFormModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formPurpose, setFormPurpose] = useState<'SUBMISSION' | 'FEEDBACK' | 'CUSTOM'>('SUBMISSION');
  const [formReleaseAt, setFormReleaseAt] = useState('');
  const [formCloseAt, setFormCloseAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [editingForm, setEditingForm] = useState<EventForm | null>(null);
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);
  const [selectedFormForFields, setSelectedFormForFields] = useState<EventForm | null>(null);
  const [selectedFormForResponses, setSelectedFormForResponses] = useState<EventForm | null>(null);

  // Sync server registration fields to local state
  // Sync server registration fields only when not dirty
  useEffect(() => {
    if (serverEventFields && !isDirty) {
      setLocalQuestions(serverEventFields);
      setIsDirty(false);
    }
  }, [serverEventFields, isDirty]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Existing keys map for automatic key generation
  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    (allFieldDefinitions || []).forEach((f) => keys.add(f.key));
    localQuestions.forEach((q) => {
      if (q.fieldDefinition?.key) keys.add(q.fieldDefinition.key);
    });
    return keys;
  }, [allFieldDefinitions, localQuestions]);

  // Auto-dismiss feedback message after 4s
  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  // Preset addition (LOCAL DRAFT ONLY - zero backend requests)
  const handleAddPreset = (preset: QuestionPreset) => {
    setFeedbackMsg(null);
    if (localQuestions.some((q) => q.fieldDefinition?.key === preset.key)) {
      setFeedbackMsg({ type: 'error', text: `"${preset.label}" is already added to registration.` });
      return;
    }

    const existingDef = allFieldDefinitions?.find(
      (f) => f.key === preset.key || f.label.toLowerCase() === preset.label.toLowerCase()
    );

    const definition: FieldDefinition = existingDef || {
      id: `draft_${preset.key}`,
      key: preset.key,
      label: preset.label,
      fieldType: preset.fieldType,
      options: preset.options && preset.options.length > 0 ? preset.options : null,
      isReusable: preset.isReusable,
      createdByClubId: null,
      createdAt: new Date().toISOString(),
    };

    const newQuestion: EventFormField = {
      eventId,
      fieldDefinitionId: definition.id,
      isRequired: true,
      order: localQuestions.length,
      fieldDefinition: definition,
    };

    setLocalQuestions([...localQuestions, newQuestion]);
    setIsDirty(true);
    setFeedbackMsg({ type: 'success', text: `Added "${preset.label}" to registration questions (unsaved draft).` });
  };

  // Custom question creation (LOCAL DRAFT ONLY - zero backend requests)
  const handleCreateCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawLabel = customLabel.trim();
    if (!rawLabel) {
      setFeedbackMsg({ type: 'error', text: 'Question label cannot be empty.' });
      return;
    }
    if (rawLabel.length > 200) {
      setFeedbackMsg({ type: 'error', text: 'Question label cannot exceed 200 characters.' });
      return;
    }
    setFeedbackMsg(null);

    let parsedOptions: string[] | undefined = undefined;
    if (['SELECT', 'MULTI_SELECT', 'RADIO'].includes(customType)) {
      const choiceValidation = validateQuestionChoices(customType, customOptions);
      if (!choiceValidation.isValid) {
        setFeedbackMsg({ type: 'error', text: choiceValidation.error || 'Invalid choice options.' });
        return;
      }
      parsedOptions = choiceValidation.cleanedOptions;
    }

    const generatedKey = customKey.trim() || generateFieldKey(rawLabel, existingKeys);

    if (localQuestions.some((q) => q.fieldDefinition?.key === generatedKey)) {
      setFeedbackMsg({ type: 'error', text: `A question with key "${generatedKey}" is already in this form.` });
      return;
    }

    const existingDef = allFieldDefinitions?.find((f) => f.key === generatedKey);

    const draftDef: FieldDefinition = existingDef || {
      id: `draft_${generatedKey}`,
      key: generatedKey,
      label: rawLabel,
      fieldType: customType,
      options: parsedOptions && parsedOptions.length > 0 ? parsedOptions : null,
      isReusable: customReusable,
      createdByClubId: null,
      createdAt: new Date().toISOString(),
    };

    const newQuestion: EventFormField = {
      eventId,
      fieldDefinitionId: draftDef.id,
      isRequired: customRequired,
      order: localQuestions.length,
      fieldDefinition: draftDef,
    };

    setLocalQuestions([...localQuestions, newQuestion]);
    setIsDirty(true);
    setIsCreateQuestionModalOpen(false);
    setCustomLabel('');
    setCustomKey('');
    setCustomOptions('');
    setFeedbackMsg({ type: 'success', text: `Added "${draftDef.label}" to registration questions (unsaved draft).` });
  };

  // Attach existing question
  const handleAttachExisting = (fieldDef: FieldDefinition) => {
    if (localQuestions.some((q) => q.fieldDefinitionId === fieldDef.id)) return;

    const newQuestion: EventFormField = {
      eventId,
      fieldDefinitionId: fieldDef.id,
      isRequired: true,
      order: localQuestions.length,
      fieldDefinition: fieldDef,
    };

    setLocalQuestions([...localQuestions, newQuestion]);
    setIsDirty(true);
    setIsAttachModalOpen(false);
    setFeedbackMsg({ type: 'success', text: `Attached "${fieldDef.label}".` });
  };

  // Ordering
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === localQuestions.length - 1)
    ) {
      return;
    }

    const next = [...localQuestions];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;

    next.forEach((item, idx) => {
      item.order = idx;
    });

    setLocalQuestions(next);
    setIsDirty(true);
  };

  // Toggle Required
  const handleToggleRequired = (fieldDefId: string, isRequired: boolean) => {
    setLocalQuestions(
      localQuestions.map((q) => (q.fieldDefinitionId === fieldDefId ? { ...q, isRequired } : q))
    );
    setIsDirty(true);
  };

  // Remove Question
  const handleRemoveQuestion = (fieldDefId: string) => {
    const updated = localQuestions
      .filter((q) => q.fieldDefinitionId !== fieldDefId)
      .map((q, idx) => ({ ...q, order: idx }));
    setLocalQuestions(updated);
    setIsDirty(true);
    setFeedbackMsg({ type: 'success', text: 'Question removed.' });
  };

  // Save Registration Questions (Atomic batch save)
  const handleSaveRegistrationQuestions = async () => {
    if (isSavingRegFields) return;
    setFeedbackMsg(null);
    try {
      // Validate questions
      for (const q of localQuestions) {
        if (!q.fieldDefinition?.label?.trim()) {
          setFeedbackMsg({ type: 'error', text: 'All questions must have a non-empty label.' });
          return;
        }
        if (['SELECT', 'MULTI_SELECT', 'RADIO'].includes(q.fieldDefinition.fieldType)) {
          const choiceRes = validateQuestionChoices(q.fieldDefinition.fieldType, q.fieldDefinition.options);
          if (!choiceRes.isValid) {
            setFeedbackMsg({ type: 'error', text: `Question "${q.fieldDefinition.label}": ${choiceRes.error}` });
            return;
          }
        }
      }

      const payloadFields = localQuestions.map((q) => {
        const isDraft = !q.fieldDefinitionId || q.fieldDefinitionId.startsWith('draft_');
        if (!isDraft) {
          return {
            fieldDefinitionId: q.fieldDefinitionId,
            isRequired: q.isRequired,
            order: q.order,
          };
        }
        return {
          definition: {
            key: q.fieldDefinition!.key,
            label: q.fieldDefinition!.label,
            fieldType: q.fieldDefinition!.fieldType,
            options: q.fieldDefinition!.options && q.fieldDefinition!.options.length > 0 ? q.fieldDefinition!.options : undefined,
            isReusable: q.fieldDefinition!.isReusable ?? true,
          },
          isRequired: q.isRequired,
          order: q.order,
        };
      });

      const res = await saveEventFields({ fields: payloadFields });
      if (res && (res as any).data) {
        setLocalQuestions((res as any).data);
      }
      setIsDirty(false);
      setFeedbackMsg({ type: 'success', text: 'Registration questionnaire saved successfully.' });
    } catch (err: any) {
      // Retain full local draft on error
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to save questionnaire.' });
    }
  };

  // In-Event Form Handlers
  const handleOpenCreateForm = () => {
    setFormTitle('');
    setFormPurpose('SUBMISSION');
    setFormReleaseAt('');
    setFormCloseAt('');
    setFormError(null);
    setIsCreateFormModalOpen(true);
  };

  const handleCreateFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const titleValidation = validateFormTitle(formTitle, eventForms || []);
    if (!titleValidation.isValid) {
      setFormError(titleValidation.error);
      return;
    }
    setFormError(null);

    const releaseISO = formReleaseAt ? new Date(formReleaseAt).toISOString() : null;
    const closeISO = formCloseAt ? new Date(formCloseAt).toISOString() : null;

    const timeErr = validateScheduleTimeRange(releaseISO, closeISO);
    if (timeErr) {
      setFormError(timeErr);
      return;
    }

    try {
      await createForm({
        title: formTitle.trim(),
        purpose: formPurpose,
        releaseAt: releaseISO,
        closeAt: closeISO,
      });
      setIsCreateFormModalOpen(false);
      setFeedbackMsg({ type: 'success', text: 'Scheduled form created successfully.' });
    } catch (err: any) {
      setFormError(err.message || 'Failed to create form.');
    }
  };

  const handleOpenEditForm = (formItem: EventForm) => {
    setEditingForm(formItem);
    setFormTitle(formItem.title);
    setFormReleaseAt(formItem.releaseAt ? formItem.releaseAt.slice(0, 16) : '');
    setFormCloseAt(formItem.closeAt ? formItem.closeAt.slice(0, 16) : '');
    setFormError(null);
  };

  const handleEditFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingForm) return;

    const titleValidation = validateFormTitle(formTitle, eventForms || [], editingForm.id);
    if (!titleValidation.isValid) {
      setFormError(titleValidation.error);
      return;
    }
    setFormError(null);

    const releaseISO = formReleaseAt ? new Date(formReleaseAt).toISOString() : null;
    const closeISO = formCloseAt ? new Date(formCloseAt).toISOString() : null;

    const timeErr = validateScheduleTimeRange(releaseISO, closeISO);
    if (timeErr) {
      setFormError(timeErr);
      return;
    }

    try {
      await updateForm({
        formId: editingForm.id,
        data: {
          title: formTitle.trim(),
          releaseAt: releaseISO,
          closeAt: closeISO,
        },
      });
      setEditingForm(null);
      setFeedbackMsg({ type: 'success', text: 'Form schedule updated.' });
    } catch (err: any) {
      setFormError(err.message || 'Failed to update form.');
    }
  };

  const handleDeleteFormConfirm = async () => {
    if (!deletingFormId) return;
    try {
      await deleteForm(deletingFormId);
      setDeletingFormId(null);
      setFeedbackMsg({ type: 'success', text: 'Form deleted.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to delete form.' });
    }
  };

  const handleDuplicateForm = async (formItem: EventForm) => {
    try {
      await duplicateForm({
        formId: formItem.id,
        title: formItem.title,
        purpose: formItem.purpose,
      });
      setFeedbackMsg({ type: 'success', text: `Duplicated "${formItem.title}".` });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to duplicate form.' });
    }
  };

  const handlePublishForm = async (formItem: EventForm) => {
    try {
      // Pre-flight check: validate form has at least 1 question
      const detail = await apiClient<EventFormWithFields>(`/v1/events/${eventId}/forms/${formItem.id}`);
      if (!detail.fields || detail.fields.length === 0) {
        setFeedbackMsg({
          type: 'error',
          text: 'Cannot publish a form with no questions. Add at least one question first.',
        });
        return;
      }
      await publishForm(formItem.id);
      const isPast = formItem.closeAt && new Date(formItem.closeAt).getTime() < Date.now();
      setFeedbackMsg({
        type: 'success',
        text: isPast
          ? `Published "${formItem.title}". Note: its closing deadline is in the past, so the form is currently closed for submissions.`
          : `Published "${formItem.title}". Form is now available according to its schedule.`,
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to publish form.',
      });
    }
  };

  const handleConfirmUnpublish = async () => {
    if (!unpublishingFormItem) return;
    try {
      await unpublishForm(unpublishingFormItem.id);
      setFeedbackMsg({
        type: 'success',
        text: `Unpublished "${unpublishingFormItem.title}". Form returned to draft.`,
      });
      setUnpublishingFormItem(null);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to unpublish form.',
      });
    }
  };

  const availableToAttach = (allFieldDefinitions || []).filter(
    (f) => !localQuestions.some((q) => q.fieldDefinitionId === f.id)
  );

  return (
    <section className="mb-8 border-2 border-black/15 dark:border-white/10 bg-white dark:bg-[#0e1017]">
      {/* STUDIO HEADER */}
      <div className="bg-zinc-100 dark:bg-[#141721] border-b-2 border-black/10 dark:border-white/10 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 bg-[#0057FF]"></span>
            <span className="font-mono text-xs font-bold text-[#0057FF] dark:text-[#00E5FF] tracking-widest uppercase">
              ORGANIZER CONTROL
            </span>
          </div>
          <h2 className="font-mono font-black text-zinc-900 dark:text-white text-xl tracking-wide uppercase">
            FORM STUDIO
          </h2>
          <p className="text-xs font-mono text-zinc-500 dark:text-[#a0a4b8] mt-0.5">
            Configure registration requirements and scheduled milestone forms
          </p>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex border-2 border-black/20 dark:border-white/20 bg-zinc-200 dark:bg-[#090a0f] p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('registration')}
            className={`px-4 py-2 font-mono text-xs font-bold tracking-wider uppercase flex items-center gap-2 transition-all ${
              activeTab === 'registration'
                ? 'bg-[#0057FF] text-white shadow-[2px_2px_0px_#000]'
                : 'text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Registration ({localQuestions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('forms')}
            className={`px-4 py-2 font-mono text-xs font-bold tracking-wider uppercase flex items-center gap-2 transition-all ${
              activeTab === 'forms'
                ? 'bg-[#0057FF] text-white shadow-[2px_2px_0px_#000]'
                : 'text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            In-Event Forms ({eventForms?.length || 0})
          </button>
        </div>
      </div>

      {/* NOTIFICATION FEEDBACK TOAST */}
      {feedbackMsg && (
        <div
          className={`px-6 py-3 border-b border-black/10 dark:border-white/10 font-mono text-xs flex items-center gap-2 uppercase tracking-wide ${
            feedbackMsg.type === 'success'
              ? 'bg-[#C8FF00]/15 text-emerald-800 dark:text-[#C8FF00] border-emerald-500/30 dark:border-[#C8FF00]/30'
              : 'bg-red-500/15 text-red-700 dark:text-[#FF3B30] border-red-500/30 dark:border-[#FF3B30]/30'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {feedbackMsg.text}
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 1: REGISTRATION QUESTIONNAIRE                          */}
      {/* ============================================================== */}
      {activeTab === 'registration' && (
        <div className="p-6 space-y-6">
          {/* UNSAVED CHANGES BANNER */}
          {isDirty && (
            <div className="p-4 border-2 border-[#FF9500] bg-[#FF9500]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[3px_3px_0px_#000]">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-[#FF9500] shrink-0" />
                <div>
                  <div className="font-mono font-bold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">
                    Unsaved Questionnaire Changes
                  </div>
                  <div className="font-mono text-[11px] text-zinc-600 dark:text-[#a0a4b8]">
                    Questions or requirement rules have been modified. Click Save to persist.
                  </div>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setLocalQuestions(serverEventFields || []);
                    setIsDirty(false);
                  }}
                  className="px-3 py-2 border border-black/20 dark:border-white/20 text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white font-mono text-xs font-bold uppercase tracking-wider"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveRegistrationQuestions}
                  disabled={isSavingRegFields}
                  className="px-4 py-2 bg-[#0057FF] text-white hover:bg-[#0042c7] border border-[#0057FF] font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-[2px_2px_0px_#000]"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingRegFields ? 'Saving...' : 'Save Questionnaire'}
                </button>
              </div>
            </div>
          )}

          {/* PRESETS BAR */}
          <div className="p-4 bg-zinc-50 dark:bg-[#141721] border-2 border-black/10 dark:border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-[#C8FF00]" />
              <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Instant Presets (1-Click Add)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {QUESTION_PRESETS.map((preset) => {
                const isAdded = localQuestions.some((q) => q.fieldDefinition?.key === preset.key);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isAdded}
                    onClick={() => handleAddPreset(preset)}
                    className={`p-3 text-left border font-mono transition-all flex flex-col justify-between ${
                      isAdded
                        ? 'bg-zinc-100 dark:bg-[#090a0f] border-black/5 dark:border-white/5 opacity-50 cursor-not-allowed'
                        : 'bg-white dark:bg-[#090a0f] border-black/15 dark:border-white/15 hover:border-[#0057FF] hover:bg-zinc-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">{preset.label}</span>
                      <span className="text-[10px] text-[#0057FF] dark:text-[#00E5FF] px-1.5 py-0.5 border border-[#0057FF]/30 dark:border-[#00E5FF]/30">
                        {preset.fieldType}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-[#a0a4b8] mt-1 line-clamp-1">
                      {isAdded ? '✓ Already Added' : preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* IMMUTABILITY BANNER */}
          <div className="p-3 bg-[#0057FF]/5 dark:bg-[#0057FF]/10 border border-[#0057FF]/20 dark:border-[#0057FF]/30 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#0057FF] dark:text-[#00E5FF] shrink-0 mt-0.5" />
            <p className="font-mono text-[11px] text-zinc-600 dark:text-[#a0a4b8] leading-relaxed">
              <strong className="text-zinc-900 dark:text-white">FIELD DEFINITIONS ARE IMMUTABLE:</strong> Field types, choice options, and machine keys cannot be altered once created to preserve historical responses. You can freely reorder questions, toggle required status, or remove/replace them.
            </p>
          </div>

          {/* TOOLBAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div>
              <h3 className="font-mono text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wide">
                Registration Questions ({localQuestions.length})
              </h3>
              <p className="font-mono text-xs text-zinc-500 dark:text-[#a0a4b8]">
                Questions presented to students during the event registration flow
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAttachModalOpen(true)}
                className="px-3 py-2 border-2 border-black/20 dark:border-white/20 text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white font-mono text-xs font-bold tracking-wider uppercase transition-all"
              >
                Attach Pool Field
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomLabel('');
                  setCustomKey('');
                  setCustomType('TEXT');
                  setCustomOptions('');
                  setCustomReusable(true);
                  setCustomRequired(true);
                  setIsCreateQuestionModalOpen(true);
                }}
                className="px-4 py-2 bg-[#0057FF] text-white border-2 border-[#0057FF] hover:bg-[#0042c7] font-mono text-xs font-bold tracking-widest uppercase flex items-center gap-2 shadow-[2px_2px_0px_#000] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Custom Question
              </button>
              <button
                type="button"
                disabled={!isDirty || isSavingRegFields}
                onClick={handleSaveRegistrationQuestions}
                className="px-4 py-2 bg-[#0057FF] text-white border-2 border-[#0057FF] hover:bg-[#0042c7] disabled:opacity-50 font-mono text-xs font-bold tracking-widest uppercase flex items-center gap-2 shadow-[2px_2px_0px_#000] transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingRegFields ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* QUESTION CARDS LIST */}
          {localQuestions.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-black/15 dark:border-white/15 bg-zinc-50 dark:bg-[#090a0f] text-center space-y-3">
              <FileText className="w-8 h-8 text-zinc-400 dark:text-white/30 mx-auto" />
              <div className="font-mono text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                No Registration Questions Added
              </div>
              <p className="font-mono text-xs text-zinc-500 dark:text-[#a0a4b8] max-w-md mx-auto">
                Students will register with standard profile information only. Click any preset above or create custom questions to ask for project repos, food preferences, or T-shirt sizes.
              </p>
              <button
                type="button"
                onClick={() => handleAddPreset(QUESTION_PRESETS[0])}
                className="mt-2 px-4 py-2 border-2 border-[#0057FF] text-[#0057FF] hover:bg-[#0057FF] hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-all"
              >
                + Add GitHub Profile Preset
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {localQuestions.map((q, idx) => {
                const def = q.fieldDefinition;
                return (
                  <div
                    key={q.fieldDefinitionId}
                    className="p-5 border-2 border-black/15 dark:border-white/15 bg-white dark:bg-[#141721] space-y-4 shadow-[3px_3px_0px_#000]"
                  >
                    {/* CARD HEADER */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-3">
                      <div className="flex items-start gap-3">
                        <span className="px-2 py-0.5 bg-[#0057FF] text-white font-mono text-xs font-bold">
                          #{idx + 1}
                        </span>
                        <div>
                          <h4 className="font-mono font-bold text-zinc-900 dark:text-white text-base tracking-wide flex items-center gap-2">
                            {def.label}
                            {q.isRequired && <span className="text-[#FF3B30]">*</span>}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-black/40 border border-[#0057FF]/30 dark:border-[#00E5FF]/40 text-[#0057FF] dark:text-[#00E5FF] font-mono text-[10px] uppercase">
                              {def.fieldType}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 border font-mono text-[10px] uppercase ${
                                def.isReusable
                                  ? 'border-[#0057FF]/40 text-[#0057FF] dark:text-[#60a5fa] bg-[#0057FF]/10'
                                  : 'border-black/20 dark:border-white/20 text-zinc-600 dark:text-[#a0a4b8] bg-black/5 dark:bg-white/5'
                              }`}
                            >
                              {def.isReusable ? 'Saves to Student Profile' : 'Event-Only Answer'}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-400 dark:text-white/40">
                              key: {def.key}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CARD CONTROLS */}
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 font-mono text-xs text-zinc-900 dark:text-[#F5F5F2] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.isRequired}
                            onChange={(e) =>
                              handleToggleRequired(q.fieldDefinitionId, e.target.checked)
                            }
                            className="accent-[#0057FF] w-4 h-4 cursor-pointer"
                          />
                          <span>Required</span>
                        </label>

                        <div className="flex border border-black/20 dark:border-white/20 bg-zinc-100 dark:bg-black/40">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveQuestion(idx, 'up')}
                            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === localQuestions.length - 1}
                            onClick={() => handleMoveQuestion(idx, 'down')}
                            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent border-l border-black/20 dark:border-white/20"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setQuestionToRemove(q)}
                          className="p-1.5 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 border border-red-500/30 transition-all"
                          title="Remove from form"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* LIVE INTERACTIVE PREVIEW */}
                    <QuestionCardPreview
                      label={def.label}
                      fieldType={def.fieldType}
                      options={def.options}
                      isRequired={q.isRequired}
                      theme="student"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 2: IN-EVENT SCHEDULED FORMS                            */}
      {/* ============================================================== */}
      {activeTab === 'forms' && (
        <div className="p-6 space-y-6">
          {/* TOOLBAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-mono text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wide">
                In-Event Forms & Milestones ({eventForms?.length || 0})
              </h3>
              <p className="font-mono text-xs text-zinc-500 dark:text-[#a0a4b8]">
                Independently scheduled project milestone submissions, surveys, and checkpoints
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateForm}
              className="px-4 py-2 bg-[#0057FF] text-white border-2 border-[#0057FF] hover:bg-[#0042c7] font-mono text-xs font-bold tracking-widest uppercase flex items-center gap-2 shadow-[2px_2px_0px_#000] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Form
            </button>
          </div>

          {/* TIMEZONE & AVAILABILITY NOTICE */}
          <div className="p-3 bg-zinc-50 dark:bg-[#090a0f] border border-black/10 dark:border-white/10 flex items-center gap-2 text-xs font-mono text-zinc-600 dark:text-[#a0a4b8]">
            <Clock className="w-4 h-4 text-[#0057FF] dark:text-[#00E5FF] shrink-0" />
            <span>
              Server-enforced availability interval is <code>[releaseAt, closeAt)</code>. Timestamps reflect {getLocalTimezoneDisplay()}.
            </span>
          </div>

          {/* SCHEDULED FORM CARDS LIST */}
          {(!eventForms || eventForms.length === 0) ? (
            <div className="p-8 border-2 border-dashed border-black/15 dark:border-white/15 bg-zinc-50 dark:bg-[#090a0f] text-center space-y-3">
              <Calendar className="w-8 h-8 text-zinc-400 dark:text-white/30 mx-auto" />
              <div className="font-mono text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                No In-Event Forms Created
              </div>
              <p className="font-mono text-xs text-zinc-500 dark:text-[#a0a4b8] max-w-md mx-auto">
                Create milestone checkpoints, project repo submissions, or post-event feedback surveys scheduled around your event schedule.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateForm}
                className="mt-2 px-4 py-2 border-2 border-[#0057FF] text-[#0057FF] hover:bg-[#0057FF] hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-all"
              >
                + Create In-Event Form
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {eventForms.map((formItem) => {
                const avail = getFormAvailability(formItem);
                const purposeBadges: Record<string, string> = {
                  SUBMISSION: 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10',
                  FEEDBACK: 'text-orange-600 dark:text-orange-400 border-orange-500/30 bg-orange-500/10',
                  CUSTOM: 'text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10',
                  REGISTRATION: 'text-cyan-700 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
                };

                return (
                  <div
                    key={formItem.id}
                    className="p-5 border-2 border-black/15 dark:border-white/15 bg-white dark:bg-[#141721] space-y-4 shadow-[3px_3px_0px_#000]"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-mono font-bold text-zinc-900 dark:text-white text-base tracking-wide">
                            {formItem.title}
                          </h4>
                          <span
                            className={`px-2 py-0.5 border font-mono text-[10px] uppercase font-bold ${
                              purposeBadges[formItem.purpose] || 'text-zinc-700 dark:text-white border-black/20 dark:border-white/20'
                            }`}
                          >
                            {formItem.purpose}
                          </span>
                          <span
                            className={`px-2 py-0.5 border font-mono text-[10px] uppercase font-bold flex items-center gap-1.5 ${
                              avail.status === 'open'
                                ? 'text-emerald-800 dark:text-[#C8FF00] border-emerald-500/40 dark:border-[#C8FF00]/40 bg-emerald-500/10 dark:bg-[#C8FF00]/10'
                                : avail.status === 'scheduled'
                                  ? 'text-[#0057FF] dark:text-[#00E5FF] border-[#0057FF]/40 dark:border-[#00E5FF]/40 bg-[#0057FF]/10 dark:bg-[#00E5FF]/10'
                                  : avail.status === 'closed'
                                    ? 'text-zinc-600 dark:text-[#a0a4b8] border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5'
                                    : 'text-amber-700 dark:text-[#FFD700] border-amber-500/40 dark:border-[#FFD700]/40 bg-amber-500/10 dark:bg-[#FFD700]/10'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                avail.status === 'open'
                                  ? 'bg-emerald-500 dark:bg-[#C8FF00]'
                                  : avail.status === 'scheduled'
                                    ? 'bg-[#0057FF] dark:bg-[#00E5FF]'
                                    : avail.status === 'closed'
                                      ? 'bg-gray-400'
                                      : 'bg-amber-500 dark:bg-[#FFD700]'
                              }`}
                            ></span>
                            {avail.label}
                          </span>
                        </div>

                        {/* SCHEDULE DETAILS */}
                        <div className="mt-2 text-xs font-mono text-zinc-600 dark:text-[#a0a4b8] space-y-0.5">
                          {avail.status === 'draft' && (
                            <div className="text-amber-700 dark:text-yellow-400/90 text-xs font-mono font-medium">
                              Draft: Hidden from students. Publish when ready.
                            </div>
                          )}
                          <div>
                            <span className="text-zinc-500 dark:text-white/60">Release: </span>
                            {formItem.releaseAt ? (
                              <span className="text-zinc-900 dark:text-white">
                                {new Date(formItem.releaseAt).toLocaleString()}
                              </span>
                            ) : (
                              <span>Immediate (available upon release)</span>
                            )}
                          </div>
                          <div>
                            <span className="text-zinc-500 dark:text-white/60">Close Deadline: </span>
                            {formItem.closeAt ? (
                              <span className="text-zinc-900 dark:text-white">
                                {new Date(formItem.closeAt).toLocaleString()}
                              </span>
                            ) : (
                              <span>No deadline (open indefinitely)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex flex-wrap items-center gap-2">
                        {formItem.publishedAt ? (
                          <button
                            type="button"
                            onClick={() => setUnpublishingFormItem(formItem)}
                            className="px-3 py-1.5 border border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                          >
                            Unpublish
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isPublishingForm}
                            onClick={() => handlePublishForm(formItem)}
                            className="px-3 py-1.5 bg-[#0057FF] hover:bg-[#0047D4] text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            Publish Form
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedFormForFields(formItem)}
                          className="px-3 py-1.5 bg-white dark:bg-[#090a0f] border border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white text-zinc-900 dark:text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Questions
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedFormForResponses(formItem)}
                          className="px-3 py-1.5 bg-white dark:bg-[#090a0f] border border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white text-zinc-900 dark:text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Responses
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditForm(formItem)}
                          className="px-3 py-1.5 bg-white dark:bg-[#090a0f] border border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white text-zinc-900 dark:text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isDuplicatingForm}
                          onClick={() => handleDuplicateForm(formItem)}
                          className="px-3 py-1.5 bg-white dark:bg-[#090a0f] border border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white text-zinc-900 dark:text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 transition-all"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Clone
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingFormId(formItem.id)}
                          className="px-3 py-1.5 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE CUSTOM QUESTION MODAL */}
      <Modal
        isOpen={isCreateQuestionModalOpen}
        onClose={() => setIsCreateQuestionModalOpen(false)}
        title="CREATE CUSTOM QUESTION"
      >
        <form onSubmit={handleCreateCustomQuestion} className="p-6 bg-white dark:bg-[#0d0e12] text-zinc-900 dark:text-white space-y-4">
          <div>
            <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
              Question Prompt / Label *
            </label>
            <input
              type="text"
              required
              value={customLabel}
              onChange={(e) => {
                setCustomLabel(e.target.value);
                setCustomKey(generateFieldKey(e.target.value, existingKeys));
              }}
              placeholder="e.g. Project Repository URL or T-Shirt Size"
              className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
              Machine Key (Auto-Generated) *
            </label>
            <input
              type="text"
              required
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="e.g. project_repository_url"
              className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
              Supported Field Type *
            </label>
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value as FieldType)}
              className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
            >
              <option value="TEXT">TEXT (Single line free text)</option>
              <option value="URL">URL (Validated web address)</option>
              <option value="EMAIL">EMAIL (Validated email format)</option>
              <option value="NUMBER">NUMBER (Validated numeric value)</option>
              <option value="PHONE">PHONE (Validated phone number)</option>
              <option value="SELECT">SELECT (Single choice dropdown)</option>
              <option value="MULTI_SELECT">MULTI_SELECT (Checkboxes multi-choice)</option>
              <option value="RADIO">RADIO (Radio buttons single choice)</option>
            </select>
          </div>

          {['SELECT', 'MULTI_SELECT', 'RADIO'].includes(customType) && (
            <div>
              <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
                Options (comma-separated) *
              </label>
              <input
                type="text"
                required
                value={customOptions}
                onChange={(e) => setCustomOptions(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
                className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2">
            <label className="flex items-center gap-2 font-mono text-xs text-zinc-600 dark:text-[#a0a4b8] cursor-pointer">
              <input
                type="checkbox"
                checked={customReusable}
                onChange={(e) => setCustomReusable(e.target.checked)}
                className="accent-[#0057FF] w-4 h-4"
              />
              <span>Save to Student Profile</span>
            </label>
            <label className="flex items-center gap-2 font-mono text-xs text-zinc-600 dark:text-[#a0a4b8] cursor-pointer">
              <input
                type="checkbox"
                checked={customRequired}
                onChange={(e) => setCustomRequired(e.target.checked)}
                className="accent-[#0057FF] w-4 h-4"
              />
              <span>Required Answer</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => setIsCreateQuestionModalOpen(false)}
              className="px-4 py-2 border border-black/20 dark:border-white/20 text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white font-mono text-xs uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingDef}
              className="px-5 py-2 bg-[#0057FF] text-white hover:bg-[#0042c7] font-mono text-xs font-bold uppercase tracking-widest shadow-[2px_2px_0px_#000]"
            >
              {isCreatingDef ? 'Creating...' : 'Create & Add'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ATTACH EXISTING FIELD MODAL */}
      <Modal
        isOpen={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        title="ATTACH POOL QUESTION"
      >
        <div className="p-6 bg-white dark:bg-[#0d0e12] text-zinc-900 dark:text-white space-y-3 max-h-[420px] overflow-y-auto">
          {availableToAttach.length === 0 ? (
            <p className="font-mono text-xs text-zinc-500 dark:text-[#a0a4b8] text-center py-6">
              All existing pool questions have already been attached.
            </p>
          ) : (
            availableToAttach.map((field) => (
              <div
                key={field.id}
                className="p-3 border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-[#141721] flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-mono font-bold text-xs text-zinc-900 dark:text-white">{field.label}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] text-[#0057FF] dark:text-[#00E5FF] px-1 bg-zinc-100 dark:bg-black/40 border border-[#0057FF]/30 dark:border-[#00E5FF]/30">
                      {field.fieldType}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500 dark:text-[#a0a4b8]">
                      {field.isReusable ? 'Reusable' : 'Event-Only'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAttachExisting(field)}
                  className="px-3 py-1 bg-[#0057FF] text-white hover:bg-[#0042c7] font-mono text-xs font-bold uppercase tracking-wider"
                >
                  Attach
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* CREATE IN-EVENT FORM MODAL */}
      <Modal
        isOpen={isCreateFormModalOpen}
        onClose={() => setIsCreateFormModalOpen(false)}
        title="CREATE IN-EVENT FORM"
      >
        <form onSubmit={handleCreateFormSubmit} className="p-6 bg-white dark:bg-[#0d0e12] text-zinc-900 dark:text-white space-y-4">
          {formError && (
            <div className="p-3 bg-red-500/10 border border-[#FF3B30] text-[#FF3B30] font-mono text-xs uppercase">
              {formError}
            </div>
          )}

          <div>
            <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
              Form Title *
            </label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Midpoint Milestone Submission, Post-Event Feedback"
              className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
              Form Purpose *
            </label>
            <select
              value={formPurpose}
              onChange={(e) => setFormPurpose(e.target.value as any)}
              className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
            >
              <option value="SUBMISSION">SUBMISSION (Milestone or project artifacts)</option>
              <option value="FEEDBACK">FEEDBACK (Event ratings and surveys)</option>
              <option value="CUSTOM">CUSTOM (Custom in-event questionnaire)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
                Release Time (Opening)
              </label>
              <input
                type="datetime-local"
                value={formReleaseAt}
                onChange={(e) => setFormReleaseAt(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
              />
              <span className="block font-mono text-[10px] text-zinc-500 dark:text-white/40 mt-1">
                Leave empty for immediate opening
              </span>
            </div>
            <div>
              <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
                Closing Deadline
              </label>
              <input
                type="datetime-local"
                value={formCloseAt}
                onChange={(e) => setFormCloseAt(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
              />
              <span className="block font-mono text-[10px] text-zinc-500 dark:text-white/40 mt-1">
                Leave empty for no closing deadline
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => setIsCreateFormModalOpen(false)}
              className="px-4 py-2 border border-black/20 dark:border-white/20 text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white font-mono text-xs uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingForm}
              className="px-5 py-2 bg-[#0057FF] text-white hover:bg-[#0042c7] font-mono text-xs font-bold uppercase tracking-widest shadow-[2px_2px_0px_#000]"
            >
              {isCreatingForm ? 'Creating...' : 'Create Form'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT IN-EVENT FORM SCHEDULE MODAL */}
      <Modal
        isOpen={!!editingForm}
        onClose={() => setEditingForm(null)}
        title="EDIT FORM SCHEDULE"
      >
        <form onSubmit={handleEditFormSubmit} className="p-6 bg-white dark:bg-[#0d0e12] text-zinc-900 dark:text-white space-y-4">
          {formError && (
            <div className="p-3 bg-red-500/10 border border-[#FF3B30] text-[#FF3B30] font-mono text-xs uppercase">
              {formError}
            </div>
          )}

          <div>
            <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
              Form Title *
            </label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
                Release Time (Opening)
              </label>
              <input
                type="datetime-local"
                value={formReleaseAt}
                onChange={(e) => setFormReleaseAt(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase text-zinc-600 dark:text-[#a0a4b8] mb-1">
                Closing Deadline
              </label>
              <input
                type="datetime-local"
                value={formCloseAt}
                onChange={(e) => setFormCloseAt(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-2 text-zinc-900 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => setEditingForm(null)}
              className="px-4 py-2 border border-black/20 dark:border-white/20 text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white font-mono text-xs uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdatingForm}
              className="px-5 py-2 bg-[#0057FF] text-white hover:bg-[#0042c7] font-mono text-xs font-bold uppercase tracking-widest shadow-[2px_2px_0px_#000]"
            >
              {isUpdatingForm ? 'Updating...' : 'Save Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!deletingFormId}
        onClose={() => setDeletingFormId(null)}
        title="DELETE SCHEDULED FORM"
      >
        <div className="p-6 bg-white dark:bg-[#0d0e12] text-zinc-900 dark:text-white space-y-4">
          <p className="font-mono text-xs text-zinc-600 dark:text-[#a0a4b8] leading-relaxed">
            Are you sure you want to delete this scheduled form? All attached form questions and submitted answers will be deleted.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeletingFormId(null)}
              className="px-4 py-2 border border-black/20 dark:border-white/20 text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white font-mono text-xs uppercase"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteFormConfirm}
              disabled={isDeletingForm}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold uppercase tracking-wider"
            >
              {isDeletingForm ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIGURE QUESTIONS MODAL */}
      {selectedFormForFields && (
        <StudentEventFormFieldsConfigModal
          eventId={eventId}
          formId={selectedFormForFields.id}
          formTitle={selectedFormForFields.title}
          onClose={() => setSelectedFormForFields(null)}
        />
      )}

      {/* RESPONSES VIEWER MODAL */}
      {selectedFormForResponses && (
        <StudentFormResponsesModal
          eventId={eventId}
          formId={selectedFormForResponses.id}
          formTitle={selectedFormForResponses.title}
          onClose={() => setSelectedFormForResponses(null)}
        />
      )}

      {/* UNPUBLISH CONFIRMATION MODAL */}
      <Modal
        isOpen={!!unpublishingFormItem}
        onClose={() => setUnpublishingFormItem(null)}
        title="UNPUBLISH FORM"
        maxWidth="max-w-md"
      >
        <div className="p-6 bg-white dark:bg-[#0d0e12] text-zinc-900 dark:text-white space-y-4">
          <p className="font-mono text-xs text-zinc-600 dark:text-[#a0a4b8] leading-relaxed">
            Are you sure you want to unpublish <span className="text-zinc-900 dark:text-white font-bold">{unpublishingFormItem?.title}</span>?
          </p>
          <p className="font-mono text-xs text-amber-700 dark:text-[#FF9500] bg-amber-500/10 p-3 border border-amber-500/20 leading-relaxed">
            Students will no longer be able to see or submit responses to this form. All existing questions and responses will remain preserved.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setUnpublishingFormItem(null)}
              className="px-4 py-2 border border-black/20 dark:border-white/20 text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white font-mono text-xs uppercase"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmUnpublish}
              disabled={isUnpublishingForm}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-mono text-xs font-bold uppercase tracking-wider"
            >
              {isUnpublishingForm ? 'Unpublishing...' : 'Confirm Unpublish'}
            </button>
          </div>
        </div>
      </Modal>

      {/* REMOVE QUESTION CONFIRMATION MODAL */}
      <Modal
        isOpen={!!questionToRemove}
        onClose={() => setQuestionToRemove(null)}
        title="REMOVE QUESTION"
        maxWidth="max-w-md"
      >
        <div className="p-6 bg-white dark:bg-[#0d0e12] text-zinc-900 dark:text-white space-y-4">
          <p className="font-mono text-xs text-zinc-600 dark:text-[#a0a4b8] leading-relaxed">
            Are you sure you want to remove <span className="text-zinc-900 dark:text-white font-bold">{questionToRemove?.fieldDefinition.label}</span> from this event's registration questions?
          </p>
          <p className="font-mono text-xs text-[#0057FF] dark:text-[#00E5FF] bg-[#0057FF]/10 dark:bg-[#00E5FF]/10 p-3 border border-[#0057FF]/20 dark:border-[#00E5FF]/20 leading-relaxed">
            Any existing registration answers submitted by students will remain safely preserved in the database.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setQuestionToRemove(null)}
              className="px-4 py-2 border border-black/20 dark:border-white/20 text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white font-mono text-xs uppercase"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (questionToRemove) {
                  handleRemoveQuestion(questionToRemove.fieldDefinitionId);
                  setQuestionToRemove(null);
                }
              }}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold uppercase tracking-wider"
            >
              Confirm Remove
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
