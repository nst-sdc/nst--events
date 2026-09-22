import React from 'react';
import { Card, Result, Skeleton, Empty } from 'antd';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAnalyticsRegistrations } from '../../hooks/useAnalyticsRegistrations';

export default function RegistrationAnalytics({ dateRange }: { dateRange: { start: string; end: string } }) {
  const { data, isLoading, error } = useAnalyticsRegistrations(dateRange);

  if (isLoading) return <Card title="Registrations Over Time" variant="borderless"><Skeleton.Button active style={{ width: '100%', height: 384 }} shape="square" /></Card>;
  if (error || !data) return <Result status="error" title="Failed to load registrations data" />;

  return (
    <Card title="Registrations Over Time" variant="borderless">
      <div style={{ height: 384, width: '100%' }}>
        {data.time_series.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Empty description="No registrations in this period" /></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.time_series} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" name="Registrations" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
