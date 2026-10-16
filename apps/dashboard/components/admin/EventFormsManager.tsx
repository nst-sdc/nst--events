import React, { useState } from 'react';
import { Card, Button, Table, Typography, Space, Modal, Form, Input, Select, DatePicker, Tag, Popconfirm, message, Badge } from 'antd';
import { PlusOutlined, SettingOutlined, EyeOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined, CopyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEventForms, useCreateEventForm, useUpdateEventForm, useDeleteEventForm, useDuplicateEventForm, EventForm } from '../../hooks/useEventForms';
import { EventFormFieldsConfigModal } from './EventFormFieldsConfigModal';
import { FormResponsesModal } from './FormResponsesModal';

const { Title, Text } = Typography;

// Mirrors the backend rule that `closeAt` must be after `releaseAt` when both are set.
const closeAfterReleaseRule = ({ getFieldValue }: any) => ({
  validator(_: any, value: any) {
    const releaseAt = getFieldValue('releaseAt');
    if (!value || !releaseAt || value.isAfter(releaseAt)) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('Close time must be after the release time'));
  },
});

interface EventFormsManagerProps {
  eventId: string;
}

export function EventFormsManager({ eventId }: EventFormsManagerProps) {
  const { data: forms, isLoading } = useEventForms(eventId);
  const { mutateAsync: createForm, isPending: isCreating } = useCreateEventForm(eventId);
  const { mutateAsync: updateForm, isPending: isUpdating } = useUpdateEventForm(eventId);
  const { mutateAsync: deleteForm } = useDeleteEventForm(eventId);
  const { mutateAsync: duplicateForm, isPending: isDuplicating } = useDuplicateEventForm(eventId);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<EventForm | null>(null);
  const [selectedFormForFields, setSelectedFormForFields] = useState<EventForm | null>(null);
  const [selectedFormForResponses, setSelectedFormForResponses] = useState<EventForm | null>(null);

  const [createFormInstance] = Form.useForm();
  const [editFormInstance] = Form.useForm();

  const handleOpenCreateModal = () => {
    createFormInstance.resetFields();
    setIsCreateModalOpen(true);
  };

  const handleCreate = async (values: any) => {
    try {
      await createForm({
        title: values.title,
        purpose: values.purpose,
        releaseAt: values.releaseAt ? values.releaseAt.toISOString() : null,
        closeAt: values.closeAt ? values.closeAt.toISOString() : null,
      });
      message.success('Form created successfully');
      setIsCreateModalOpen(false);
      createFormInstance.resetFields();
    } catch (err: any) {
      message.error(err.message || 'Failed to create form');
    }
  };

  const handleOpenEditModal = (form: EventForm) => {
    setEditingForm(form);
    editFormInstance.setFieldsValue({
      title: form.title,
      releaseAt: form.releaseAt ? dayjs(form.releaseAt) : null,
      closeAt: form.closeAt ? dayjs(form.closeAt) : null,
    });
  };

  const handleUpdate = async (values: any) => {
    if (!editingForm) return;
    try {
      await updateForm({
        formId: editingForm.id,
        data: {
          title: values.title,
          releaseAt: values.releaseAt ? values.releaseAt.toISOString() : null,
          closeAt: values.closeAt ? values.closeAt.toISOString() : null,
        },
      });
      message.success('Form updated successfully');
      setEditingForm(null);
    } catch (err: any) {
      message.error(err.message || 'Failed to update form');
    }
  };

  const handleDelete = async (formId: string) => {
    try {
      await deleteForm(formId);
      message.success('Form deleted successfully');
    } catch (err: any) {
      message.error(err.message || 'Failed to delete form');
    }
  };

  const handleDuplicate = async (form: EventForm) => {
    try {
      await duplicateForm({ formId: form.id, title: form.title, purpose: form.purpose });
      message.success('Form duplicated successfully');
    } catch (err: any) {
      message.error(err.message || 'Failed to duplicate form');
    }
  };

  const getFormStatus = (form: EventForm) => {
    const now = new Date();
    const release = form.releaseAt ? new Date(form.releaseAt) : null;
    const close = form.closeAt ? new Date(form.closeAt) : null;

    if (release && release > now) {
      return { status: 'warning', label: 'Scheduled', color: 'orange' };
    }
    if (close && close <= now) {
      return { status: 'default', label: 'Closed', color: 'default' };
    }
    return { status: 'success', label: 'Active', color: 'green' };
  };

  const columns = [
    {
      title: 'Title & Purpose',
      key: 'title',
      render: (_: any, record: EventForm) => {
        const purposeColors: Record<string, string> = {
          SUBMISSION: 'blue',
          FEEDBACK: 'volcano',
          CUSTOM: 'purple',
          REGISTRATION: 'cyan',
        };
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{record.title}</div>
            <Space size={6} style={{ marginTop: 4 }}>
              <Tag color={purposeColors[record.purpose] || 'default'}>
                {record.purpose}
              </Tag>
            </Space>
          </div>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_: any, record: EventForm) => {
        const st = getFormStatus(record);
        return <Badge status={st.status as any} text={st.label} />;
      },
    },
    {
      title: 'Schedule Window',
      key: 'schedule',
      render: (_: any, record: EventForm) => {
        return (
          <div style={{ fontSize: 12 }}>
            <div>
              <Text type="secondary">Release: </Text>
              {record.releaseAt ? (
                <Text>{dayjs(record.releaseAt).format('MMM D, YYYY h:mm A')}</Text>
              ) : (
                <Text type="secondary">Immediate (on creation)</Text>
              )}
            </div>
            <div style={{ marginTop: 2 }}>
              <Text type="secondary">Close: </Text>
              {record.closeAt ? (
                <Text>{dayjs(record.closeAt).format('MMM D, YYYY h:mm A')}</Text>
              ) : (
                <Text type="secondary">No deadline (open indefinitely)</Text>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 320,
      render: (_: any, record: EventForm) => (
        <Space size={8}>
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => setSelectedFormForFields(record)}
          >
            Configure Fields
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedFormForResponses(record)}
          >
            Responses
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditModal(record)}
          />
          <Button
            size="small"
            icon={<CopyOutlined />}
            loading={isDuplicating}
            onClick={() => handleDuplicate(record)}
            title="Duplicate form"
          />
          <Popconfirm
            title="Delete Form"
            description="Are you sure you want to delete this form and all its responses?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Scheduled Event Forms
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Add submission forms, surveys, or feedback forms that release to registered students on a schedule.
          </Text>
        </div>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreateModal}
        >
          Create Form
        </Button>
      }
      style={{ marginBottom: 24 }}
    >
      <Table
        dataSource={forms || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        locale={{
          emptyText: (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <ClockCircleOutlined style={{ fontSize: 28, color: '#bfbfbf', marginBottom: 8 }} />
              <div>
                <Text type="secondary">No scheduled forms added yet for this event.</Text>
              </div>
              <div style={{ marginTop: 12 }}>
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleOpenCreateModal}>
                  Create First Form
                </Button>
              </div>
            </div>
          ),
        }}
      />

      {/* Create Form Modal */}
      <Modal
        title="Create Scheduled Event Form"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={() => createFormInstance.submit()}
        confirmLoading={isCreating}
        destroyOnClose
      >
        <Form
          form={createFormInstance}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ purpose: 'SUBMISSION' }}
        >
          <Form.Item
            name="title"
            label="Form Title"
            rules={[{ required: true, message: 'Please enter a title for the form' }]}
          >
            <Input placeholder="e.g. Project Submission, Mid-Hackathon Check-in, Event Feedback" />
          </Form.Item>

          <Form.Item
            name="purpose"
            label="Purpose"
            rules={[{ required: true, message: 'Please select a purpose' }]}
          >
            <Select>
              <Select.Option value="SUBMISSION">Project / Assignment Submission</Select.Option>
              <Select.Option value="FEEDBACK">Feedback Survey</Select.Option>
              <Select.Option value="CUSTOM">Custom Questionnaire</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="releaseAt"
            label="Release Date & Time (Optional)"
            tooltip="Leave empty to release immediately. If set, attendees will be notified and can fill it out once this time arrives."
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="closeAt"
            label="Deadline / Close Date & Time (Optional)"
            tooltip="Leave empty to keep open indefinitely. Once this time arrives, submissions will be closed."
            dependencies={['releaseAt']}
            rules={[closeAfterReleaseRule]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Form Modal */}
      <Modal
        title="Edit Form Schedule"
        open={!!editingForm}
        onCancel={() => setEditingForm(null)}
        onOk={() => editFormInstance.submit()}
        confirmLoading={isUpdating}
        destroyOnClose
      >
        <Form form={editFormInstance} layout="vertical" onFinish={handleUpdate}>
          <Form.Item
            name="title"
            label="Form Title"
            rules={[{ required: true, message: 'Please enter a title for the form' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="releaseAt"
            label="Release Date & Time (Optional)"
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="closeAt"
            label="Deadline / Close Date & Time (Optional)"
            dependencies={['releaseAt']}
            rules={[closeAfterReleaseRule]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Fields Configuration Modal */}
      {selectedFormForFields && (
        <EventFormFieldsConfigModal
          eventId={eventId}
          formId={selectedFormForFields.id}
          formTitle={selectedFormForFields.title}
          onClose={() => setSelectedFormForFields(null)}
        />
      )}

      {/* Responses Modal */}
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
