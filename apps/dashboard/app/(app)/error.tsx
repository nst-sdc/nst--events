'use client';

import { useEffect } from 'react';
import { Button, Result, theme } from 'antd';
import { ReloadOutlined, HomeOutlined, MailOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { formatErrorMessage } from '../../lib/error-utils';

const SUPPORT_EMAIL = 'support@nstsdc.com';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const { token } = theme.useToken();

  useEffect(() => {
    // Log error internally without exposing backend traces to client
    console.error('[Dashboard Error Boundary]:', error);
  }, [error]);

  const humanMessage = formatErrorMessage(
    error?.message,
    'We encountered an unexpected error while loading this page.'
  );

  const handleContactSupport = () => {
    const subject = encodeURIComponent('Dashboard Error Report - NST Events');
    const body = encodeURIComponent(
      `Error Summary: ${humanMessage}\nDigest: ${error?.digest || 'N/A'}\nURL: ${typeof window !== 'undefined' ? window.location.href : ''}\n\nPlease describe what you were doing when this happened:`
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Result
        status="error"
        title={
          <span style={{ fontWeight: 700, fontSize: 20, color: token.colorTextHeading }}>
            Something Went Wrong
          </span>
        }
        subTitle={
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <p style={{ fontSize: 14, color: token.colorTextSecondary, marginBottom: 8 }}>
              {humanMessage}
            </p>
            {error?.digest && (
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 11,
                  color: token.colorTextTertiary,
                  backgroundColor: token.colorFillAlter,
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                Error ID: {error.digest}
              </span>
            )}
          </div>
        }
        extra={[
          <Button
            key="retry"
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => reset()}
            style={{ borderRadius: 6 }}
          >
            Try Again
          </Button>,
          <Button
            key="home"
            icon={<HomeOutlined />}
            onClick={() => router.push('/dashboard')}
            style={{ borderRadius: 6 }}
          >
            Return to Dashboard
          </Button>,
          <Button
            key="support"
            type="link"
            icon={<MailOutlined />}
            onClick={handleContactSupport}
            style={{ borderRadius: 6 }}
          >
            Contact Support
          </Button>,
        ]}
      />
    </div>
  );
}
