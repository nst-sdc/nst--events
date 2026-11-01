'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  Form, Input, Button, Select, DatePicker, InputNumber, 
  Card, Breadcrumb, Typography, Space, Row, Col, Alert, Result, App, Radio, Divider
} from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { useAcademicBatches } from '../../../../../hooks/useAcademicBatches';
import { useEventDetail } from '../../../../../hooks/useEventDetail';
import { useUpdateEvent, UpdateEventInput } from '../../../../../hooks/useUpdateEvent';
import { useEventLifecycle } from '../../../../../hooks/useEventLifecycle';
import { FormStudio } from '../../../../../components/forms/FormStudio';
import { ApiError, API_BASE_URL } from '../../../../../lib/api';
import { EVENT_TYPES } from '@nst/shared';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const eventId = unwrappedParams.id;
  
  const router = useRouter();
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
  
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const { data: batchesData, isLoading: isLoadingBatches } = useAcademicBatches();
  const { data: event, isLoading: isLoadingEvent, isError: isErrorEvent, error: errorEvent } = useEventDetail(eventId);
  const { mutateAsync: updateEvent, isPending: isUpdating } = useUpdateEvent(eventId);
  const { deleteMutation } = useEventLifecycle();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [slugValidation, setSlugValidation] = useState<{
    status: 'idle' | 'validating' | 'available' | 'unavailable';
    reason?: string;
    suggestedSlug?: string;
    normalizedSlug?: string;
  }>({ status: 'idle' });

  const slugify = (input: string) => {
    return input
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  };

  const validateSlugLive = async (slugCandidate: string) => {
    if (!slugCandidate || slugCandidate.length < 3) {
      setSlugValidation({ status: 'idle' });
      return;
    }
    setSlugValidation({ status: 'validating' });
    try {
      const res = await fetch(`${API_BASE_URL}/v1/events/validate-slug?slug=${encodeURIComponent(slugCandidate)}&event_id=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          setSlugValidation({ status: 'available', normalizedSlug: data.normalized_slug });
        } else {
          setSlugValidation({
            status: 'unavailable',
            reason: data.reason,
            suggestedSlug: data.suggested_slug,
            normalizedSlug: data.normalized_slug,
          });
        }
      }
    } catch {
      setSlugValidation({ status: 'idle' });
    }
  };

  useEffect(() => {
    if (event && !isLoadingUser && !isLoadingBatches && !isLoadingEvent) {
      const rawEvent = event as unknown as Record<string, unknown>;
      const regStartVal = event.registrationStartTime || (rawEvent.registration_start_time as string | undefined);
      const regEndVal = event.registrationEndTime || (rawEvent.registration_end_time as string | undefined);

      form.setFieldsValue({
        title: event.title,
        slug: (rawEvent.slug as string) || '',
        description: event.description,
        dateRange: [dayjs(event.startTime), dayjs(event.endTime)],
        registration_start_time: regStartVal ? dayjs(regStartVal) : undefined,
        registration_end_time: regEndVal ? dayjs(regEndVal) : undefined,
        location_name: event.locationName,
        event_type: event.eventType,
        visibility: event.visibility,
        registration_type: event.registrationType,
        attendance_type: event.attendanceType,
        max_capacity: event.maxCapacity,
        max_participants: (rawEvent.maxParticipants ?? rawEvent.max_participants) as number | undefined,
        minimum_team_size: event.metadata?.minimum_team_size as number | undefined,
        maximum_team_size: event.metadata?.maximum_team_size as number | undefined,
        banner_url: ((event.metadata as Record<string, unknown> | null | undefined)?.banner_url as string) || '',
        audience: event.audience,
        audience_batch_ids: event.audienceBatchIds,
      });
    }
  }, [event, form, isLoadingUser, isLoadingBatches, isLoadingEvent]);

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

  if (isLoadingUser || isLoadingEvent || isLoadingBatches) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (isErrorEvent && (errorEvent as ApiError)?.data?.detail === 'EVENT_LOCKED') {
    return (
      <Result
        status="warning"
        title="Event Locked"
        subTitle="This event can no longer be edited."
        extra={<Button type="primary" onClick={() => router.push(`/events/${eventId}`)}>Back to Event</Button>}
      />
    );
  }

  if (!event || (event.state !== 'DRAFT' && event.state !== 'PUBLISHED')) {
    return (
      <Result
        status="warning"
        title="Not Editable"
        subTitle="This event is no longer in DRAFT or PUBLISHED state and cannot be edited."
        extra={<Button type="primary" onClick={() => router.push(`/events/${eventId}`)}>Back to Event</Button>}
      />
    );
  }

  const isGlobalAdmin = currentUser?.global_role === 'PLATFORM_ADMIN' || currentUser?.global_role === 'FACULTY_ADMIN';
  let isAuthorizedToEdit = false;
  if (currentUser) {
    if (isGlobalAdmin) {
      isAuthorizedToEdit = true;
    } else {
      const userAdminClubs = currentUser.club_memberships
        .filter(m => m.role === 'CLUB_ADMIN') 
        .map(m => m.club_id);
      
      const isClubAdmin = event.eventClubs?.some(ec => userAdminClubs.includes(ec.clubId)) ?? false;
      if (isClubAdmin) {
        isAuthorizedToEdit = true;
      }
    }
  }

  if (!isAuthorizedToEdit) {
    return (
      <Result
        status="403"
        title="Unauthorized"
        subTitle="You do not have permission to edit this event."
        extra={<Link href={`/events/${eventId}`}><Button type="primary">Back to Event</Button></Link>}
      />
    );
  }

  interface EditEventFormValues {
    title: string;
    slug?: string;
    description?: string;
    banner_url: string;
    registration_mode?: 'REQUIRED' | 'NOT_REQUIRED';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dateRange: [any, any];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registration_start_time?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registration_end_time?: any;
    location_name?: string;
    event_type: string;
    visibility: 'PUBLIC' | 'UNLISTED' | 'RESTRICTED';
    registration_type: 'INDIVIDUAL' | 'TEAM';
    attendance_type: 'SINGLE' | 'MULTI_SESSION';
    max_capacity?: number;
    max_participants?: number;
    minimum_team_size?: number;
    maximum_team_size?: number;
    audience: 'ALL_STUDENTS' | 'SPECIFIC_BATCHES';
    audience_batch_ids?: string[];
  }

  const executeSave = async (values: EditEventFormValues) => {
    try {
      const [start, end] = values.dateRange;
      const regStart = values.registration_start_time;
      const regEnd = values.registration_end_time;
      const rawEvent = event as unknown as Record<string, unknown> | undefined;
      const rawMode = rawEvent?.registrationMode ?? rawEvent?.registration_mode;
      const regMode: 'REQUIRED' | 'NOT_REQUIRED' =
        values.registration_mode || (rawMode === 'NOT_REQUIRED' ? 'NOT_REQUIRED' : 'REQUIRED');

      if (regMode === 'REQUIRED') {
        if (regStart && regEnd && dayjs(regStart).isAfter(dayjs(regEnd))) {
          setErrorMessage('Registration Opens At must be before Registration Closes At.');
          return;
        }
        if (regEnd && end && dayjs(regEnd).isAfter(dayjs(end))) {
          setErrorMessage('Registration Closes At must be before or at event end time.');
          return;
        }
      }

      const payload: UpdateEventInput = {
        title: values.title,
        slug: values.slug?.trim() || undefined,
        description: values.description,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        registration_mode: regMode,
        registration_start_time: regMode === 'NOT_REQUIRED' ? undefined : (regStart ? dayjs(regStart).toISOString() : undefined),
        registration_end_time: regMode === 'NOT_REQUIRED' ? undefined : (regEnd ? dayjs(regEnd).toISOString() : undefined),
        location_name: values.location_name,
        event_type: values.event_type,
        visibility: values.visibility,
        registration_type: values.registration_type,
        attendance_type: values.attendance_type,
        max_capacity: values.max_capacity,
        max_participants: values.registration_type === 'TEAM' ? values.max_participants : undefined,
        audience: values.audience,
        audience_batch_ids: values.audience === 'SPECIFIC_BATCHES' ? values.audience_batch_ids : undefined,
      };

      const updatedMetadata: Record<string, unknown> = { ...(event.metadata || {}) };
      updatedMetadata.banner_url = values.banner_url.trim();
      if (values.registration_type === 'TEAM') {
        updatedMetadata.minimum_team_size = values.minimum_team_size;
        updatedMetadata.maximum_team_size = values.maximum_team_size;
      } else {
        delete updatedMetadata.minimum_team_size;
        delete updatedMetadata.maximum_team_size;
      }
      payload.metadata = Object.keys(updatedMetadata).length > 0 ? updatedMetadata : undefined;

      await updateEvent(payload);
      setIsDirty(false);
      message.success('Event updated successfully');
      router.push(`/events/${eventId}`);
    } catch (err: unknown) {
      const error = err as ApiError;
      if (error.data?.detail === 'EVENT_LOCKED' || error.data?.detail === 'EVENT_MUST_BE_DRAFT') {
        setErrorMessage(error.data?.detail || error.message);
        modal.warning({
          title: 'Event State Changed',
          content: 'This event can no longer be edited.',
          onOk: () => router.push(`/events/${eventId}`)
        });
      } else if (error.status === 403 || error.message?.toLowerCase().includes('forbidden')) {
        setErrorMessage('You do not have permission to edit this event.');
      } else {
        setErrorMessage(error.data?.detail || error.message || 'Failed to update event. Please check your inputs.');
      }
    }
  };

  const handleFinish = async (values: EditEventFormValues) => {
    setErrorMessage(null);

    const originalTitle = event?.title;
    const currentSlug = (event as unknown as { slug?: string } | undefined)?.slug;
    const isTitleChanged = originalTitle && values.title !== originalTitle;
    const isSlugUnchanged = values.slug === currentSlug;

    if (isTitleChanged && isSlugUnchanged) {
      const suggestedNewSlug = slugify(values.title);
      modal.confirm({
        title: 'Update Event URL?',
        content: `The event name changed to "${values.title}". Would you like to update the public URL to /event/${suggestedNewSlug}? The previous URL will permanently redirect to the new one.`,
        okText: 'Update URL & Save',
        cancelText: 'Keep Existing URL & Save',
        onOk: () => {
          executeSave({ ...values, slug: suggestedNewSlug });
        },
        onCancel: () => {
          executeSave(values);
        },
      });
      return;
    }

    await executeSave(values);
  };

  const handleCancel = () => {
    if (isDirty) {
      modal.confirm({
        title: 'Discard unsaved changes?',
        content: 'You have unsaved changes. Are you sure you want to discard them?',
        okText: 'Discard',
        okButtonProps: { danger: true },
        cancelText: 'Stay',
        onOk: () => {
          setIsDirty(false);
          router.push(`/events/${eventId}`);
        }
      });
    } else {
      router.push(`/events/${eventId}`);
    }
  };

  const handleDelete = () => {
    modal.confirm({
      title: 'Delete Event?',
      content: 'Are you sure you want to delete this event? This action is permanent and cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        return new Promise<void>((resolve, reject) => {
          deleteMutation.mutate(eventId, {
            onSuccess: () => {
              message.success('Event deleted successfully');
              setIsDirty(false);
              router.push('/events');
              resolve();
            },
            onError: (err) => {
              const error = err as ApiError;
              message.error(error.data?.detail || error.message || 'Failed to delete event');
              reject(err);
            }
          });
        });
      }
    });
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link href="/events">Events</Link> },
            { title: <Link href={`/events/${eventId}`}>{event.title}</Link> },
            { title: 'Edit Event' },
          ]}
        />
        <Title level={2} style={{ margin: 0 }}>Edit Event</Title>
        <Text type="secondary">Update the details of your drafted event.</Text>
      </div>

      {errorMessage && (
        <Alert type="error" title="Update Failed" description={errorMessage} showIcon />
      )}

      <Form
        form={form}
        layout="vertical"
        disabled={isUpdating}
        onValuesChange={(changedValues) => {
          setIsDirty(true);
          if (changedValues.registration_type === 'INDIVIDUAL') {
            form.setFieldsValue({ minimum_team_size: undefined, maximum_team_size: undefined });
          }
          if (changedValues.audience === 'ALL_STUDENTS') {
            form.setFieldsValue({ audience_batch_ids: undefined });
          }
        }}
      >
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          {/* BASIC INFORMATION */}
          <Card title="Basic Information" size="small">
            <Form.Item
              name="title"
              label="Event Name"
              rules={[{ required: true, message: 'Please enter the event name' }, { min: 3, max: 255 }]}
            >
              <Input placeholder="e.g. AI Hackathon 2026" />
            </Form.Item>
            <Form.Item
              name="slug"
              label="Event URL Slug"
              extra={
                slugValidation.status === 'validating' ? (
                  <span style={{ color: '#888' }}>Checking URL availability...</span>
                ) : slugValidation.status === 'available' ? (
                  <span style={{ color: '#52c41a' }}>
                    Available: /event/{slugValidation.normalizedSlug || form.getFieldValue('slug')}
                  </span>
                ) : slugValidation.status === 'unavailable' ? (
                  <span style={{ color: '#ff4d4f' }}>
                    {slugValidation.reason || 'This URL is not available.'}{' '}
                    {slugValidation.suggestedSlug && (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() => {
                          form.setFieldsValue({ slug: slugValidation.suggestedSlug });
                          validateSlugLive(slugValidation.suggestedSlug!);
                        }}
                      >
                        Use suggestion: {slugValidation.suggestedSlug}
                      </Button>
                    )}
                  </span>
                ) : (
                  'Custom URL slug for this event. Changing the slug creates a permanent historical redirect from the previous URL.'
                )
              }
              rules={[
                {
                  pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                  message: 'Slug must contain only lowercase letters, numbers, and single hyphens',
                },
              ]}
            >
              <Input
                placeholder="e.g. ai-hackathon-2026"
                prefix={<span className="text-neutral-500 select-none font-mono">/event/</span>}
                onChange={(e) => {
                  validateSlugLive(e.target.value);
                }}
              />
            </Form.Item>
            <Form.Item
              name="description"
              label="Description"
              rules={[{ max: 5000 }]}
            >
              <Input.TextArea rows={4} placeholder="Detailed description of the event..." />
            </Form.Item>
            <Form.Item
              name="event_type"
              label="Event Type"
              extra="Describes the kind of event."
              rules={[{ required: true, message: 'Please select an event type' }]}
            >
              <Select
                options={EVENT_TYPES.map(t => ({ label: t.label, value: t.value }))}
              />
            </Form.Item>
            <Form.Item
              name="banner_url"
              label="Event Banner Image URL"
              extra="Mandatory direct image URL for Discover poster wall and event admission passes (recommended 16:9 or 21:9 ratio)."
              rules={[
                { required: true, message: 'Please enter an event banner image URL' },
                { type: 'url', message: 'Please enter a valid HTTP/HTTPS URL' },
              ]}
            >
              <Input placeholder="https://images.unsplash.com/... or https://cdn.example.com/banner.jpg" allowClear />
            </Form.Item>
            {form.getFieldValue('banner_url') && (
              <div style={{ marginBottom: 16, border: '1px solid var(--ant-color-border-secondary, #E5E7EB)', borderRadius: 6, overflow: 'hidden', maxHeight: 200, backgroundColor: 'var(--ant-color-bg-layout, #F8F9FA)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={form.getFieldValue('banner_url')} 
                  alt="Banner preview" 
                  style={{ width: '100%', height: 200, objectFit: 'cover' }} 
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
              </div>
            )}
          </Card>

          {/* SCHEDULE & LOCATION */}
          <Card title="Schedule & Location" size="small">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="dateRange"
                  label="Event Schedule (Start and End Date/Time)"
                  extra="The actual date and time when the event takes place."
                  rules={[{ required: true, message: 'Please select the date range' }]}
                >
                  <RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="location_name"
                  label="Venue / Location Name"
                  rules={[{ max: 255 }]}
                >
                  <Input placeholder="e.g. Main Auditorium" />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0 16px 0' }} />

            <div style={{ marginBottom: 12 }}>
              <Text strong>Registration Period</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 13 }}>
                Configure the window during which students can register for this event. Registration must close on or before the event ends.
              </Text>
            </div>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="registration_start_time"
                  label="Registration Opens At"
                  extra="Date and time when registration becomes available."
                  dependencies={['registration_end_time', 'dateRange']}
                  rules={[
                    { required: !isGlobalAdmin, message: 'Registration opening date and time is required for Club Admins' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const regEnd = getFieldValue('registration_end_time');
                        const dateRange = getFieldValue('dateRange');
                        if (value && regEnd && dayjs(value).isAfter(dayjs(regEnd))) {
                          return Promise.reject(new Error('Registration Opens At must be before Registration Closes At'));
                        }
                        if (value && dateRange && dateRange[1] && dayjs(value).isAfter(dayjs(dateRange[1]))) {
                          return Promise.reject(new Error('Registration Opens At must be before event end time'));
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <DatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: '100%' }}
                    placeholder="Select registration open time"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="registration_end_time"
                  label="Registration Closes At"
                  extra="Date and time when registration stops accepting registrations."
                  dependencies={['registration_start_time', 'dateRange']}
                  rules={[
                    { required: !isGlobalAdmin, message: 'Registration closing date and time is required for Club Admins' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const regStart = getFieldValue('registration_start_time');
                        const dateRange = getFieldValue('dateRange');
                        if (regStart && value && dayjs(value).isBefore(dayjs(regStart))) {
                          return Promise.reject(new Error('Registration Closes At must be after Registration Opens At'));
                        }
                        if (dateRange && dateRange[1] && value && dayjs(value).isAfter(dayjs(dateRange[1]))) {
                          return Promise.reject(new Error('Registration Closes At must be before or at event end time'));
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <DatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: '100%' }}
                    placeholder="Select registration close time"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* REGISTRATION */}
          <Card title="Registration" size="small">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) => prev.registration_type !== curr.registration_type}
                >
                  {({ getFieldValue }) => {
                    const regType = getFieldValue('registration_type');
                    return (
                      <Space orientation="vertical" style={{ width: '100%', marginBottom: regType === 'TEAM' ? 24 : 0 }}>
                        <Form.Item
                          name="registration_type"
                          label="Registration Type"
                          extra={
                            regType === 'TEAM' 
                              ? "Participants must register through a team."
                              : "Participants register individually."
                          }
                          rules={[{ required: true }]}
                          style={{ marginBottom: regType === 'TEAM' ? 8 : 24 }}
                        >
                          <Select
                            options={[
                              { label: 'Individual', value: 'INDIVIDUAL' },
                              { label: 'Team', value: 'TEAM' },
                            ]}
                          />
                        </Form.Item>
                        {regType === 'TEAM' && (
                          <div style={{ padding: 16, backgroundColor: 'var(--ant-color-fill-alter)', borderRadius: 8, border: '1px solid var(--ant-color-border-secondary)' }}>
                            <Row gutter={16}>
                              <Col xs={24} md={12}>
                                <Form.Item
                                  name="minimum_team_size"
                                  label="Minimum Team Size"
                                  extra="Must be at least 1."
                                  rules={[
                                    { required: true, message: 'Required' },
                                    { type: 'number', min: 1, message: 'Must be >= 1' }
                                  ]}
                                >
                                  <InputNumber style={{ width: '100%' }} placeholder="e.g. 2" />
                                </Form.Item>
                              </Col>
                              <Col xs={24} md={12}>
                                <Form.Item
                                  name="maximum_team_size"
                                  label="Maximum Team Size"
                                  extra="Must be >= minimum size."
                                  rules={[
                                    { required: true, message: 'Required' },
                                    ({ getFieldValue }) => ({
                                      validator(_, value) {
                                        const min = getFieldValue('minimum_team_size');
                                        if (!value || !min || value >= min) {
                                          return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Max size must be >= min size'));
                                      },
                                    }),
                                  ]}
                                >
                                  <InputNumber style={{ width: '100%' }} placeholder="e.g. 4" />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Alert 
                              type="info" 
                              title="Individual registration is not permitted for team events." 
                              showIcon 
                            />
                          </div>
                        )}
                      </Space>
                    );
                  }}
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) => prev.registration_type !== curr.registration_type}
                >
                  {({ getFieldValue }) => {
                    const isTeam = getFieldValue('registration_type') === 'TEAM';
                    return (
                      <>
                        <Form.Item
                          name="max_capacity"
                          label={isTeam ? "Maximum Teams" : "Maximum Participants"}
                          extra={
                            isTeam
                              ? "Maximum number of registered teams allowed. Leave empty for unlimited."
                              : "Maximum number of individual students allowed. Leave empty for unlimited."
                          }
                          rules={[{ type: 'number', min: 1 }]}
                        >
                          <InputNumber style={{ width: '100%' }} placeholder={isTeam ? "e.g. 10" : "e.g. 100"} />
                        </Form.Item>
                        {isTeam && (
                          <Form.Item
                            name="max_participants"
                            label="Maximum Participants"
                            extra="Maximum number of individual students allowed across all teams. Leave empty for unlimited."
                            rules={[{ type: 'number', min: 1 }]}
                          >
                            <InputNumber style={{ width: '100%' }} placeholder="e.g. 50" />
                          </Form.Item>
                        )}
                      </>
                    );
                  }}
                </Form.Item>
              </Col>

            </Row>
          </Card>

          {/* AUDIENCE & ACCESS */}
          <Card title="Audience & Access" size="small">
            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.visibility !== curr.visibility}
            >
              {() => {
                return (
                  <Form.Item
                    name="visibility"
                    label="Event Visibility"
                    extra="Select the discoverability tier for this event."
                    rules={[{ required: true, message: 'Please select visibility' }]}
                  >
                    <Radio.Group style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <Radio value="PUBLIC" style={{ border: '1px solid var(--ant-color-border-secondary, #E5E7EB)', padding: '10px 14px', borderRadius: 8, width: '100%' }}>
                        <div style={{ display: 'inline-block', verticalAlign: 'top', marginLeft: 6 }}>
                          <div style={{ fontWeight: 600 }}>Public Discovery</div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Visible in public campus directory &amp; search; indexed by search engines.
                          </div>
                        </div>
                      </Radio>
                      <Radio value="UNLISTED" style={{ border: '1px solid var(--ant-color-border-secondary, #E5E7EB)', padding: '10px 14px', borderRadius: 8, width: '100%' }}>
                        <div style={{ display: 'inline-block', verticalAlign: 'top', marginLeft: 6 }}>
                          <div style={{ fontWeight: 600 }}>Unlisted Link</div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Hidden from discovery directory and search engines. Accessible only via direct link.
                          </div>
                        </div>
                      </Radio>
                      <Radio value="RESTRICTED" style={{ border: '1px solid var(--ant-color-border-secondary, #E5E7EB)', padding: '10px 14px', borderRadius: 8, width: '100%' }}>
                        <div style={{ display: 'inline-block', verticalAlign: 'top', marginLeft: 6 }}>
                          <div style={{ fontWeight: 600 }}>Restricted Institutional</div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Requires verified institutional Google login (@adypu.edu.in or @newtonschool.co) to view or register.
                          </div>
                        </div>
                      </Radio>
                    </Radio.Group>
                  </Form.Item>
                );
              }}
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.audience !== curr.audience}
            >
              {({ getFieldValue }) => {
                const aud = getFieldValue('audience');
                return (
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Form.Item
                      name="audience"
                      label="Audience"
                      extra={
                        aud === 'ALL_STUDENTS'
                          ? "All students are eligible to see and register."
                          : "Only students from specific batches are eligible."
                      }
                      rules={[{ required: true }]}
                      style={{ marginBottom: aud === 'SPECIFIC_BATCHES' ? 8 : 24 }}
                    >
                      <Select
                        options={[
                          { label: 'All Students', value: 'ALL_STUDENTS' },
                          { label: 'Specific Batches', value: 'SPECIFIC_BATCHES' },
                        ]}
                      />
                    </Form.Item>

                    {aud === 'SPECIFIC_BATCHES' && (
                      <Form.Item
                        name="audience_batch_ids"
                        label="Eligible Batches"
                        rules={[{ required: true, message: 'Please select at least one batch' }]}
                        style={{ marginBottom: 24 }}
                      >
                        <Select
                          mode="multiple"
                          placeholder="Select batches"
                          options={batchesData?.map(b => ({ label: b.display_name, value: b.id }))}
                          showSearch
                          filterOption={(input, option) => 
                            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                          }
                        />
                      </Form.Item>
                    )}
                  </Space>
                );
              }}
            </Form.Item>
          </Card>

          {/* ATTENDANCE */}
          <Card title="Attendance" size="small">
            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.attendance_type !== curr.attendance_type}
            >
              {({ getFieldValue }) => {
                const attType = getFieldValue('attendance_type');
                return (
                  <Form.Item
                    name="attendance_type"
                    label="Attendance Type"
                    extra={
                      attType === 'MULTI_SESSION'
                        ? "Multiple attendance sessions can be created for this event."
                        : "Exactly one attendance session can be created."
                    }
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { label: 'Single Session', value: 'SINGLE' },
                        { label: 'Multi Session', value: 'MULTI_SESSION' },
                      ]}
                    />
                  </Form.Item>
                );
              }}
            </Form.Item>
          </Card>

          {/* SUBMISSION BUTTONS */}
          <Row justify="end" style={{ marginTop: 8 }}>
            <Space wrap>
              <Button onClick={handleCancel} disabled={isUpdating || deleteMutation.isPending}>Cancel</Button>
              <Button 
                type="primary"
                onClick={() => {
                  form.validateFields().then(values => handleFinish(values));
                }}
                loading={isUpdating}
                disabled={deleteMutation.isPending}
              >
                Save Changes
              </Button>
            </Space>
          </Row>
        </Space>
      </Form>

      {/* FORM STUDIO (REGISTRATION & IN-EVENT FORMS) */}
      {isAuthorizedToEdit && (
        <div id="forms" style={{ scrollMarginTop: 24, marginTop: 24 }}>
          <FormStudio eventId={event.id} />
        </div>
      )}

      {/* DANGER ZONE */}
      {isAuthorizedToEdit && (
        <Card title="Danger Zone" size="small" styles={{ header: { color: 'var(--ant-color-error)' } }} style={{ marginTop: 24, borderColor: 'var(--ant-color-error-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <Text strong style={{ display: 'block' }}>Delete Event</Text>
              <Text type="secondary">Once you delete an event, there is no going back. Please be certain.</Text>
            </div>
            <Button 
              danger 
              onClick={handleDelete}
              loading={deleteMutation.isPending}
              disabled={isUpdating}
            >
              Delete Event
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
