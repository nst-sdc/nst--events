'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Tabs, Result, Skeleton } from 'antd';
import { useAnalyticsAccess } from '../../../../hooks/useAnalyticsAccess';
import { AdminPageHeader } from '../../../../components/admin/AdminPageHeader';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: access, isLoading, error } = useAnalyticsAccess();

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '48px 24px' }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (error as any)?.status;
  if (error && status === 403) {
    return (
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '48px 24px' }}>
        <Result
          status="403"
          title="Permission Denied"
          subTitle="You do not have permission to view Analytics."
        />
      </div>
    );
  }

  if (error || !access) {
    return (
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '48px 24px' }}>
        <Result
          status="500"
          title="Error"
          subTitle="Failed to load analytics access scope."
        />
      </div>
    );
  }

  // Base tabs available for both GLOBAL and CLUB scopes
  const tabItems = [
    { key: '', label: 'Overview' },
    { key: 'events', label: 'Events' },
    { key: 'registrations', label: 'Registrations' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'clubs', label: 'Clubs' },
    { key: 'disputes', label: 'Disputes' },
  ];

  // Append extra tabs for GLOBAL scope only
  if (access.scope === 'GLOBAL') {
    tabItems.push({ key: 'users', label: 'Users' });
  }

  // Derive active tab from pathname
  // Expected path format: /admin/analytics or /admin/analytics/[tab]
  const pathParts = pathname.split('/').filter(Boolean);
  const analyticsIndex = pathParts.indexOf('analytics');
  const currentTab = analyticsIndex !== -1 && pathParts.length > analyticsIndex + 1
    ? pathParts[analyticsIndex + 1]
    : '';

  const handleTabChange = (key: string) => {
    const route = key ? `/admin/analytics/${key}` : `/admin/analytics`;
    router.push(route);
  };

  return (
    <div style={{ maxWidth: 1152, margin: '0 auto', padding: '32px 24px' }}>
      <AdminPageHeader
        breadcrumbs={[{ title: 'Administration' }, { title: 'Analytics' }]}
        title="Analytics & Telemetry"
        description={
          access.scope === 'GLOBAL'
            ? 'Platform-wide analytics and telemetry.'
            : 'Analytics scoped to your administered clubs.'
        }
      />

      <Tabs
        activeKey={currentTab}
        onChange={handleTabChange}
        items={tabItems}
        style={{ marginTop: 24 }}
      />

      <div style={{ marginTop: 16 }}>
        {children}
      </div>
    </div>
  );
}
