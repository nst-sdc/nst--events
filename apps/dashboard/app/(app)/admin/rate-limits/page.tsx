'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo } from 'react';
import {
  App,
  Table,
  Tag,
  Button,
  Modal,
  Result,
  Card,
  Space,
  InputNumber,
  Input,
  Select,
  Typography,
  Alert,
  Spin,
} from 'antd';
import {
  SettingOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SecurityScanOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { isPlatformAdmin } from '../../../../lib/auth-helpers';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import {
  useRateLimits,
  RateLimitBucketSetting,
  RateLimitOverrideItem,
  CreateOverridePayload,
} from '../../../../hooks/useAdminRateLimits';
import { useAdminUsers } from '../../../../hooks/useUserManagement';

const { Text, Paragraph } = Typography;

export default function AdminRateLimitsPage() {
  const { message } = App.useApp();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const {
    settings,
    replicas,
    isLoadingSettings,
    overrides,
    isLoadingOverrides,
    updateSetting,
    isUpdatingSetting,
    resetSettings,
    isResettingSettings,
    createOverride,
    isCreatingOverride,
    deleteOverride,
    isDeletingOverride,
  } = useRateLimits();

  // Edit Bucket Modal State
  const [editingBucket, setEditingBucket] = useState<RateLimitBucketSetting | null>(null);
  const [newLimitValue, setNewLimitValue] = useState<number | null>(null);

  // Reset Confirmation State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Create Override Modal State
  const [isCreateOverrideOpen, setIsCreateOverrideOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState<{
    bucket: string;
    action: 'block' | 'allow' | 'custom_max';
    customMax?: number;
    targetType: 'ip' | 'userId' | 'identifier';
    targetValue: string;
    reason: string;
    durationMinutes: number;
  }>({
    bucket: 'auth_token',
    action: 'block',
    targetType: 'userId',
    targetValue: '',
    reason: '',
    durationMinutes: 60,
  });

  // User Search State for User Override
  const [userSearchText, setUserSearchText] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [userLabelsCache, setUserLabelsCache] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchText]);

  const { data: usersData, isLoading: usersLoading } = useAdminUsers(
    debouncedUserSearch || undefined,
    undefined,
    isCreateOverrideOpen && overrideForm.targetType === 'userId'
  );

  const userOptions = useMemo(() => {
    const list = usersData?.pages?.flatMap((p) => p.data) || [];
    const opts = list.map((user) => ({
      label: `${user.fullName || 'Unnamed'} (${user.email})`,
      value: user.id,
    }));
    if (overrideForm.targetValue && !opts.some((o) => o.value === overrideForm.targetValue)) {
      opts.unshift({
        label: userLabelsCache[overrideForm.targetValue] || `User: ${overrideForm.targetValue}`,
        value: overrideForm.targetValue,
      });
    }
    return opts;
  }, [usersData, overrideForm.targetValue, userLabelsCache]);

  // Delete Override Confirm State
  const [deletingOverride, setDeletingOverride] = useState<RateLimitOverrideItem | null>(null);

  // Access check
  if (!isUserLoading && currentUser && !isPlatformAdmin(currentUser)) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <Result
          status="403"
          title="Access Restricted"
          subTitle="Rate Limit Control is strictly restricted to PLATFORM_ADMIN operators."
        />
      </div>
    );
  }

  // Handle Edit Bucket Submit
  const handleSaveBucket = async () => {
    if (!editingBucket || newLimitValue === null) return;
    if (newLimitValue < editingBucket.floor || newLimitValue > editingBucket.ceiling) {
      message.error(`Value must be between ${editingBucket.floor} and ${editingBucket.ceiling}`);
      return;
    }
    try {
      await updateSetting({ bucket: editingBucket.bucket, max: newLimitValue });
      message.success(`Rate limit for ${editingBucket.bucket} updated to ${newLimitValue}`);
      setEditingBucket(null);
    } catch (err: any) {
      message.error(err?.message || 'Failed to update rate limit setting');
    }
  };

  // Handle Reset Submit
  const handleConfirmReset = async () => {
    try {
      await resetSettings();
      message.success('All rate limit settings reverted to environment defaults across replicas.');
      setIsResetConfirmOpen(false);
    } catch (err: any) {
      message.error(err?.message || 'Failed to reset rate limit settings');
    }
  };

  // Handle Create Override Submit
  const handleSaveOverride = async () => {
    if (!overrideForm.targetValue.trim()) {
      message.error(overrideForm.targetType === 'userId' ? 'Please select a user' : 'Target value is required');
      return;
    }
    if (!overrideForm.reason.trim()) {
      message.error('Reason is required for audit trail');
      return;
    }
    if (overrideForm.action === 'custom_max' && (!overrideForm.customMax || overrideForm.customMax <= 0)) {
      message.error('Custom max must be greater than 0');
      return;
    }

    const payload: CreateOverridePayload = {
      bucket: overrideForm.bucket,
      action: overrideForm.action,
      custom_max: overrideForm.action === 'custom_max' ? overrideForm.customMax : undefined,
      reason: overrideForm.reason.trim(),
      expires_in_seconds: overrideForm.durationMinutes * 60,
    };

    if (overrideForm.targetType === 'ip') {
      payload.target_ip = overrideForm.targetValue.trim();
    } else if (overrideForm.targetType === 'userId') {
      payload.target_user_id = overrideForm.targetValue.trim();
    } else {
      payload.target_identifier = overrideForm.targetValue.trim();
    }

    try {
      await createOverride(payload);
      message.success('Temporary rate limit override applied successfully');
      if (overrideForm.targetType === 'userId') {
        const found = userOptions.find((u) => u.value === overrideForm.targetValue);
        if (found) {
          setUserLabelsCache((prev) => ({ ...prev, [overrideForm.targetValue]: found.label }));
        }
      }
      setIsCreateOverrideOpen(false);
      setOverrideForm({
        bucket: 'auth_token',
        action: 'block',
        targetType: 'userId',
        targetValue: '',
        reason: '',
        durationMinutes: 60,
      });
      setUserSearchText('');
    } catch (err: any) {
      message.error(err?.message || 'Failed to create rate limit override');
    }
  };

  // Handle Delete Override Submit
  const handleConfirmDeleteOverride = async () => {
    if (!deletingOverride) return;
    try {
      await deleteOverride(deletingOverride.id);
      message.success('Rate limit override removed');
      setDeletingOverride(null);
    } catch (err: any) {
      message.error(err?.message || 'Failed to delete override');
    }
  };

  const bucketColumns = [
    {
      title: 'Bucket Name',
      dataIndex: 'bucket',
      key: 'bucket',
      render: (bucket: string) => (
        <Space orientation="horizontal">
          <Tag color="cyan" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
            {bucket}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Cluster Limit (Total)',
      dataIndex: 'max',
      key: 'max',
      render: (val: number) => (
        <span style={{ fontWeight: 700, fontSize: 15 }}>
          {val.toLocaleString()} <span style={{ fontSize: 12, color: '#888' }}>req / 15m</span>
        </span>
      ),
    },
    {
      title: `Per Replica (÷ ${replicas} Replicas)`,
      dataIndex: 'effective_per_replica',
      key: 'effective_per_replica',
      render: (val: number) => (
        <Tag color="blue" style={{ fontFamily: 'monospace' }}>
          {val.toLocaleString()} req/replica
        </Tag>
      ),
    },
    {
      title: 'Permitted Hard Bounds [Floor, Ceiling]',
      key: 'bounds',
      render: (_: any, record: RateLimitBucketSetting) => (
        <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 13 }}>
          [{record.floor.toLocaleString()} — {record.ceiling.toLocaleString()}]
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: RateLimitBucketSetting) => (
        <Button
          icon={<EditOutlined />}
          type="link"
          onClick={() => {
            setEditingBucket(record);
            setNewLimitValue(record.max);
          }}
        >
          Edit Limit
        </Button>
      ),
    },
  ];

  const overrideColumns = [
    {
      title: 'Bucket',
      dataIndex: 'bucket',
      key: 'bucket',
      render: (bucket: string) => <Tag color="geekblue">{bucket}</Tag>,
    },
    {
      title: 'Target',
      key: 'target',
      render: (_: any, record: RateLimitOverrideItem) => {
        if (record.target_ip) return <span className="font-mono text-xs">IP: {record.target_ip}</span>;
        if (record.target_user_id) {
          const userLabel = userLabelsCache[record.target_user_id];
          return (
            <span className="text-xs">
              {userLabel ? (
                <span><strong>User:</strong> {userLabel}</span>
              ) : (
                <span className="font-mono">User: {record.target_user_id}</span>
              )}
            </span>
          );
        }
        if (record.target_identifier) return <span className="font-mono text-xs">ID: {record.target_identifier}</span>;
        return <Tag>Global</Tag>;
      },
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string, record: RateLimitOverrideItem) => {
        if (action === 'block') {
          return (
            <Tag icon={<StopOutlined />} color="red">
              BLOCK
            </Tag>
          );
        }
        if (action === 'allow') {
          return (
            <Tag icon={<CheckCircleOutlined />} color="green">
              ALLOW
            </Tag>
          );
        }
        return (
          <Tag icon={<SettingOutlined />} color="orange">
            CUSTOM: {record.custom_max}
          </Tag>
        );
      },
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: 'Expires At',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (expiresAt: string) => {
        const date = new Date(expiresAt);
        const isPast = date.getTime() < Date.now();
        return (
          <span style={{ color: isPast ? '#999' : '#e0e0e0', fontSize: 12 }}>
            {date.toLocaleString()} {isPast && '(Expired)'}
          </span>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: RateLimitOverrideItem) => (
        <Button
          danger
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => setDeletingOverride(record)}
        >
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
      <AdminPageHeader
        breadcrumbs={[
          { title: 'Administration', href: '/admin' },
          { title: 'Rate Limits' },
        ]}
        title="Rate Limits Control"
        description="Manage cluster-wide dynamic rate limit quotas, multi-replica synchronization, and emergency security overrides."
      />

      <Alert
        title="Zero-Downtime Cache Invalidation Active"
        description={`Rate limit changes take effect immediately across all ${replicas} API replicas via PostgreSQL statement-level notify channels (pg_notify). No container restart required.`}
        type="info"
        showIcon
      />

      {/* Primary Quota Controls */}
      <Card
        title={
          <Space>
            <SettingOutlined style={{ color: '#0057FF' }} />
            <span>Active Rate Limit Buckets</span>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => setIsResetConfirmOpen(true)}
            danger
          >
            Reset All to Defaults
          </Button>
        }
      >
        <Table
          dataSource={settings}
          columns={bucketColumns}
          rowKey="bucket"
          loading={isLoadingSettings}
          pagination={false}
        />
      </Card>

      {/* Temporary Overrides Section */}
      <Card
        title={
          <Space>
            <SecurityScanOutlined style={{ color: '#FF9500' }} />
            <span>Active Temporary Overrides</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateOverrideOpen(true)}
          >
            Create Override
          </Button>
        }
      >
        <Paragraph style={{ color: '#888', marginBottom: 16 }}>
          Temporary overrides allow blocking malicious IPs, whitelisting trusted monitoring probes, or setting custom quotas during planned high-load events. Expired overrides are automatically pruned by background workers.
        </Paragraph>
        <Table
          dataSource={overrides}
          columns={overrideColumns}
          rowKey="id"
          loading={isLoadingOverrides}
          locale={{ emptyText: 'No active rate limit overrides.' }}
        />
      </Card>

      {/* Edit Bucket Modal */}
      <Modal
        title={`Adjust Quota: ${editingBucket?.bucket}`}
        open={!!editingBucket}
        onCancel={() => setEditingBucket(null)}
        onOk={handleSaveBucket}
        confirmLoading={isUpdatingSetting}
        okText="Apply Change"
      >
        {editingBucket && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div>
              <Text strong>Current Cluster Limit (Total across {replicas} replicas):</Text>
              <div style={{ marginTop: 8 }}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={editingBucket.floor}
                  max={editingBucket.ceiling}
                  value={newLimitValue}
                  onChange={(val) => setNewLimitValue(val)}
                />
              </div>
              <div style={{ marginTop: 4, color: '#888', fontSize: 12 }}>
                Allowed bounds: {editingBucket.floor.toLocaleString()} to {editingBucket.ceiling.toLocaleString()} requests per 15 min.
              </div>
            </div>

            {newLimitValue !== null && (
              <div style={{ background: '#141414', padding: 12, borderRadius: 6, border: '1px solid #333' }}>
                <Text style={{ fontSize: 12, color: '#aaa' }}>
                  Effective Limit per Replica: <strong>{Math.ceil(newLimitValue / replicas)} req/15m</strong>
                </Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Override Modal */}
      <Modal
        title="Create Temporary Rate Limit Override"
        open={isCreateOverrideOpen}
        onCancel={() => setIsCreateOverrideOpen(false)}
        onOk={handleSaveOverride}
        confirmLoading={isCreatingOverride}
        okText="Create Override"
        width={560}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div>
            <Text strong>Target Bucket</Text>
            <Select
              style={{ width: '100%', marginTop: 6 }}
              value={overrideForm.bucket}
              onChange={(bucket) => setOverrideForm({ ...overrideForm, bucket })}
              options={[
                { label: 'auth_token (/auth/refresh & /auth/logout)', value: 'auth_token' },
                { label: 'attendance (Check-in & Sync)', value: 'attendance' },
                { label: 'user (Authenticated General Traffic)', value: 'user' },
                { label: 'unauth (Unauthenticated General Traffic)', value: 'unauth' },
                { label: 'auth_oauth_failed (Failed OAuth attempts)', value: 'auth_oauth_failed' },
                { label: 'auth_ip_ceiling (IP Cluster Ceiling)', value: 'auth_ip_ceiling' },
              ]}
            />
          </div>

          <div>
            <Text strong>Override Action</Text>
            <Select
              style={{ width: '100%', marginTop: 6 }}
              value={overrideForm.action}
              onChange={(action) => setOverrideForm({ ...overrideForm, action })}
              options={[
                { label: 'BLOCK (Reject with 429 immediately)', value: 'block' },
                { label: 'ALLOW (Bypass rate limit checks)', value: 'allow' },
                { label: 'CUSTOM_MAX (Apply temporary custom limit)', value: 'custom_max' },
              ]}
            />
          </div>

          {overrideForm.action === 'custom_max' && (
            <div>
              <Text strong>Custom Request Limit</Text>
              <InputNumber
                style={{ width: '100%', marginTop: 6 }}
                min={1}
                placeholder="Enter custom max requests"
                value={overrideForm.customMax}
                onChange={(customMax) => setOverrideForm({ ...overrideForm, customMax: customMax || undefined })}
              />
            </div>
          )}

          <div>
            <Text strong>Target Identifier Type</Text>
            <Select
              style={{ width: '100%', marginTop: 6 }}
              value={overrideForm.targetType}
              onChange={(targetType) => {
                setOverrideForm({ ...overrideForm, targetType, targetValue: '' });
                setUserSearchText('');
              }}
              options={[
                { label: 'User (Select by Name)', value: 'userId' },
                { label: 'Client IP Address', value: 'ip' },
                { label: 'Arbitrary Token / Key Hash', value: 'identifier' },
              ]}
            />
          </div>

          <div>
            <Text strong>
              {overrideForm.targetType === 'userId' ? 'Select User (by Name / Email)' : 'Target Value'}
            </Text>
            {overrideForm.targetType === 'userId' ? (
              <Select
                showSearch
                style={{ width: '100%', marginTop: 6 }}
                placeholder="Search user by name or email"
                loading={usersLoading}
                onSearch={(val) => setUserSearchText(val)}
                filterOption={false}
                value={overrideForm.targetValue || undefined}
                onChange={(val) => setOverrideForm({ ...overrideForm, targetValue: val })}
                options={userOptions}
                notFoundContent={usersLoading ? <Spin size="small" /> : 'No users found'}
              />
            ) : (
              <Input
                style={{ width: '100%', marginTop: 6 }}
                placeholder={overrideForm.targetType === 'ip' ? 'e.g. 198.51.100.42' : 'e.g. string or token'}
                value={overrideForm.targetValue}
                onChange={(e) => setOverrideForm({ ...overrideForm, targetValue: e.target.value })}
              />
            )}
          </div>

          <div>
            <Text strong>Audit Reason</Text>
            <Input
              style={{ width: '100%', marginTop: 6 }}
              placeholder="e.g. Mitigating abusive scraper on campus NAT"
              value={overrideForm.reason}
              onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
            />
          </div>

          <div>
            <Text strong>Duration (TTL)</Text>
            <Select
              style={{ width: '100%', marginTop: 6 }}
              value={overrideForm.durationMinutes}
              onChange={(durationMinutes) => setOverrideForm({ ...overrideForm, durationMinutes })}
              options={[
                { label: '15 Minutes', value: 15 },
                { label: '1 Hour', value: 60 },
                { label: '6 Hours', value: 360 },
                { label: '24 Hours', value: 1440 },
                { label: '7 Days', value: 10080 },
              ]}
            />
          </div>
        </div>
      </Modal>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleConfirmReset}
        title="Reset All Rate Limits?"
        message="This will immediately remove all database overrides and reset all rate limit buckets back to the original environment defaults across all API replicas. Are you sure you wish to proceed?"
        confirmText="RESET ALL LIMITS"
        isDestructive={true}
        isLoading={isResettingSettings}
      />

      {/* Delete Override Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingOverride}
        onClose={() => setDeletingOverride(null)}
        onConfirm={handleConfirmDeleteOverride}
        title="Remove Rate Limit Override?"
        message={`Are you sure you want to remove the ${deletingOverride?.action.toUpperCase()} override for bucket "${deletingOverride?.bucket}"? Normal rate limiting will resume immediately.`}
        confirmText="REMOVE OVERRIDE"
        isDestructive={true}
        isLoading={isDeletingOverride}
      />
    </div>
  );
}
