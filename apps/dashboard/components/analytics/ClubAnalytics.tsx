import React from 'react';
import { Card, Result, Skeleton, Table, Empty } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAnalyticsClubs } from '../../hooks/useAnalyticsClubs';

export default function ClubAnalytics() {
  const { data, isLoading, error } = useAnalyticsClubs();

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card title="Top Clubs by Events Hosted" bordered={false}><Skeleton.Button active style={{ width: '100%', height: 320 }} shape="square" /></Card>
      <Card title="Clubs Activity Overview" bordered={false}><Skeleton active paragraph={{ rows: 4 }} /></Card>
    </div>
  );
  if (error || !data) return <Result status="error" title="Failed to load clubs data" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card title="Top Clubs by Events Hosted" bordered={false}>
        <div style={{ height: 320, width: '100%' }}>
          {data.clubs.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Empty description="No clubs found" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.clubs} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 12}} />
                <Tooltip />
                <Legend />
                <Bar dataKey="events_count" fill="#a855f7" name="Events Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
      
      <Card title="Clubs Activity Overview" bordered={false}>
        <Table 
          dataSource={data.clubs} 
          rowKey="id" 
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description="No clubs found." /> }}
          columns={[
            { title: 'Club Name', dataIndex: 'name', key: 'name', render: (_, r) => r.name },
            { title: 'Events Hosted', dataIndex: 'events_count', key: 'events_count', render: (_, r) => r.events_count },
            { title: 'Active Members', dataIndex: 'members_count', key: 'members_count', render: (_, r) => r.members_count },
          ]} 
        />
      </Card>
    </div>
  );
}
