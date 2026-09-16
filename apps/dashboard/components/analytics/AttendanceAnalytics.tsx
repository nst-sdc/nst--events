import React from 'react';
import { Card, Result, Skeleton, Row, Col, Empty } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAnalyticsAttendance } from '../../hooks/useAnalyticsAttendance';

const FAILURE_COLORS = ['#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#3b82f6'];

export default function AttendanceAnalytics({ dateRange }: { dateRange: { start: string; end: string } }) {
  const { data, isLoading, error } = useAnalyticsAttendance(dateRange);

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card title="Attendance Over Time" bordered={false}><Skeleton.Button active style={{ width: '100%', height: 320 }} shape="square" /></Card>
      <Card title="Failure Reasons" bordered={false}><Skeleton.Button active style={{ width: '100%', height: 320 }} shape="square" /></Card>
    </div>
  );
  if (error || !data) return <Result status="error" title="Failed to load attendance data" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card title="Attendance Over Time" bordered={false}>
        <div style={{ height: 320, width: '100%' }}>
          {data.time_series.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Empty description="No attendance records in this period" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.time_series} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="success" stroke="#10b981" name="Successful" />
                <Line type="monotone" dataKey="fail" stroke="#ef4444" name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card title="Failure Reasons" bordered={false}>
        <div style={{ height: 320, width: '100%' }}>
          {data.failure_breakdown.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Empty description="No failures recorded" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.failure_breakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="reason"
                >
                  {data.failure_breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={FAILURE_COLORS[index % FAILURE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
