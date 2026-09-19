import React, { useState } from 'react';
import { Card, Button, Table, Typography, Space, Modal, Form, Select, Switch, Input, List } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useFieldDefinitions, useCreateFieldDefinition, FieldType } from '../../hooks/useFieldDefinitions';
import { useEventFormFields, useUpdateEventFormFields, EventFormField } from '../../hooks/useEventFormFields';

const { Title, Text } = Typography;

interface EventFormFieldsManagerProps {
  eventId: string;
}

export function EventFormFieldsManager({ eventId }: EventFormFieldsManagerProps) {
  const { data: allFields, isLoading: isLoadingFields } = useFieldDefinitions();
  const { data: eventFields, isLoading: isLoadingEventFields } = useEventFormFields(eventId);
  const { mutateAsync: updateEventFields, isPending: isUpdating } = useUpdateEventFormFields(eventId);
  const { mutateAsync: createFieldDefinition, isPending: isCreatingField } = useCreateFieldDefinition();

  const [isFieldModalVisible, setIsFieldModalVisible] = useState(false);
  const [isCreateFieldVisible, setIsCreateFieldVisible] = useState(false);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();

  // Local state for reordering and unsaved changes
  const [localFields, setLocalFields] = useState<EventFormField[]>([]);

  React.useEffect(() => {
    if (eventFields) {
      setLocalFields(eventFields);
    }
  }, [eventFields]);

  const handleAddField = (fieldDefId: string) => {
    const fieldDef = allFields?.find(f => f.id === fieldDefId);
    if (!fieldDef || localFields.find(f => f.fieldDefinitionId === fieldDefId)) return;

    setLocalFields([
      ...localFields,
      {
        eventId,
        fieldDefinitionId: fieldDefId,
        isRequired: true,
        order: localFields.length,
        fieldDefinition: fieldDef,
      }
    ]);
    setIsFieldModalVisible(false);
  };

  const handleRemoveField = (fieldDefId: string) => {
    setLocalFields(localFields.filter(f => f.fieldDefinitionId !== fieldDefId));
  };

  const handleToggleRequired = (fieldDefId: string, isRequired: boolean) => {
    setLocalFields(localFields.map(f => 
      f.fieldDefinitionId === fieldDefId ? { ...f, isRequired } : f
    ));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === localFields.length - 1)) return;
    
    const newFields = [...localFields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newFields[index];
    newFields[index] = newFields[swapIndex];
    newFields[swapIndex] = temp;
    
    // Update order values
    newFields.forEach((f, i) => { f.order = i; });
    
    setLocalFields(newFields);
  };

  const handleSave = async () => {
    await updateEventFields({
      fields: localFields.map(f => ({
        fieldDefinitionId: f.fieldDefinitionId,
        isRequired: f.isRequired,
        order: f.order,
      })),
    });
  };

  const handleCreateField = async (values: any) => {
    await createFieldDefinition({
      key: values.key,
      label: values.label,
      fieldType: values.fieldType,
      options: values.options ? values.options.split(',').map((s: string) => s.trim()) : null,
      isReusable: values.isReusable,
    });
    setIsCreateFieldVisible(false);
    createForm.resetFields();
  };

  const columns = [
    {
      title: 'Label',
      dataIndex: ['fieldDefinition', 'label'],
      key: 'label',
    },
    {
      title: 'Type',
      dataIndex: ['fieldDefinition', 'fieldType'],
      key: 'type',
    },
    {
      title: 'Reusable',
      dataIndex: ['fieldDefinition', 'isReusable'],
      key: 'reusable',
      render: (val: boolean) => val ? 'Yes' : 'No',
    },
    {
      title: 'Required',
      key: 'required',
      render: (_: any, record: EventFormField) => (
        <Switch 
          checked={record.isRequired} 
          onChange={(checked) => handleToggleRequired(record.fieldDefinitionId, checked)} 
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: EventFormField, index: number) => (
        <Space>
          <Button 
            icon={<ArrowUpOutlined />} 
            disabled={index === 0} 
            onClick={() => handleMove(index, 'up')} 
          />
          <Button 
            icon={<ArrowDownOutlined />} 
            disabled={index === localFields.length - 1} 
            onClick={() => handleMove(index, 'down')} 
          />
          <Button 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleRemoveField(record.fieldDefinitionId)} 
          />
        </Space>
      )
    }
  ];

  return (
    <Card 
      title="Custom Registration Form Fields" 
      extra={<Button type="primary" onClick={handleSave} loading={isUpdating}>Save Form Fields</Button>}
      style={{ marginTop: 24 }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text>Configure custom fields that students need to fill out when registering for this event.</Text>
          <Space>
            <Button onClick={() => setIsCreateFieldVisible(true)}>Create New Field Type</Button>
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => setIsFieldModalVisible(true)}>
              Add Field to Event
            </Button>
          </Space>
        </div>

        <Table 
          dataSource={localFields} 
          columns={columns} 
          rowKey="fieldDefinitionId" 
          pagination={false} 
          loading={isLoadingEventFields || isLoadingFields}
        />
      </Space>

      <Modal
        title="Add Field to Event"
        open={isFieldModalVisible}
        onCancel={() => setIsFieldModalVisible(false)}
        footer={null}
      >
        <List>
          {allFields?.filter(f => !localFields.find(lf => lf.fieldDefinitionId === f.id)).map(f => (
            <List.Item key={f.id} actions={[<Button key="add" onClick={() => handleAddField(f.id)}>Add</Button>]}>
              <List.Item.Meta
                title={f.label}
                description={<span>{f.fieldType} {f.isReusable ? '(Reusable)' : ''}</span>}
              />
            </List.Item>
          ))}
          {allFields?.filter(f => !localFields.find(lf => lf.fieldDefinitionId === f.id)).length === 0 && (
            <Text type="secondary">All available fields have been added.</Text>
          )}
        </List>
      </Modal>

      <Modal
        title="Create New Field Type"
        open={isCreateFieldVisible}
        onCancel={() => setIsCreateFieldVisible(false)}
        onOk={() => createForm.submit()}
        confirmLoading={isCreatingField}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateField}>
          <Form.Item name="label" label="Label" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="key" label="Key (machine identifier)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="fieldType" label="Field Type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="TEXT">Text</Select.Option>
              <Select.Option value="URL">URL</Select.Option>
              <Select.Option value="EMAIL">Email</Select.Option>
              <Select.Option value="NUMBER">Number</Select.Option>
              <Select.Option value="PHONE">Phone</Select.Option>
              <Select.Option value="SELECT">Select</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="isReusable" label="Save to Student Profile?" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="options" label="Options (comma separated, for SELECT only)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
