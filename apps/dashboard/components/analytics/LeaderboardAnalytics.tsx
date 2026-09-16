import React from 'react';
import { Card, Result, Skeleton, Table, Empty } from 'antd';
import { useAnalyticsLeaderboard } from '../../hooks/useAnalyticsLeaderboard';

export default function LeaderboardAnalytics() {
  const { data, isLoading, error } = useAnalyticsLeaderboard();

  if (isLoading) return <Card title="Leaderboard Points Distribution by Reason" bordered={false}><Skeleton active paragraph={{ rows: 4 }} /></Card>;
  if ((error as any)?.status === 403) return <Result status="403" title="Access Denied" subTitle="This analytics tab is restricted to platform administrators." />;
  if (error || !data) return <Result status="error" title="Failed to load leaderboard data" />;

  return (
    <Card title="Leaderboard Points Distribution by Reason" bordered={false}>
      <Table 
        dataSource={data.reason_breakdown} 
        rowKey="reason" 
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="No leaderboard data found." /> }}
        columns={[
          { title: 'Reason', dataIndex: 'reason', key: 'reason', render: (_, r) => r.reason },
          { title: 'Awarded Count', dataIndex: 'count', key: 'count', render: (_, r) => r.count },
          { title: 'Total Points Distributed', dataIndex: 'total_points', key: 'total_points', render: (_, r) => r.total_points },
        ]} 
      />
    </Card>
  );
}
