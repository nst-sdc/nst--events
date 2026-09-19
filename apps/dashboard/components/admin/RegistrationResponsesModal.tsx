import React from 'react';
import { Modal, Table, Typography, Descriptions } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

const { Title, Text } = Typography;

interface RegistrationResponsesModalProps {
  eventId: string;
  registrationId: string | null;
  onClose: () => void;
}

export function RegistrationResponsesModal({ eventId, registrationId, onClose }: RegistrationResponsesModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['registration-responses', eventId, registrationId],
    queryFn: async () => {
      if (!registrationId) return null;
      const res = await apiClient<{ data: any[] }>(`/v1/events/${eventId}/registrations/${registrationId}/responses`);
      return res.data;
    },
    enabled: !!registrationId,
  });

  const columns = [
    {
      title: 'Field',
      dataIndex: ['fieldDefinition', 'label'],
      key: 'label',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Response',
      dataIndex: 'value',
      key: 'value',
      render: (text: string, record: any) => {
        if (record.fieldDefinition?.fieldType === 'URL') {
          return <a href={text} target="_blank" rel="noopener noreferrer">{text}</a>;
        }
        return <Text>{text || '-'}</Text>;
      }
    }
  ];

  return (
    <Modal
      title="Registration Responses"
      open={!!registrationId}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Table 
        dataSource={data || []} 
        columns={columns} 
        rowKey="id" 
        pagination={false} 
        loading={isLoading}
        locale={{ emptyText: 'No custom responses found for this registration.' }}
      />
    </Modal>
  );
}
