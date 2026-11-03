'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Result,
  Card,
  Row,
  Col,
  Statistic,
  Space,
  Select,
  Typography,
  Spin,
  message,
  theme,
} from 'antd';
import {
  SecurityScanOutlined,
  DownloadOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MobileOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  EyeOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  CartesianGrid,
} from 'recharts';
import { useCurrentUser } from '../../../../hooks/useCurrentUser';
import { isPlatformAdmin } from '../../../../lib/auth-helpers';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import {
  useAuthStats,
  useAuthEvents,
  useUserSessions,
  useRevokeUserSessions,
  AuthEventItem,
  UserSessionItem,
} from '../../../../hooks/useAdminTrafficSecurity';

const { Paragraph } = Typography;

/**
 * Escapes characters that can trigger CSV formula execution in spreadsheet software.
 * Prepends a single quote (') to cells starting with =, +, -, @, tab, or carriage return.
 */
export function sanitizeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '""';
  let str = String(field);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export default function TrafficSecurityAnalyticsPage() {
  const { token } = theme.useToken();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();

  // Filters State
  const [timeRangeHours, setTimeRangeHours] = useState<number>(24 * 7); // Default 7 days
  const [eventTypeFilter, setEventTypeFilter] = useState<string | undefined>(undefined);
  const [platformFilter, setPlatformFilter] = useState<string | undefined>(undefined);
  const [networkFilter, setNetworkFilter] = useState<string | undefined>(undefined);

  // Time boundary calculation
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - timeRangeHours * 60 * 60 * 1000);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [timeRangeHours]);

  // Queries
  const { data: statsData, isLoading: isStatsLoading, refetch: refetchStats } = useAuthStats({
    start_date: startDate,
    end_date: endDate,
    granularity: timeRangeHours <= 24 ? 'hour' : 'day',
  });

  const { data: eventsData, isLoading: isEventsLoading, refetch: refetchEvents } = useAuthEvents({
    event_type: eventTypeFilter,
    platform: platformFilter,
    network_class: networkFilter,
    start_date: startDate,
    end_date: endDate,
    limit: 50,
  });

  // User Sessions Modal State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
  const { data: userSessions, isLoading: isSessionsLoading } = useUserSessions(selectedUserId);

  // Revoke Confirmation State
  const [isRevokeConfirmOpen, setIsRevokeConfirmOpen] = useState(false);
  const revokeSessionsMutation = useRevokeUserSessions();

  if (!isUserLoading && currentUser && !isPlatformAdmin(currentUser)) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <Result
          status="403"
          title="Access Restricted"
          subTitle="Traffic & Security Analytics is strictly restricted to PLATFORM_ADMIN operators."
        />
      </div>
    );
  }

  // Handle Revoke User Sessions Submit
  const handleConfirmRevoke = async () => {
    if (!selectedUserId) return;
    try {
      const res = await revokeSessionsMutation.mutateAsync(selectedUserId);
      message.success(`Revoked ${res.revoked_count} active sessions. User security version incremented.`);
      setIsRevokeConfirmOpen(false);
    } catch (err: any) {
      message.error(err?.message || 'Failed to revoke sessions');
    }
  };

  // CSV Export with formula injection prevention
  const handleExportCsv = () => {
    if (!eventsData?.data || eventsData.data.length === 0) {
      message.warning('No events available to export for the selected filter.');
      return;
    }

    const headers = [
      'Timestamp',
      'Event Type',
      'Platform',
      'User ID',
      'User Email',
      'User Name',
      'IP Hash',
      'Network Class',
      'Device Class',
      'UA Family',
      'Failure Reason',
    ];

    const rows = eventsData.data.map((item) => [
      sanitizeCsvField(item.created_at),
      sanitizeCsvField(item.event_type),
      sanitizeCsvField(item.platform),
      sanitizeCsvField(item.user_id || ''),
      sanitizeCsvField(item.user?.email || ''),
      sanitizeCsvField(item.user?.full_name || ''),
      sanitizeCsvField(item.ip_hash),
      sanitizeCsvField(item.network_class),
      sanitizeCsvField(item.device_class || ''),
      sanitizeCsvField(item.user_agent_family || ''),
      sanitizeCsvField(item.failure_reason || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `nst-auth-events-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('Auth events CSV export downloaded securely.');
  };

  const eventColumns = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (ts: string) => (
        <span style={{ fontSize: 12, color: token.colorTextSecondary, fontFamily: 'monospace' }}>
          {new Date(ts).toLocaleString()}
        </span>
      ),
      width: 170,
    },
    {
      title: 'Event Type',
      dataIndex: 'event_type',
      key: 'event_type',
      render: (type: string) => {
        let color = 'default';
        if (type === 'LOGIN_SUCCESS') color = 'green';
        else if (type === 'LOGIN_FAILED' || type === 'REFRESH_FAILED') color = 'red';
        else if (type === 'REUSE_DETECTED') color = 'magenta';
        else if (type === 'SESSION_REVOKED') color = 'volcano';
        else if (type === 'LOGOUT') color = 'blue';

        return (
          <Tag color={color} style={{ fontWeight: 600 }}>
            {type}
          </Tag>
        );
      },
    },
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: AuthEventItem) => {
        if (!record.user) return <span style={{ color: token.colorTextSecondary }}>Unauthenticated</span>;
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{record.user.full_name}</div>
            <div style={{ color: token.colorTextSecondary, fontSize: 11, fontFamily: 'monospace' }}>{record.user.email}</div>
          </div>
        );
      },
    },
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string, record: AuthEventItem) => (
        <Space size={4}>
          {platform === 'mobile' ? <MobileOutlined style={{ color: '#00E5FF' }} /> : <DesktopOutlined style={{ color: '#0057FF' }} />}
          <span style={{ textTransform: 'capitalize' }}>{platform}</span>
          {record.device_class && <Tag style={{ fontSize: 10 }}>{record.device_class}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Network',
      dataIndex: 'network_class',
      key: 'network_class',
      render: (net: string) => {
        const isCampus = net === 'campus';
        return (
          <Tag color={isCampus ? 'cyan' : 'purple'} style={{ textTransform: 'uppercase', fontSize: 11 }}>
            {isCampus ? '🏫 CAMPUS NAT' : '🌐 OFF-CAMPUS'}
          </Tag>
        );
      },
    },
    {
      title: 'IP Hash (HMAC)',
      dataIndex: 'ip_hash',
      key: 'ip_hash',
      render: (hash: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: token.colorTextSecondary }}>
          {hash.slice(0, 12)}...
        </span>
      ),
    },
    {
      title: 'Details / Failure Reason',
      dataIndex: 'failure_reason',
      key: 'failure_reason',
      render: (reason: string | null) => {
        if (!reason) return <span style={{ color: token.colorTextDescription }}>—</span>;
        return (
          <span style={{ color: '#ff7875', fontSize: 12 }}>
            {reason}
          </span>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: AuthEventItem) => {
        if (!record.user_id) return null;
        return (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedUserId(record.user_id);
              setSelectedUserEmail(record.user?.email || record.user_id!);
            }}
          >
            Sessions
          </Button>
        );
      },
    },
  ];

  const sessionColumns = [
    {
      title: 'Family ID',
      dataIndex: 'family_id',
      key: 'family_id',
      render: (familyId: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{familyId}</span>
      ),
    },
    {
      title: 'Device & Browser',
      key: 'device',
      render: (_: any, record: UserSessionItem) => (
        <Space>
          <Tag color="blue">{record.user_agent_family}</Tag>
          <Tag>{record.device_class}</Tag>
        </Space>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
    {
      title: 'Expires At',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1280, margin: '0 auto' }}>
      <AdminPageHeader
        breadcrumbs={[
          { title: 'Administration', href: '/admin' },
          { title: 'Traffic & Security' },
        ]}
        title="Traffic & Security Analytics"
        description="Real-time monitoring of campus authentication patterns, credential abuse detection, and active session management."
      />

      {/* Top Filter & Action Bar */}
      <Card variant="borderless">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Space wrap>
            <span>Time Window:</span>
            <Select
              value={timeRangeHours}
              onChange={(val) => setTimeRangeHours(val)}
              style={{ width: 150 }}
              options={[
                { label: 'Last 24 Hours', value: 24 },
                { label: 'Last 3 Days', value: 72 },
                { label: 'Last 7 Days', value: 168 },
                { label: 'Last 30 Days', value: 720 },
              ]}
            />
            <Button
              icon={<SyncOutlined />}
              onClick={() => {
                refetchStats();
                refetchEvents();
              }}
            >
              Refresh
            </Button>
          </Space>

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportCsv}
          >
            Export Events CSV
          </Button>
        </div>
      </Card>

      {/* Live Summary Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Total Logins"
              value={statsData?.summary.total_success || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              suffix={<span style={{ fontSize: 13, color: '#888' }}>success</span>}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Login Failures & Rate"
              value={statsData?.summary.total_failed || 0}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              suffix={
                <Tag color={statsData?.summary.failure_rate && statsData.summary.failure_rate > 10 ? 'red' : 'orange'} style={{ marginLeft: 8 }}>
                  {statsData?.summary.failure_rate || 0}%
                </Tag>
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Active Students (DAU / WAU)"
              value={`${statsData?.summary.dau || 0} / ${statsData?.summary.wau || 0}`}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Campus vs Off-Campus Split"
              value={`${statsData?.network_breakdown?.campus || 0} / ${statsData?.network_breakdown?.off_campus || 0}`}
              prefix={<SecurityScanOutlined style={{ color: '#722ed1' }} />}
              suffix={<span style={{ fontSize: 12, color: '#888' }}>NAT / EXT</span>}
            />
          </Card>
        </Col>
      </Row>

      {/* Visual Analytics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Authentication Traffic Over Time" variant="borderless">
            {isStatsLoading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData?.time_series || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(t) => new Date(t).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                      stroke="#888"
                      fontSize={11}
                    />
                    <YAxis stroke="#888" fontSize={11} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#141414', borderColor: '#333', color: '#fff' }}
                      labelFormatter={(label) => (label ? new Date(String(label)).toLocaleString() : '')}
                    />
                    <RechartsLegend />
                    <Bar dataKey="success_count" name="Logins" fill="#52c41a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failure_count" name="Failures" fill="#ff4d4f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Top Failure Reasons" variant="borderless">
            {statsData?.top_failure_reasons && statsData.top_failure_reasons.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {statsData.top_failure_reasons.slice(0, 5).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#ccc', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.reason}
                    </span>
                    <Tag color="red">{item.count}</Tag>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#666' }}>
                No recent login failures recorded.
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Paginated Auth Event Log */}
      <Card
        title={
          <Space>
            <SecurityScanOutlined style={{ color: '#0057FF' }} />
            <span>Structured Authentication Event Log</span>
          </Space>
        }
        extra={
          <Space wrap>
            <Select
              placeholder="Event Type"
              allowClear
              value={eventTypeFilter}
              onChange={(val) => setEventTypeFilter(val)}
              style={{ width: 170 }}
              options={[
                { label: 'LOGIN_SUCCESS', value: 'LOGIN_SUCCESS' },
                { label: 'LOGIN_FAILED', value: 'LOGIN_FAILED' },
                { label: 'REFRESH_FAILED', value: 'REFRESH_FAILED' },
                { label: 'REUSE_DETECTED', value: 'REUSE_DETECTED' },
                { label: 'LOGOUT', value: 'LOGOUT' },
                { label: 'SESSION_REVOKED', value: 'SESSION_REVOKED' },
              ]}
            />
            <Select
              placeholder="Platform"
              allowClear
              value={platformFilter}
              onChange={(val) => setPlatformFilter(val)}
              style={{ width: 110 }}
              options={[
                { label: 'Web', value: 'web' },
                { label: 'Mobile', value: 'mobile' },
              ]}
            />
            <Select
              placeholder="Network"
              allowClear
              value={networkFilter}
              onChange={(val) => setNetworkFilter(val)}
              style={{ width: 130 }}
              options={[
                { label: 'Campus NAT', value: 'campus' },
                { label: 'Off-Campus', value: 'off_campus' },
              ]}
            />
          </Space>
        }
      >
        <Table
          dataSource={eventsData?.data || []}
          columns={eventColumns}
          rowKey="id"
          loading={isEventsLoading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Active User Sessions Modal */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            <span>Active Sessions: {selectedUserEmail}</span>
          </Space>
        }
        open={!!selectedUserId}
        onCancel={() => setSelectedUserId(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedUserId(null)}>
            Close
          </Button>,
          <Button
            key="revoke"
            danger
            type="primary"
            icon={<DisconnectOutlined />}
            onClick={() => setIsRevokeConfirmOpen(true)}
          >
            Revoke All Sessions
          </Button>,
        ]}
        width={700}
      >
        <Paragraph style={{ color: token.colorTextSecondary, marginBottom: 16 }}>
          Lists all active refresh token families for this user across Web and Mobile. Revoking sessions invalidates all tokens immediately and increments the user&apos;s security version.
        </Paragraph>
        <Table
          dataSource={userSessions || []}
          columns={sessionColumns}
          rowKey="id"
          loading={isSessionsLoading}
          pagination={false}
          locale={{ emptyText: 'No active sessions found for this user.' }}
        />
      </Modal>

      {/* Revoke All Sessions Confirmation */}
      <ConfirmDialog
        isOpen={isRevokeConfirmOpen}
        onClose={() => setIsRevokeConfirmOpen(false)}
        onConfirm={handleConfirmRevoke}
        title="Revoke All Sessions for User?"
        message={`This will immediately terminate all active web cookies and mobile access tokens for ${selectedUserEmail}. The student will be forced to re-authenticate on all devices.`}
        confirmText="REVOKE SESSIONS"
        isDestructive={true}
        isLoading={revokeSessionsMutation.isPending}
      />
    </div>
  );
}
