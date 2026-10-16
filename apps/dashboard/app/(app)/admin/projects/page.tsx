'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Input,
  Select,
  Space,
  Tabs,
  Badge,
  Alert,
} from 'antd';
import {
  LinkOutlined,
  ReloadOutlined,
  FlagOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import {
  projectsApi,
  AdminReportItem,
  AdminProjectsResponse,
  AdminReportsResponse,
} from '@/lib/projects-api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

export default function AdminProjectsModerationPage() {
  const [activeTab, setActiveTab] = useState<'reports' | 'projects'>('reports');
  const [reportsData, setReportsData] = useState<AdminReportsResponse | null>(null);
  const [projectsData, setProjectsData] = useState<AdminProjectsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Moderate Project Modal
  const [moderateProject, setModerateProject] = useState<{ id: string; title: string; action: string } | null>(null);
  const [modReason, setModReason] = useState('');
  const [isModSubmitting, setIsModSubmitting] = useState(false);

  // Resolve Report Modal
  const [resolveReport, setResolveReport] = useState<AdminReportItem | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'RESOLVED' | 'DISMISSED'>('RESOLVED');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolveSubmitting, setIsResolveSubmitting] = useState(false);

  const loadReports = async () => {
    try {
      const res = await projectsApi.adminListReports(1, 50);
      setReportsData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    }
  };

  const loadProjects = async () => {
    try {
      const res = await projectsApi.adminListProjects(1, 50, 'all');
      setProjectsData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    }
  };

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([loadReports(), loadProjects()]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      projectsApi.adminListReports(1, 50).then(setReportsData).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      }),
      projectsApi.adminListProjects(1, 50, 'all').then(setProjectsData).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      }),
    ]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const handleModerateSubmit = async () => {
    if (!moderateProject) return;
    setIsModSubmitting(true);

    try {
      await projectsApi.adminModerateProject(moderateProject.id, moderateProject.action, modReason);
      setModerateProject(null);
      setModReason('');
      await refreshAll();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Moderation action failed');
    } finally {
      setIsModSubmitting(false);
    }
  };

  const handleResolveSubmit = async () => {
    if (!resolveReport) return;
    setIsResolveSubmitting(true);

    try {
      await projectsApi.adminResolveReport(resolveReport.id, resolveStatus, resolutionNotes);
      setResolveReport(null);
      setResolutionNotes('');
      await refreshAll();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Resolve action failed');
    } finally {
      setIsResolveSubmitting(false);
    }
  };

  const pendingReportsCount = reportsData?.items.filter((r) => r.status === 'PENDING').length || 0;

  const reportColumns = [
    {
      title: 'Reported Project',
      key: 'project',
      render: (_: unknown, record: AdminReportItem) => (
        <div>
          <div className="font-semibold text-sm">
            {record.project?.title || 'Unknown Project'}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            by {record.project?.owner?.email || 'Unknown'}
          </div>
        </div>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => (
        <Tag color="red" className="font-mono text-xs">
          {reason}
        </Tag>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (details: string | null) => (
        <span className="text-gray-600 dark:text-gray-300 text-xs">
          {details || 'No details provided'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'PENDING' ? 'gold' : status === 'RESOLVED' ? 'green' : 'default';
        return <Tag color={color} className="font-mono text-xs">{status}</Tag>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <span className="font-mono text-xs text-gray-500">
          {new Date(date).toLocaleDateString()}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, record: AdminReportItem) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setResolveReport(record);
                setResolveStatus('RESOLVED');
                setResolutionNotes('');
              }}
            >
              Resolve
            </Button>
          )}
          <Button
            size="small"
            danger
            onClick={() => {
              setModerateProject({
                id: record.projectId,
                title: record.project?.title || 'Project',
                action: 'HIDE',
              });
              setModReason('');
            }}
          >
            Hide Project
          </Button>
          {record.project?.slug && (
            <Button
              size="small"
              type="text"
              icon={<LinkOutlined />}
              href={`/projects/${record.project.slug}`}
              target="_blank"
              title="View Live Page"
            />
          )}
        </Space>
      ),
    },
  ];

  const projectColumns = [
    {
      title: 'Project',
      key: 'title',
      render: (_: unknown, record: AdminProjectsResponse['items'][number]) => (
        <div>
          <div className="font-semibold text-sm">{record.title}</div>
          <div className="text-xs text-gray-500 font-mono">{record.ownerEmail}</div>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string) => <Tag>{cat}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'development_status',
      key: 'development_status',
      render: (status: string) => (
        <Tag color={status === 'LIVE' ? 'green' : 'default'} className="font-mono text-xs">
          {status}
        </Tag>
      ),
    },
    {
      title: 'Engagement',
      key: 'engagement',
      render: (_: unknown, record: AdminProjectsResponse['items'][number]) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-300">
          {record.like_count} likes / {record.view_count} views
        </span>
      ),
    },
    {
      title: 'Reports',
      dataIndex: 'reportsCount',
      key: 'reportsCount',
      render: (count: number) => (
        count > 0 ? (
          <Tag color="error" className="font-mono text-xs">
            {count} reports
          </Tag>
        ) : (
          <span className="font-mono text-xs text-gray-400">0</span>
        )
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, record: AdminProjectsResponse['items'][number]) => (
        <Space size="small">
          <Button
            size="small"
            onClick={() => {
              setModerateProject({
                id: record.id,
                title: record.title,
                action: 'HIDE',
              });
              setModReason('');
            }}
          >
            Hide
          </Button>
          <Button
            size="small"
            onClick={() => {
              setModerateProject({
                id: record.id,
                title: record.title,
                action: 'RESTORE',
              });
              setModReason('');
            }}
          >
            Restore
          </Button>
          <Button
            size="small"
            type="text"
            danger
            onClick={() => {
              setModerateProject({
                id: record.id,
                title: record.title,
                action: 'INVALIDATE_LIKES',
              });
              setModReason('');
            }}
            title="Invalidate suspicious likes"
          >
            Reset Likes
          </Button>
          <Button
            size="small"
            type="text"
            icon={<LinkOutlined />}
            href={`/projects/${record.slug}`}
            target="_blank"
            title="View Public Page"
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <AdminPageHeader
        breadcrumbs={[
          { title: 'Administration' },
          { title: 'Projects Moderation' },
        ]}
        title="Projects Moderation"
        description="Review abuse reports, moderate showcase projects (Hide/Restore), and audit engagement anomalies."
        context={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={refreshAll}
              loading={isLoading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<LinkOutlined />}
              href="/projects"
              target="_blank"
            >
              Public Showcase
            </Button>
          </Space>
        }
      />

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
        />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'reports' | 'projects')}
          items={[
            {
              key: 'reports',
              label: (
                <span className="flex items-center gap-2">
                  <FlagOutlined />
                  <span>Abuse Reports</span>
                  {pendingReportsCount > 0 && (
                    <Badge count={pendingReportsCount} size="small" />
                  )}
                </span>
              ),
              children: (
                <Table
                  dataSource={reportsData?.items || []}
                  columns={reportColumns}
                  rowKey="id"
                  loading={isLoading}
                  pagination={{
                    pageSize: 15,
                    showSizeChanger: true,
                    pageSizeOptions: ['15', '30', '50'],
                  }}
                />
              ),
            },
            {
              key: 'projects',
              label: (
                <span className="flex items-center gap-2">
                  <ProjectOutlined />
                  <span>All Directory Projects ({projectsData?.items.length || 0})</span>
                </span>
              ),
              children: (
                <Table
                  dataSource={projectsData?.items || []}
                  columns={projectColumns}
                  rowKey="id"
                  loading={isLoading}
                  pagination={{
                    pageSize: 15,
                    showSizeChanger: true,
                    pageSizeOptions: ['15', '30', '50'],
                  }}
                />
              ),
            },
          ]}
        />
      </div>

      {/* Moderate Action Modal */}
      <Modal
        title={`Confirm Moderation Action: ${moderateProject?.action}`}
        open={!!moderateProject}
        onCancel={() => setModerateProject(null)}
        footer={[
          <Button key="cancel" onClick={() => setModerateProject(null)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger={moderateProject?.action === 'HIDE' || moderateProject?.action === 'INVALIDATE_LIKES'}
            loading={isModSubmitting}
            disabled={modReason.trim().length < 5}
            onClick={handleModerateSubmit}
          >
            {`Execute ${moderateProject?.action}`}
          </Button>,
        ]}
      >
        <div className="py-2 space-y-4">
          <p className="text-xs text-gray-500">
            Project: <strong className="text-gray-900 dark:text-gray-100">{moderateProject?.title}</strong>. This action is auditable and recorded in moderation history.
          </p>
          <div>
            <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
              Reason for action * (min 5 characters)
            </label>
            <Input.TextArea
              rows={3}
              value={modReason}
              onChange={(e) => setModReason(e.target.value)}
              placeholder="State the justification for this moderation decision..."
            />
          </div>
        </div>
      </Modal>

      {/* Resolve Report Modal */}
      <Modal
        title="Resolve Abuse Report"
        open={!!resolveReport}
        onCancel={() => setResolveReport(null)}
        footer={[
          <Button key="cancel" onClick={() => setResolveReport(null)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isResolveSubmitting}
            onClick={handleResolveSubmit}
          >
            Confirm Resolution
          </Button>,
        ]}
      >
        <div className="py-2 space-y-4">
          <p className="text-xs text-gray-500">
            Reason: <strong className="text-red-500">{resolveReport?.reason}</strong> on project &ldquo;{resolveReport?.project?.title}&rdquo;.
          </p>
          <div>
            <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
              Resolution Decision *
            </label>
            <Select
              className="w-full"
              value={resolveStatus}
              onChange={(val) => setResolveStatus(val)}
              options={[
                { value: 'RESOLVED', label: 'Resolved (Action taken / Issue addressed)' },
                { value: 'DISMISSED', label: 'Dismissed (False alarm / Unsubstantiated)' },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-gray-500 mb-1">
              Resolution Notes (optional)
            </label>
            <Input.TextArea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Add any internal context about the resolution..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
