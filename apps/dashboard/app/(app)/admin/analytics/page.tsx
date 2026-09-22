'use client';

import React from 'react';
import { Card, Row, Col, Statistic, Skeleton, Result } from 'antd';
import { CalendarOutlined, TeamOutlined, CheckCircleOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useAnalyticsOverview } from '../../../../hooks/useAnalyticsOverview';

export default function AnalyticsOverviewPage() {
  const { data, isLoading, error } = useAnalyticsOverview();

  if (isLoading) {
    return (
      <Row gutter={[24, 24]}>
        {[1, 2, 3, 4].map((key) => (
          <Col xs={24} sm={12} lg={6} key={key}>
            <Card>
              <Skeleton active paragraph={{ rows: 1 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  if (error || !data) {
    return (
      <Result
        status="error"
        title="Failed to Load Overview"
        subTitle="There was an error loading the analytics overview metrics."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Platform Overview</h3>
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic 
              title="Total Events" 
              value={data.total_events} 
              prefix={<CalendarOutlined style={{ color: '#3b82f6', marginRight: 8 }} />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic 
              title="Total Registrations" 
              value={data.total_registrations} 
              prefix={<TeamOutlined style={{ color: '#22c55e', marginRight: 8 }} />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic 
              title="Attendance Rate" 
              value={data.attendance_rate} 
              suffix="%" 
              prefix={<CheckCircleOutlined style={{ color: '#6366f1', marginRight: 8 }} />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic 
              title="Active Clubs" 
              value={data.active_clubs} 
              prefix={<AppstoreOutlined style={{ color: '#a855f7', marginRight: 8 }} />} 
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
