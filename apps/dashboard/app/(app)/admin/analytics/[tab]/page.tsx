'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

import AttendanceAnalytics from '../../../../../components/analytics/AttendanceAnalytics';
import EventAnalytics from '../../../../../components/analytics/EventAnalytics';
import RegistrationAnalytics from '../../../../../components/analytics/RegistrationAnalytics';
import ClubAnalytics from '../../../../../components/analytics/ClubAnalytics';
import DisputeAnalytics from '../../../../../components/analytics/DisputeAnalytics';
import UserAnalytics from '../../../../../components/analytics/UserAnalytics';
import LeaderboardAnalytics from '../../../../../components/analytics/LeaderboardAnalytics';

const { RangePicker } = DatePicker;

export default function AnalyticsTabPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabStr = typeof params.tab === 'string' ? params.tab : 'overview';
  
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const [dateRange, setDateRange] = useState({
    start: startParam ? dayjs(startParam).toISOString() : dayjs().subtract(30, 'days').startOf('day').toISOString(),
    end: endParam ? dayjs(endParam).toISOString() : dayjs().endOf('day').toISOString()
  });

  useEffect(() => {
    if (startParam && endParam) {
      setDateRange({
        start: dayjs(startParam).toISOString(),
        end: dayjs(endParam).toISOString()
      });
    }
  }, [startParam, endParam]);

  const handleDateChange = (dates: any) => {
    if (dates && dates.length === 2) {
      const newStart = dates[0].startOf('day').toISOString();
      const newEnd = dates[1].endOf('day').toISOString();
      setDateRange({ start: newStart, end: newEnd });
      
      const params = new URLSearchParams(searchParams.toString());
      params.set('start', newStart);
      params.set('end', newEnd);
      router.push(`?${params.toString()}`);
    }
  };

  const showDateFilter = ['attendance', 'registrations'].includes(tabStr);

  const renderTab = () => {
    switch (tabStr) {
      case 'attendance':
        return <AttendanceAnalytics dateRange={dateRange} />;
      case 'events':
        return <EventAnalytics />;
      case 'registrations':
        return <RegistrationAnalytics dateRange={dateRange} />;
      case 'clubs':
        return <ClubAnalytics />;
      case 'disputes':
        return <DisputeAnalytics />;
      case 'users':
        return <UserAnalytics />;
      case 'leaderboard':
        return <LeaderboardAnalytics />;
      default:
        return (
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #d9d9d9', padding: 32, textAlign: 'center', color: '#6b7280' }}>
            Tab not found
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 20, fontWeight: 600, textTransform: 'capitalize', margin: 0 }}>{tabStr} Analytics</h3>
        {showDateFilter && (
          <RangePicker 
            value={[dayjs(dateRange.start), dayjs(dateRange.end)]}
            onChange={handleDateChange} 
            allowClear={false}
          />
        )}
      </div>
      
      {renderTab()}
    </div>
  );
}
