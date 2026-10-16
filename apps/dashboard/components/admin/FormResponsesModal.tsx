import React, { useState, useMemo } from 'react';
import { Modal, Table, Typography, Input, Button, Space, Tag, Empty, Tooltip, message } from 'antd';
import { DownloadOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEventFormResponses } from '../../hooks/useEventForms';
import { exportSubmissionsToCSV } from '../../lib/form-studio-utils';

const { Title, Text } = Typography;

interface FormResponsesModalProps {
  eventId: string;
  formId: string | null;
  formTitle: string;
  onClose: () => void;
}

export function FormResponsesModal({
  eventId,
  formId,
  formTitle,
  onClose,
}: FormResponsesModalProps) {
  const { data: rawResponses, isLoading, refetch, isFetching } = useEventFormResponses(eventId, formId);
  const [searchText, setSearchText] = useState('');

  // Group raw response rows by registration/student
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

  // Filter submissions by search query
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

  // Aggregate choice-field answers so organizers can read results at a glance.
  const choiceSummaries = useMemo(() => {
    const summaries: Array<{
      fieldId: string;
      label: string;
      fieldType: string;
      counts: Array<{ option: string; count: number }>;
    }> = [];

    for (const field of fieldColumns) {
      if (!['SELECT', 'RADIO', 'MULTI_SELECT'].includes(field.fieldType)) continue;

      const counts = new Map<string, number>();
      for (const sub of submissions) {
        const raw = sub.answers[field.id]?.value;
        if (!raw) continue;

        let values: string[] = [raw];
        if (field.fieldType === 'MULTI_SELECT') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) values = parsed;
          } catch {
            values = [raw];
          }
        }
        for (const v of values) {
          counts.set(v, (counts.get(v) || 0) + 1);
        }
      }

      summaries.push({
        fieldId: field.id,
        label: field.label,
        fieldType: field.fieldType,
        counts: Array.from(counts.entries())
          .map(([option, count]) => ({ option, count }))
          .sort((a, b) => b.count - a.count),
      });
    }

    return summaries;
  }, [fieldColumns, submissions]);

  // CSV Export handler
  const handleExportCSV = () => {
    if (submissions.length === 0) return;
    try {
      exportSubmissionsToCSV(formTitle, fieldColumns, submissions);
      message.success(`Successfully exported ${submissions.length} submission${submissions.length === 1 ? '' : 's'} to CSV`);
    } catch (err: any) {
      message.error(err.message || 'Failed to export submissions to CSV');
    }
  };

  const columns = [
    {
      title: 'Student',
      key: 'user',
      width: 220,
      fixed: 'left' as const,
      render: (_: any, record: any) => (
        <div>
          <Text strong>{record.user.fullName}</Text>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.user.email}</div>
        </div>
      ),
    },
    {
      title: 'Submitted At',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 170,
      render: (dateStr: string) => (
        <Text style={{ fontSize: 13 }}>
          {new Date(dateStr).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </Text>
      ),
    },
    ...fieldColumns.map(field => ({
      title: (
        <div>
          <div>{field.label}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 'normal' }}>{field.fieldType}</div>
        </div>
      ),
      key: field.id,
      render: (_: any, record: any) => {
        const answer = record.answers[field.id];
        if (!answer || !answer.value) {
          return <Text type="secondary">-</Text>;
        }

        if (answer.fieldType === 'URL') {
          return (
            <a href={answer.value} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
              {answer.value}
            </a>
          );
        }

        if (answer.fieldType === 'MULTI_SELECT') {
          try {
            const items = JSON.parse(answer.value);
            if (Array.isArray(items)) {
              return (
                <Space size={[0, 4]} wrap>
                  {items.map((it, idx) => (
                    <Tag key={idx} color="geekblue">{it}</Tag>
                  ))}
                </Space>
              );
            }
          } catch {
            // fallback if stored comma-separated or plain text
            return <Tag color="geekblue">{answer.value}</Tag>;
          }
        }

        return <span style={{ wordBreak: 'break-word' }}>{answer.value}</span>;
      },
    })),
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Form Responses: {formTitle}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Showing {submissions.length} student submission{submissions.length === 1 ? '' : 's'}
            </Text>
          </div>
        </div>
      }
      open={!!formId}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Search by student name, email, or answer..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 340 }}
          allowClear
        />
        <Space>
          <Tooltip title="Refresh responses">
            <Button
              icon={<ReloadOutlined spin={isFetching} />}
              onClick={() => refetch()}
            />
          </Tooltip>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportCSV}
            disabled={submissions.length === 0}
          >
            Export CSV
          </Button>
        </Space>
      </div>

      {choiceSummaries.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            marginBottom: 16,
            padding: '12px 16px',
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
          }}
        >
          {choiceSummaries.map((summary) => (
            <div key={summary.fieldId} style={{ minWidth: 180 }}>
              <Text strong style={{ fontSize: 12 }}>
                {summary.label}
              </Text>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {summary.counts.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    No answers
                  </Text>
                ) : (
                  summary.counts.map((c) => (
                    <Tag key={c.option} color={summary.fieldType === 'MULTI_SELECT' ? 'geekblue' : 'blue'}>
                      {c.option}: {c.count}
                    </Tag>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Table
        dataSource={filteredSubmissions}
        columns={columns}
        rowKey="registrationId"
        scroll={{ x: 600 + fieldColumns.length * 180 }}
        loading={isLoading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                submissions.length === 0
                  ? 'No responses submitted for this form yet.'
                  : 'No matching responses found.'
              }
            />
          ),
        }}
      />
    </Modal>
  );
}
