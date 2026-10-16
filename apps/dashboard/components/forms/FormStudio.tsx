import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Tabs,
  Button,
  Typography,
  Space,
  Tag,
  Badge,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Popconfirm,
  Alert,
  Tooltip,
  Empty,
  Row,
  Col,
  App,
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
  SettingOutlined,
  EyeOutlined,
  EditOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  FormOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
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
import { QuestionCardPreview } from './QuestionCardPreview';
import { EventFormFieldsConfigModal } from '../admin/EventFormFieldsConfigModal';
import { FormResponsesModal } from '../admin/FormResponsesModal';

const { Title, Text, Paragraph } = Typography;

interface FormStudioProps {
  eventId: string;
  defaultTab?: 'registration' | 'forms';
}

export function FormStudio({ eventId, defaultTab = 'registration' }: FormStudioProps) {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState<'registration' | 'forms'>(defaultTab);

  // Queries & Mutations for Registration Fields
  const { data: allFieldDefinitions, isLoading: isLoadingDefs } = useAttachableFieldDefinitions();
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

  // Registration Questions Local State
  const [localQuestions, setLocalQuestions] = useState<EventFormField[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Modals for Registration Questions
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isCreateQuestionModalOpen, setIsCreateQuestionModalOpen] = useState(false);
  const [customQuestionForm] = Form.useForm();

  // Modals for In-Event Forms
  const [isCreateFormModalOpen, setIsCreateFormModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<EventForm | null>(null);
  const [selectedFormForFields, setSelectedFormForFields] = useState<EventForm | null>(null);
  const [selectedFormForResponses, setSelectedFormForResponses] = useState<EventForm | null>(null);

  const [createFormInstance] = Form.useForm();
  const [editFormInstance] = Form.useForm();

  // Sync server registration fields to local state only when not dirty
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

  // Existing keys map for key generation
  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    (allFieldDefinitions || []).forEach((f) => keys.add(f.key));
    localQuestions.forEach((q) => {
      if (q.fieldDefinition?.key) keys.add(q.fieldDefinition.key);
    });
    return keys;
  }, [allFieldDefinitions, localQuestions]);

  // Handle preset one-click addition (LOCAL DRAFT ONLY - zero backend requests)
  const handleAddPreset = (preset: QuestionPreset) => {
    // 1. Check if already attached to this event draft
    if (localQuestions.some((q) => q.fieldDefinition?.key === preset.key)) {
      message.info(`"${preset.label}" is already added to registration.`);
      return;
    }

    // 2. Check if field definition exists in pool (reusable)
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

    // 3. Attach to local questions list without backend mutation
    const newQuestion: EventFormField = {
      eventId,
      fieldDefinitionId: definition.id,
      isRequired: true,
      order: localQuestions.length,
      fieldDefinition: definition,
    };

    setLocalQuestions([...localQuestions, newQuestion]);
    setIsDirty(true);
    message.success(`Added "${preset.label}" to questionnaire (unsaved draft).`);
  };

  // Handle custom question creation (LOCAL DRAFT ONLY - zero backend requests)
  const handleCreateCustomQuestion = async (values: any) => {
    try {
      const rawLabel = values.label?.trim();
      if (!rawLabel) {
        message.error('Question label cannot be empty.');
        return;
      }
      if (rawLabel.length > 100) {
        message.error('Question label cannot exceed 100 characters.');
        return;
      }

      const choiceValidation = validateQuestionChoices(values.fieldType, values.options);
      if (!choiceValidation.valid) {
        message.error(choiceValidation.error || 'Invalid choice options.');
        return;
      }

      const generatedKey = values.key?.trim() || generateFieldKey(rawLabel, existingKeys);

      if (localQuestions.some((q) => q.fieldDefinition?.key === generatedKey)) {
        message.error(`A question with key "${generatedKey}" is already in this form.`);
        return;
      }

      const existingDef = allFieldDefinitions?.find((f) => f.key === generatedKey);

      const draftDef: FieldDefinition = existingDef || {
        id: `draft_${generatedKey}`,
        key: generatedKey,
        label: rawLabel,
        fieldType: values.fieldType,
        options: choiceValidation.options && choiceValidation.options.length > 0 ? choiceValidation.options : null,
        isReusable: !!values.isReusable,
        createdByClubId: null,
        createdAt: new Date().toISOString(),
      };

      const newQuestion: EventFormField = {
        eventId,
        fieldDefinitionId: draftDef.id,
        isRequired: !!values.isRequired,
        order: localQuestions.length,
        fieldDefinition: draftDef,
      };

      setLocalQuestions([...localQuestions, newQuestion]);
      setIsDirty(true);
      setIsCreateQuestionModalOpen(false);
      customQuestionForm.resetFields();
      message.success(`Added "${draftDef.label}" to questionnaire (unsaved draft).`);
    } catch (err: any) {
      message.error(err.message || 'Failed to create question.');
    }
  };

  // Handle attaching existing question definition from pool
  const handleAttachExisting = (fieldDef: FieldDefinition) => {
    if (localQuestions.some((q) => q.fieldDefinitionId === fieldDef.id)) {
      message.info(`"${fieldDef.label}" is already added.`);
      return;
    }

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
    message.success(`Attached "${fieldDef.label}".`);
  };

  // Question Ordering
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
    message.success('Question removed from form.');
  };

  // Save Registration Questions (Atomic batch save)
  const handleSaveRegistrationQuestions = async () => {
    if (isSavingRegFields) return;

    try {
      // Validate all local questions before making request
      for (const q of localQuestions) {
        if (!q.fieldDefinition?.label?.trim()) {
          message.error('All questions must have a non-empty label.');
          return;
        }
        if (['SELECT', 'MULTI_SELECT', 'RADIO'].includes(q.fieldDefinition.fieldType)) {
          const choiceRes = validateQuestionChoices(q.fieldDefinition.fieldType, q.fieldDefinition.options);
          if (!choiceRes.valid) {
            message.error(`Question "${q.fieldDefinition.label}": ${choiceRes.error}`);
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
      message.success('Registration questionnaire saved successfully.');
    } catch (err: any) {
      // Retain full local draft on error
      message.error(err.message || 'Failed to save questionnaire.');
    }
  };

  // Reset unsaved changes
  const handleResetRegistrationQuestions = () => {
    setLocalQuestions(serverEventFields || []);
    setIsDirty(false);
    message.info('Changes reverted.');
  };

  const existingFormTitles = useMemo(() => {
    return (eventForms || []).map((f) => f.title);
  }, [eventForms]);

  // In-Event Form Handlers
  const handleCreateForm = async (values: any) => {
    const titleRes = validateFormTitle(values.title, existingFormTitles);
    if (!titleRes.isValid) {
      message.error(titleRes.error);
      return;
    }

    const releaseAtISO = values.releaseAt ? values.releaseAt.toISOString() : null;
    const closeAtISO = values.closeAt ? values.closeAt.toISOString() : null;

    const timeError = validateScheduleTimeRange(releaseAtISO, closeAtISO);
    if (timeError) {
      message.error(timeError);
      return;
    }

    try {
      await createForm({
        title: values.title.trim(),
        purpose: values.purpose,
        releaseAt: releaseAtISO,
        closeAt: closeAtISO,
      });
      message.success('Scheduled form created successfully.');
      setIsCreateFormModalOpen(false);
    } catch (err: any) {
      message.error(err.message || 'Failed to create form.');
    }
  };

  const handleOpenEditForm = (formItem: EventForm) => {
    setEditingForm(formItem);
  };

  const handleUpdateForm = async (values: any) => {
    if (!editingForm) return;

    const titleRes = validateFormTitle(values.title, eventForms || [], editingForm.id);
    if (!titleRes.isValid) {
      message.error(titleRes.error);
      return;
    }

    const releaseAtISO = values.releaseAt ? values.releaseAt.toISOString() : null;
    const closeAtISO = values.closeAt ? values.closeAt.toISOString() : null;

    const timeError = validateScheduleTimeRange(releaseAtISO, closeAtISO);
    if (timeError) {
      message.error(timeError);
      return;
    }

    try {
      await updateForm({
        formId: editingForm.id,
        data: {
          title: values.title.trim(),
          releaseAt: releaseAtISO,
          closeAt: closeAtISO,
        },
      });
      message.success('Form schedule updated.');
      setEditingForm(null);
    } catch (err: any) {
      message.error(err.message || 'Failed to update form.');
    }
  };

  const handleDeleteForm = async (formId: string) => {
    try {
      await deleteForm(formId);
      message.success('Form deleted.');
    } catch (err: any) {
      message.error(err.message || 'Failed to delete form.');
    }
  };

  const handleDuplicateForm = async (formItem: EventForm) => {
    try {
      await duplicateForm({
        formId: formItem.id,
        title: formItem.title,
        purpose: formItem.purpose,
      });
      message.success(`Duplicated "${formItem.title}".`);
    } catch (err: any) {
      message.error(err.message || 'Failed to duplicate form.');
    }
  };

  const handlePublishForm = async (formItem: EventForm) => {
    try {
      // Pre-flight check: validate form has at least 1 question
      const detail = await apiClient<EventFormWithFields>(`/v1/events/${eventId}/forms/${formItem.id}`);
      if (!detail.fields || detail.fields.length === 0) {
        message.error('Cannot publish a form with no questions. Add at least one question first.');
        return;
      }
      if (formItem.closeAt && new Date(formItem.closeAt) <= new Date()) {
        message.warning('Notice: Closing time is in the past. Form will be marked closed upon publishing.');
      }
      await publishForm(formItem.id);
      message.success(`Published "${formItem.title}". Form is now available according to its schedule.`);
    } catch (err: any) {
      message.error(err.message || 'Failed to publish form.');
    }
  };

  const handleUnpublishForm = async (formItem: EventForm) => {
    try {
      await unpublishForm(formItem.id);
      message.success(`Unpublished "${formItem.title}". Form returned to draft status.`);
    } catch (err: any) {
      message.error(err.message || 'Failed to unpublish form.');
    }
  };

  const availableToAttach = (allFieldDefinitions || []).filter(
    (f) => !localQuestions.some((q) => q.fieldDefinitionId === f.id)
  );

  return (
    <Card
      styles={{
        header: { borderBottom: '2px solid #f0f0f0', padding: '16px 24px' },
        body: { padding: '24px' },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: '#e6f4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1677ff',
            }}
          >
            <FormOutlined style={{ fontSize: 20 }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
              Form Studio
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Unified management for registration questions and in-event scheduled questionnaires
            </Text>
          </div>
        </div>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'registration' | 'forms')}
        items={[
          {
            key: 'registration',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <FormOutlined style={{ marginRight: 6 }} />
                Registration Questionnaire ({localQuestions.length})
              </span>
            ),
            children: (
              <div style={{ marginTop: 8 }}>
                {/* UNPAID CHANGES NOTICE */}
                {isDirty && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 20, borderRadius: 6 }}
                    title={
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <Text strong>You have unsaved changes to your registration questions.</Text>
                        <Space>
                          <Button size="small" onClick={handleResetRegistrationQuestions}>
                            Discard
                          </Button>
                          <Button
                            type="primary"
                            size="small"
                            icon={<SaveOutlined />}
                            loading={isSavingRegFields}
                            onClick={handleSaveRegistrationQuestions}
                          >
                            Save Questionnaire
                          </Button>
                        </Space>
                      </div>
                    }
                  />
                )}

                {/* PRESETS BAR */}
                <div
                  style={{
                    marginBottom: 20,
                    padding: '16px 18px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.6) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.25)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.3) 100%)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 12px rgba(245, 158, 11, 0.25)',
                        flexShrink: 0,
                      }}
                    >
                      <ThunderboltOutlined style={{ color: '#fbbf24', fontSize: 16 }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                          Quick Question Presets
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 7px',
                            borderRadius: 9999,
                            background: 'rgba(56, 189, 248, 0.12)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          1-Click Setup
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                        Click to instantly attach standard questions with verified field types and profile synchronization:
                      </div>
                    </div>
                  </div>

                  <Row gutter={[10, 10]}>
                    {QUESTION_PRESETS.map((preset) => {
                      const isAlreadyAdded = localQuestions.some(
                        (q) => q.fieldDefinition?.key === preset.key
                      );
                      const fieldBadgeStyles: Record<string, { bg: string; color: string; border: string }> = {
                        URL: { bg: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.25)' },
                        SELECT: { bg: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', border: 'rgba(99, 102, 241, 0.25)' },
                        RADIO: { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.25)' },
                        TEXT: { bg: 'rgba(34, 197, 94, 0.12)', color: '#4ade80', border: 'rgba(34, 197, 94, 0.25)' },
                      };
                      const badgeStyle = fieldBadgeStyles[preset.fieldType] || { bg: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', border: 'rgba(255, 255, 255, 0.12)' };

                      return (
                        <Col key={preset.id} xs={24} sm={12} md={8}>
                          <Tooltip title={isAlreadyAdded ? 'Already added to registration form' : preset.description}>
                            <Button
                              block
                              disabled={isAlreadyAdded}
                              icon={
                                isAlreadyAdded ? (
                                  <CheckCircleOutlined style={{ color: '#22c55e', fontSize: 14 }} />
                                ) : (
                                  <PlusOutlined style={{ color: '#38bdf8', fontSize: 14 }} />
                                )
                              }
                              onClick={() => handleAddPreset(preset)}
                              style={{
                                textAlign: 'left',
                                height: 'auto',
                                padding: '10px 14px',
                                borderRadius: 8,
                                borderColor: isAlreadyAdded ? 'rgba(255, 255, 255, 0.08)' : 'rgba(56, 189, 248, 0.25)',
                                backgroundColor: isAlreadyAdded ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                                boxShadow: isAlreadyAdded ? 'none' : '0 2px 8px -1px rgba(0, 0, 0, 0.2)',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 12,
                                    color: isAlreadyAdded ? '#64748b' : '#f8fafc',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {preset.label}
                                </span>
                                {isAlreadyAdded ? (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      background: 'rgba(34, 197, 94, 0.12)',
                                      color: '#4ade80',
                                      border: '1px solid rgba(34, 197, 94, 0.25)',
                                      letterSpacing: '0.04em',
                                    }}
                                  >
                                    ADDED
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      background: badgeStyle.bg,
                                      color: badgeStyle.color,
                                      border: `1px solid ${badgeStyle.border}`,
                                      letterSpacing: '0.04em',
                                    }}
                                  >
                                    {preset.fieldType}
                                  </span>
                                )}
                              </div>
                            </Button>
                          </Tooltip>
                        </Col>
                      );
                    })}
                  </Row>
                </div>

                {/* TOOLBAR */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <Text strong style={{ fontSize: 15 }}>
                      Active Registration Questions ({localQuestions.length})
                    </Text>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      Questions students must answer when registering for this event
                    </div>
                  </div>
                  <Space wrap>
                    <Button onClick={() => setIsAttachModalOpen(true)}>
                      Attach Existing Pool Field
                    </Button>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setIsCreateQuestionModalOpen(true);
                      }}
                    >
                      Create Custom Question
                    </Button>
                    <Button
                      type="primary"
                      disabled={!isDirty}
                      loading={isSavingRegFields}
                      icon={<SaveOutlined />}
                      onClick={handleSaveRegistrationQuestions}
                    >
                      Save Changes
                    </Button>
                  </Space>
                </div>

                {/* VISUAL QUESTION CARDS LIST */}
                {localQuestions.length === 0 ? (
                  <Empty
                    description="No registration questions attached yet."
                    style={{ padding: '32px 0' }}
                  >
                    <Button
                      type="primary"
                      onClick={() => handleAddPreset(QUESTION_PRESETS[0])}
                    >
                      Add GitHub Profile Preset
                    </Button>
                  </Empty>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {localQuestions.map((q, idx) => {
                      const def = q.fieldDefinition;
                      return (
                        <Card
                          key={q.fieldDefinitionId}
                          size="small"
                          style={{
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.35) 0%, rgba(15, 23, 42, 0.5) 100%)',
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: 10,
                            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: 12,
                              flexWrap: 'wrap',
                              gap: 12,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Badge
                                count={`#${idx + 1}`}
                                style={{ backgroundColor: '#1677ff', fontWeight: 600 }}
                              />
                              <div>
                                <span style={{ fontWeight: 700, fontSize: 15, color: '#f8fafc' }}>
                                  {def.label}
                                </span>
                                {q.isRequired && (
                                  <span style={{ color: '#ff4d4f', marginLeft: 4, fontWeight: 'bold' }}>
                                    *
                                  </span>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  <Tag color="cyan">{def.fieldType}</Tag>
                                  <Tag color={def.isReusable ? 'blue' : 'default'}>
                                    {def.isReusable ? 'Saves to Student Profile' : 'Event-Only Response'}
                                  </Tag>
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    key: <code>{def.key}</code>
                                  </Text>
                                </div>
                              </div>
                            </div>

                            <Space size={12}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 12 }}>Required:</Text>
                                <Switch
                                  size="small"
                                  checked={q.isRequired}
                                  onChange={(checked) =>
                                    handleToggleRequired(q.fieldDefinitionId, checked)
                                  }
                                />
                              </div>

                              <Space.Compact size="small">
                                <Button
                                  icon={<ArrowUpOutlined />}
                                  disabled={idx === 0}
                                  onClick={() => handleMoveQuestion(idx, 'up')}
                                />
                                <Button
                                  icon={<ArrowDownOutlined />}
                                  disabled={idx === localQuestions.length - 1}
                                  onClick={() => handleMoveQuestion(idx, 'down')}
                                />
                              </Space.Compact>

                              <Popconfirm
                                title="Remove question from registration?"
                                description="Existing submitted answers will remain safe in the database."
                                onConfirm={() => handleRemoveQuestion(q.fieldDefinitionId)}
                                okText="Remove"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true }}
                              >
                                <Button danger size="small" icon={<DeleteOutlined />} aria-label="Remove question" />
                              </Popconfirm>
                            </Space>
                          </div>

                          {/* INTERACTIVE LIVE PREVIEW */}
                          <QuestionCardPreview
                            label={def.label}
                            fieldType={def.fieldType}
                            options={def.options}
                            isRequired={q.isRequired}
                            theme="antd"
                          />
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'forms',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <CalendarOutlined style={{ marginRight: 6 }} />
                In-Event Forms ({eventForms?.length || 0})
              </span>
            ),
            children: (
              <div style={{ marginTop: 8 }}>
                {/* HEADER / TIMEZONE ALERT */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <Text strong style={{ fontSize: 15 }}>
                      Scheduled & Milestone Questionnaires
                    </Text>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      Independently scheduled project submissions, milestone forms, and post-event surveys
                    </div>
                  </div>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setIsCreateFormModalOpen(true);
                    }}
                  >
                    Create In-Event Form
                  </Button>
                </div>

                <Alert
                  type="info"
                  showIcon
                  icon={<ClockCircleOutlined />}
                  style={{ marginBottom: 20, fontSize: 12 }}
                  title={
                    <span>
                      Schedule availability is enforced on the server in half-open interval{' '}
                      <code>[releaseAt, closeAt)</code>. Timing timestamps display in{' '}
                      <strong>{getLocalTimezoneDisplay()}</strong>.
                    </span>
                  }
                />

                {/* SCHEDULED FORM CARDS */}
                {(!eventForms || eventForms.length === 0) ? (
                  <Empty
                    description="No in-event forms created yet."
                    style={{ padding: '32px 0' }}
                  >
                    <Button
                      type="primary"
                      onClick={() => setIsCreateFormModalOpen(true)}
                    >
                      Create First In-Event Form
                    </Button>
                  </Empty>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {eventForms.map((formItem) => {
                      const avail = getFormAvailability(formItem);
                      const purposeColors: Record<string, string> = {
                        SUBMISSION: 'blue',
                        FEEDBACK: 'orange',
                        CUSTOM: 'purple',
                        REGISTRATION: 'cyan',
                      };

                      return (
                        <Card
                          key={formItem.id}
                          size="small"
                          style={{
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.35) 0%, rgba(15, 23, 42, 0.5) 100%)',
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: 10,
                            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.25)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              flexWrap: 'wrap',
                              gap: 16,
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: 16, color: '#f8fafc' }}>
                                  {formItem.title}
                                </span>
                                <Tag color={purposeColors[formItem.purpose] || 'default'}>
                                  {formItem.purpose}
                                </Tag>
                                <Tag
                                  color={
                                    avail.status === 'open'
                                      ? 'green'
                                      : avail.status === 'scheduled'
                                        ? 'cyan'
                                        : avail.status === 'closed'
                                          ? 'default'
                                          : 'gold'
                                  }
                                  style={{ fontWeight: 600 }}
                                >
                                  {avail.label.toUpperCase()}
                                </Tag>
                              </div>

                              <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                                {avail.status === 'draft' && (
                                  <div style={{ color: '#d48806', fontWeight: 500, marginBottom: 4 }}>
                                    Draft: Form is hidden from students and cannot receive submissions until published.
                                  </div>
                                )}
                                <div>
                                  <Text type="secondary">Release: </Text>
                                  {formItem.releaseAt ? (
                                    <Text>{dayjs(formItem.releaseAt).format('MMM D, YYYY h:mm A')}</Text>
                                  ) : (
                                    <Text type="secondary">Immediate (available upon release)</Text>
                                  )}
                                </div>
                                <div style={{ marginTop: 2 }}>
                                  <Text type="secondary">Closing Deadline: </Text>
                                  {formItem.closeAt ? (
                                    <Text>{dayjs(formItem.closeAt).format('MMM D, YYYY h:mm A')}</Text>
                                  ) : (
                                    <Text type="secondary">No closing deadline (open indefinitely)</Text>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Space wrap>
                              {formItem.publishedAt ? (
                                <Popconfirm
                                  title="Unpublish this form?"
                                  description="Students will no longer see this form or be able to submit responses. All existing questions and responses will be preserved."
                                  onConfirm={() => handleUnpublishForm(formItem)}
                                  okText="Unpublish"
                                  cancelText="Cancel"
                                >
                                  <Button size="small" loading={isUnpublishingForm}>
                                    Unpublish
                                  </Button>
                                </Popconfirm>
                              ) : (
                                <Button
                                  size="small"
                                  type="primary"
                                  loading={isPublishingForm}
                                  onClick={() => handlePublishForm(formItem)}
                                >
                                  Publish Form
                                </Button>
                              )}
                              <Button
                                size="small"
                                icon={<SettingOutlined />}
                                onClick={() => setSelectedFormForFields(formItem)}
                              >
                                Configure Questions
                              </Button>
                              <Button
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => setSelectedFormForResponses(formItem)}
                              >
                                Responses
                              </Button>
                              <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleOpenEditForm(formItem)}
                              >
                                Edit Schedule
                              </Button>
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                loading={isDuplicatingForm}
                                onClick={() => handleDuplicateForm(formItem)}
                              >
                                Duplicate
                              </Button>
                              <Popconfirm
                                title="Delete this scheduled form?"
                                description="All associated form questions and answers will be permanently deleted."
                                onConfirm={() => handleDeleteForm(formItem.id)}
                                okText="Delete"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true }}
                              >
                                <Button danger size="small" icon={<DeleteOutlined />} />
                              </Popconfirm>
                            </Space>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* CREATE CUSTOM QUESTION MODAL */}
      <Modal
        destroyOnHidden
        title="Create Custom Question Definition"
        open={isCreateQuestionModalOpen}
        onCancel={() => setIsCreateQuestionModalOpen(false)}
        onOk={() => customQuestionForm.submit()}
        confirmLoading={isCreatingDef}
      >
        <Form
          form={customQuestionForm}
          layout="vertical"
          preserve={false}
          onFinish={handleCreateCustomQuestion}
          initialValues={{ fieldType: 'TEXT', isReusable: true, isRequired: true }}
        >
          <Form.Item
            name="label"
            label="Question Label / Prompt"
            rules={[{ required: true, message: 'Please enter a question label' }]}
            extra="The human-readable question presented to the student."
          >
            <Input
              placeholder="e.g. Portfolio Website, T-Shirt Size, or Project Abstract"
              onChange={(e) => {
                const autoKey = generateFieldKey(e.target.value, existingKeys);
                customQuestionForm.setFieldValue('key', autoKey);
              }}
            />
          </Form.Item>

          <Form.Item
            name="key"
            label="Machine Key"
            rules={[{ required: true, message: 'Machine key is required' }]}
            extra="Automatically generated unique identifier. Can be customized."
          >
            <Input placeholder="e.g. portfolio_website" />
          </Form.Item>

          <Form.Item
            name="fieldType"
            label="Supported Field Type"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="TEXT">TEXT (Single line / free text)</Select.Option>
              <Select.Option value="URL">URL (Validated web address)</Select.Option>
              <Select.Option value="EMAIL">EMAIL (Validated email address)</Select.Option>
              <Select.Option value="NUMBER">NUMBER (Validated finite number)</Select.Option>
              <Select.Option value="PHONE">PHONE (Validated phone number)</Select.Option>
              <Select.Option value="SELECT">SELECT (Single choice dropdown)</Select.Option>
              <Select.Option value="MULTI_SELECT">MULTI_SELECT (Multiple choices checkboxes)</Select.Option>
              <Select.Option value="RADIO">RADIO (Single choice radio list)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.fieldType !== cur.fieldType}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('fieldType');
              if (['SELECT', 'MULTI_SELECT', 'RADIO'].includes(type)) {
                return (
                  <Form.Item
                    name="options"
                    label="Options (comma-separated)"
                    rules={[{ required: true, message: 'Please provide at least 2 options' }]}
                    extra="Enter options separated by commas (e.g. Option A, Option B, Option C)"
                  >
                    <Input placeholder="Option 1, Option 2, Option 3" />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="isReusable"
                label="Save to Student Profile?"
                valuePropName="checked"
                extra="If enabled, answer is saved to student profile and auto-prefilled in future forms."
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isRequired"
                label="Required for Registration?"
                valuePropName="checked"
                extra="Student cannot complete registration without answering this question."
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ATTACH EXISTING POOL FIELD MODAL */}
      <Modal
        title="Attach Existing Question Definition"
        open={isAttachModalOpen}
        onCancel={() => setIsAttachModalOpen(false)}
        footer={null}
      >
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {availableToAttach.length === 0 ? (
            <Empty description="All existing pool questions have already been attached." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {availableToAttach.map((field) => (
                <div
                  key={field.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 6,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{field.label}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <Tag color="cyan">{field.fieldType}</Tag>
                      <Tag color={field.isReusable ? 'blue' : 'default'}>
                        {field.isReusable ? 'Reusable' : 'Event-Only'}
                      </Tag>
                    </div>
                  </div>
                  <Button type="primary" size="small" onClick={() => handleAttachExisting(field)}>
                    Attach
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* CREATE IN-EVENT FORM MODAL */}
      <Modal
        destroyOnHidden
        title="Create In-Event Form"
        open={isCreateFormModalOpen}
        onCancel={() => setIsCreateFormModalOpen(false)}
        onOk={() => createFormInstance.submit()}
        confirmLoading={isCreatingForm}
      >
        <Form
          form={createFormInstance}
          layout="vertical"
          preserve={false}
          onFinish={handleCreateForm}
          initialValues={{ purpose: 'SUBMISSION' }}
        >
          <Form.Item
            name="title"
            label="Form Title"
            rules={[{ required: true, message: 'Please enter form title' }]}
          >
            <Input placeholder="e.g. Midpoint Milestone Submission, Hackathon Project Submission" />
          </Form.Item>

          <Form.Item
            name="purpose"
            label="Form Purpose"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="SUBMISSION">SUBMISSION (Milestone, code link, project)</Select.Option>
              <Select.Option value="FEEDBACK">FEEDBACK (Post-event survey, ratings)</Select.Option>
              <Select.Option value="CUSTOM">CUSTOM (Custom questionnaire)</Select.Option>
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="releaseAt"
                label="Release Time (Opening)"
                extra="Optional. Leave empty for immediate availability."
              >
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="closeAt"
                label="Closing Time (Deadline)"
                extra="Optional. Leave empty for no closing deadline."
              >
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* EDIT IN-EVENT FORM SCHEDULE MODAL */}
      <Modal
        destroyOnHidden
        title={`Edit Schedule: ${editingForm?.title || ''}`}
        open={!!editingForm}
        onCancel={() => setEditingForm(null)}
        onOk={() => editFormInstance.submit()}
        confirmLoading={isUpdatingForm}
      >
        {editingForm && (
          <Form
            form={editFormInstance}
            layout="vertical"
            preserve={false}
            onFinish={handleUpdateForm}
            initialValues={{
              title: editingForm.title,
              releaseAt: editingForm.releaseAt ? dayjs(editingForm.releaseAt) : null,
              closeAt: editingForm.closeAt ? dayjs(editingForm.closeAt) : null,
            }}
          >
            <Form.Item
              name="title"
              label="Form Title"
              rules={[{ required: true, message: 'Please enter form title' }]}
            >
              <Input />
            </Form.Item>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="releaseAt"
                  label="Release Time (Opening)"
                  extra="Leave empty for immediate release"
                >
                  <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="closeAt"
                  label="Closing Time (Deadline)"
                  extra="Leave empty for no closing deadline"
                >
                  <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        )}
      </Modal>

      {/* CONFIGURE QUESTIONS MODAL FOR SCHEDULED FORMS */}
      {selectedFormForFields && (
        <EventFormFieldsConfigModal
          eventId={eventId}
          formId={selectedFormForFields.id}
          formTitle={selectedFormForFields.title}
          onClose={() => setSelectedFormForFields(null)}
        />
      )}

      {/* VIEW RESPONSES MODAL FOR SCHEDULED FORMS */}
      {selectedFormForResponses && (
        <FormResponsesModal
          eventId={eventId}
          formId={selectedFormForResponses.id}
          formTitle={selectedFormForResponses.title}
          onClose={() => setSelectedFormForResponses(null)}
        />
      )}
    </Card>
  );
}
