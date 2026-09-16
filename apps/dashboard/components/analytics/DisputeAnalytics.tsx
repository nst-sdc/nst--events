import React from 'react';
import { Card, Result, Skeleton, Empty } from 'antd';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAnalyticsDisputes } from '../../hooks/useAnalyticsDisputes';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
};

export default function DisputeAnalytics() {
  const { data, isLoading, error } = useAnalyticsDisputes();

  if (isLoading) return <Card title="Attendance Disputes Status" bordered={false}><Skeleton.Button active style={{ width: '100%', height: 384 }} shape="square" /></Card>;
  if (error || !data) return <Result status="error" title="Failed to load disputes data" />;

  return (
    <Card title="Attendance Disputes Status" bordered={false}>
      <div style={{ height: 384, width: '100%' }}>
        {data.breakdown.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Empty description="No disputes recorded" /></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.breakdown}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="count"
                nameKey="status"
              >
                {data.breakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status.toUpperCase()] || '#3b82f6'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
