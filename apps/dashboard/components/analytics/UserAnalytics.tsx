import React from 'react';
import { Card, Result, Skeleton, Empty } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAnalyticsUsers } from '../../hooks/useAnalyticsUsers';

export default function UserAnalytics() {
  const { data, isLoading, error } = useAnalyticsUsers();

  if (isLoading) return <Card title="Platform Users by Role" bordered={false}><Skeleton.Button active style={{ width: '100%', height: 384 }} shape="square" /></Card>;
  if ((error as any)?.status === 403) return <Result status="403" title="Access Denied" subTitle="This analytics tab is restricted to platform administrators." />;
  if (error || !data) return <Result status="error" title="Failed to load users data" />;

  return (
    <Card title="Platform Users by Role" bordered={false}>
      <div style={{ height: 384, width: '100%' }}>
        {data.role_breakdown.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Empty description="No users found" /></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.role_breakdown} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="role" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="User Count" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
