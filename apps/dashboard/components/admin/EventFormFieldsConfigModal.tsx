import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Typography, Space, Form, Select, Switch, Input, Tag, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useFieldDefinitions, useCreateFieldDefinition, FieldType, FieldDefinition } from '../../hooks/useFieldDefinitions';
import { useEventForm, useUpdateEventFormFields, EventFormField } from '../../hooks/useEventForms';

const { Title, Text } = Typography;

interface EventFormFieldsConfigModalProps {
  eventId: string;
  formId: string | null;
  formTitle: string;
  onClose: () => void;
}

export function EventFormFieldsConfigModal({
  eventId,
  formId,
  formTitle,
  onClose,
}: EventFormFieldsConfigModalProps) {
  const { data: formDetails, isLoading: isLoadingForm } = useEventForm(eventId, formId);
  const { data: allFields, isLoading: isLoadingAllFields } = useFieldDefinitions();
  const { mutateAsync: updateFields, isPending: isSaving } = useUpdateEventFormFields(eventId);
  const { mutateAsync: createFieldDefinition, isPending: isCreatingField } = useCreateFieldDefinition();

  const [localFields, setLocalFields] = useState<EventFormField[]>([]);
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [isCreateFieldModalOpen, setIsCreateFieldModalOpen] = useState(false);
  const [createForm] = Form.useForm();

  useEffect(() => {
    if (formDetails?.fields) {
      setLocalFields(formDetails.fields);
    } else {
      setLocalFields([]);
    }
  }, [formDetails]);

  const handleAddField = (fieldDefId: string) => {
    const fieldDef = allFields?.find(f => f.id === fieldDefId);
    if (!fieldDef || localFields.some(f => f.fieldDefinitionId === fieldDefId)) return;

    setLocalFields([
      ...localFields,
      {
        id: `temp-${Date.now()}`,
        eventId,
        formId,
        fieldDefinitionId: fieldDefId,
        isRequired: true,
        order: localFields.length,
        createdAt: new Date().toISOString(),
        fieldDefinition: fieldDef,
      },
    ]);
    setIsAddFieldModalOpen(false);
  };

  const handleRemoveField = (fieldDefId: string) => {
    setLocalFields(localFields.filter(f => f.fieldDefinitionId !== fieldDefId));
  };

  const handleToggleRequired = (fieldDefId: string, isRequired: boolean) => {
    setLocalFields(
      localFields.map(f => (f.fieldDefinitionId === fieldDefId ? { ...f, isRequired } : f))
    );
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === localFields.length - 1)
    ) {
      return;
    }

    const newFields = [...localFields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newFields[index];
    newFields[index] = newFields[swapIndex];
    newFields[swapIndex] = temp;

    newFields.forEach((f, i) => {
      f.order = i;
    });

    setLocalFields(newFields);
  };

  const handleSave = async () => {
    if (!formId) return;
    try {
      await updateFields({
        formId,
        fields: localFields.map(f => ({
          fieldDefinitionId: f.fieldDefinitionId,
          isRequired: f.isRequired,
          order: f.order,
        })),
      });
      message.success('Form fields saved successfully');
      onClose();
    } catch (err: any) {
      message.error(err.message || 'Failed to save form fields');
    }
  };

  const handleCreateNewField = async (values: any) => {
    try {
      const created = await createFieldDefinition({
        key: values.key,
        label: values.label,
        fieldType: values.fieldType,
        options: values.options ? values.options.split(',').map((s: string) => s.trim()) : null,
        isReusable: values.isReusable,
      });

      // Automatically add to current form
      if (created?.id) {
        handleAddField(created.id);
      }
      setIsCreateFieldModalOpen(false);
      createForm.resetFields();
      message.success('Custom field definition created');
    } catch (err: any) {
      message.error(err.message || 'Failed to create field definition');
    }
  };

  const availableFields =
    allFields?.filter(f => !localFields.some(lf => lf.fieldDefinitionId === f.id)) || [];

  const columns = [
    {
      title: 'Order',
      key: 'order',
      width: 90,
      render: (_: any, __: any, index: number) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            onClick={() => handleMove(index, 'up')}
          />
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index === localFields.length - 1}
            onClick={() => handleMove(index, 'down')}
          />
        </Space>
      ),
    },
    {
      title: 'Field Label',
      dataIndex: ['fieldDefinition', 'label'],
      key: 'label',
      render: (text: string, record: EventFormField) => (
        <div>
          <Text strong>{text}</Text>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>Key: {record.fieldDefinition.key}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: ['fieldDefinition', 'fieldType'],
      key: 'fieldType',
      render: (type: string) => {
        let orientationColor = 'blue';
        if (type === 'URL') orientationColor = 'cyan';
        if (type === 'SELECT' || type === 'MULTI_SELECT' || type === 'RADIO') orientationColor = 'purple';
        if (type === 'NUMBER') orientationColor = 'green';
        return <Tag color={orientationColor}>{type}</Tag>;
      },
    },
    {
      title: 'Required',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 100,
      render: (isRequired: boolean, record: EventFormField) => (
        <Switch
          checked={isRequired}
          onChange={checked => handleToggleRequired(record.fieldDefinitionId, checked)}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_: any, record: EventFormField) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveField(record.fieldDefinitionId)}
        />
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Configure Fields: {formTitle}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Select the questions and fields students will fill out for this form.
            </Text>
          </div>
        }
        open={!!formId}
        onCancel={onClose}
        width={820}
        footer={[
          <Button key="cancel" onClick={onClose}>
            Cancel
          </Button>,
          <Button key="save" type="primary" loading={isSaving} onClick={handleSave}>
            Save Fields
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => setIsAddFieldModalOpen(true)}
            >
              Add Existing Field
            </Button>
            <Button
              type="default"
              onClick={() => setIsCreateFieldModalOpen(true)}
            >
              Create New Field
            </Button>
          </Space>
          <Text type="secondary">{localFields.length} field{localFields.length === 1 ? '' : 's'} configured</Text>
        </div>

        <Table
          dataSource={localFields}
          columns={columns}
          rowKey="fieldDefinitionId"
          pagination={false}
          loading={isLoadingForm}
          locale={{
            emptyText: (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <Text type="secondary">No fields configured for this form yet.</Text>
                <div style={{ marginTop: 8 }}>
                  <Button size="small" type="primary" onClick={() => setIsAddFieldModalOpen(true)}>
                    Add Field
                  </Button>
                </div>
              </div>
            ),
          }}
        />
      </Modal>

      {/* Select Existing Field Modal */}
      <Modal
        title="Select Field to Add"
        open={isAddFieldModalOpen}
        onCancel={() => setIsAddFieldModalOpen(false)}
        footer={null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {availableFields.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Text type="secondary">No more available fields to add.</Text>
              <div style={{ marginTop: 8 }}>
                <Button size="small" onClick={() => { setIsAddFieldModalOpen(false); setIsCreateFieldModalOpen(true); }}>
                  Create New Field Definition
                </Button>
              </div>
            </div>
          ) : (
            availableFields.map(field => (
              <div
                key={field.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                }}
              >
                <div>
                  <Text strong>{field.label}</Text>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                    Key: {field.key} · Type: {field.fieldType}
                  </div>
                </div>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => handleAddField(field.id)}
                >
                  Add
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Create New Field Definition Modal */}
      <Modal
        title="Create New Field Definition"
        open={isCreateFieldModalOpen}
        onCancel={() => {
          setIsCreateFieldModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={isCreatingField}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateNewField} initialValues={{ isReusable: true, fieldType: 'TEXT' }}>
          <Form.Item
            name="label"
            label="Field Label"
            rules={[{ required: true, message: 'Please enter the question or field label' }]}
          >
            <Input placeholder="e.g. GitHub Repository URL or Dietary Preference" />
          </Form.Item>

          <Form.Item
            name="key"
            label="Field Identifier Key"
            rules={[
              { required: true, message: 'Please enter a unique key' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: 'Key can only contain letters, numbers, and underscores' }
            ]}
          >
            <Input placeholder="e.g. github_repo_url" />
          </Form.Item>

          <Form.Item
            name="fieldType"
            label="Field Type"
            rules={[{ required: true, message: 'Please select a field type' }]}
          >
            <Select>
              <Select.Option value="TEXT">Text (Single line)</Select.Option>
              <Select.Option value="URL">URL / Link</Select.Option>
              <Select.Option value="EMAIL">Email Address</Select.Option>
              <Select.Option value="NUMBER">Number</Select.Option>
              <Select.Option value="PHONE">Phone Number</Select.Option>
              <Select.Option value="SELECT">Dropdown Select (Single choice)</Select.Option>
              <Select.Option value="MULTI_SELECT">Multi-Select (Multiple choices)</Select.Option>
              <Select.Option value="RADIO">Radio Buttons (Single choice)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.fieldType !== curr.fieldType}
          >
            {({ getFieldValue }) => {
              const fieldType = getFieldValue('fieldType');
              if (['SELECT', 'MULTI_SELECT', 'RADIO'].includes(fieldType)) {
                return (
                  <Form.Item
                    name="options"
                    label="Options (Comma separated)"
                    rules={[{ required: true, message: 'Please enter options' }]}
                  >
                    <Input placeholder="Option A, Option B, Option C" />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item
            name="isReusable"
            valuePropName="checked"
            label="Reusable Across Other Events"
          >
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
