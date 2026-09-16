import React from 'react';
import { Card, Result, Skeleton, Table, Empty } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { useAnalyticsEvents } from '../../hooks/useAnalyticsEvents';
import dayjs from 'dayjs';

const STATE_COLORS: Record<string, string> = {
  PUBLISHED: '#10b981',
  DRAFT: '#f59e0b',
  CANCELLED: '#ef4444',
};

export default function EventAnalytics() {
  const { data, isLoading, error } = useAnalyticsEvents();

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card title="Events by Status" bordered={false}><Skeleton.Button active style={{ width: '100%', height: 320 }} shape="square" /></Card>
      <Card title="Recent Events" bordered={false}><Skeleton active paragraph={{ rows: 4 }} /></Card>
    </div>
  );
  if (error || !data) return <Result status="error" title="Failed to load events data" />;

  const chartData = Object.entries(data.pipeline_counts).map(([state, count]) => ({
    state, count
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card title="Events by Status" bordered={false}>
        <div style={{ height: 320, width: '100%' }}>
          {chartData.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Empty description="No events recorded" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="state" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Events Count">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATE_COLORS[entry.state.toUpperCase()] || '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card title="Recent Events" bordered={false}>
        <Table 
          dataSource={data.recent_events} 
          rowKey="id" 
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description="No recent events." /> }}
          columns={[
            { title: 'Title', dataIndex: 'title', key: 'title', render: (_, r) => r.title },
            { title: 'State', dataIndex: 'state', key: 'state', render: (_, r) => r.state },
            { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', render: (_, r) => dayjs(r.createdAt).format('MMM D, YYYY') },
          ]} 
        />
      </Card>
    </div>
  );
}
