'use client';
/* eslint-disable react/no-unescaped-entities */

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useNotifications, useReadNotification, useUnreadCount, Notification } from '../../hooks/useNotifications';
import { resolveStudentNotificationTarget } from '../../lib/student-notification-utils';

export function StudentNotificationPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: unreadData } = useUnreadCount();
  const { data, isLoading, isError } = useNotifications();
  const { mutate: markAsRead } = useReadNotification();

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const notifications = data?.pages[0]?.data.slice(0, 5) || [];
  const unreadCount = unreadData?.unread_count || 0;

  const handleNotificationClick = (notification: Notification, targetHref: string | null) => {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    if (targetHref) {
      router.push(targetHref);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    if (!now) return '';
    const diffMs = now - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}M AGO`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}H AGO`;
    return `${Math.floor(diffHrs / 24)}D AGO`;
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger: Brutalist Square Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        style={{
          width: '36px',
          height: '36px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          borderRadius: 0,
          transition: 'all 0.15s ease'
        }}
        className={clsx(
          "student-notification-btn border-2 transition-all",
          isOpen
            ? "bg-[#0057FF]/15 border-[#0057FF] text-[#0057FF] shadow-[3px_3px_0px_#0057FF]"
            : "bg-transparent border-[#F5F5F2]/25 text-[#ffffff] hover:border-white hover:shadow-[3px_3px_0px_#ffffff]"
        )}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span 
            className="student-notification-dot"
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              width: '8px',
              height: '8px',
              background: '#0057FF',
              border: '1px solid #ffffff',
              borderRadius: 0
            }} 
          />
        )}
      </button>

      {/* Popover Content */}
      {isOpen && (
        <div
          className="student-notification-popover"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 10px)',
            width: '340px',
            background: 'var(--bg-dark-card, #0d0e12)',
            border: '3px solid #ffffff',
            boxShadow: '8px 8px 0px var(--electric-blue, #0057FF)',
            zIndex: 9999,
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            className="student-notification-popover-header"
            style={{
              padding: '12px 16px',
              background: '#000000',
              borderBottom: '2px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span
              className="popover-title"
              style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: '#ffffff'
              }}
            >
              NOTIFICATIONS // INBOX
            </span>
            {unreadCount > 0 ? (
              <span
                style={{
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  fontSize: '10px',
                  fontWeight: 700,
                  background: 'var(--electric-blue, #0057FF)',
                  color: '#ffffff',
                  padding: '2px 8px',
                  letterSpacing: '1px'
                }}
              >
                {unreadCount} NEW
              </span>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#a0a4b8',
                  letterSpacing: '1px'
                }}
              >
                SYNCED
              </span>
            )}
          </div>

          {/* Notification List Container */}
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {isLoading && (
              <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ height: '14px', background: 'rgba(255,255,255,0.1)', width: '70%' }} />
                <div style={{ height: '12px', background: 'rgba(255,255,255,0.06)', width: '90%' }} />
              </div>
            )}

            {isError && (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--warm-red, #FF3B30)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}
                >
                  FAULT // FAILED TO LOAD
                </div>
              </div>
            )}

            {!isLoading && !isError && notifications.length === 0 && (
              <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                <div
                  className="student-notification-empty-title"
                  style={{
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '1px',
                    marginBottom: '6px'
                  }}
                >
                  YOU'RE ALL CAUGHT UP.
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    fontSize: '10px',
                    color: '#a0a4b8',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase'
                  }}
                >
                  NO NEW CAMPUS DISPATCHES
                </div>
              </div>
            )}

            {!isLoading && !isError && notifications.length > 0 && (
              <div>
                {notifications.map((notif) => {
                  const isUnread = !notif.readAt;
                  const targetHref = resolveStudentNotificationTarget(notif);

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif, targetHref)}
                      style={{
                        padding: '14px 16px',
                        borderBottom: '1px dashed rgba(245, 245, 242, 0.18)',
                        background: isUnread ? 'rgba(0, 87, 255, 0.08)' : 'transparent',
                        borderLeft: isUnread ? '3px solid var(--electric-blue, #0057FF)' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                      className="hover:bg-white/[0.06] student-notification-item"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                        <div
                          className="student-notification-item-title"
                          style={{
                            fontFamily: 'var(--font-display, "Syne", sans-serif)',
                            fontSize: '13px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            color: isUnread ? '#ffffff' : '#e0e0e0',
                            letterSpacing: '-0.3px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            paddingRight: '8px'
                          }}
                        >
                          {notif.title || notif.body}
                        </div>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                            fontSize: '9px',
                            fontWeight: 700,
                            color: isUnread ? 'var(--electric-blue, #0057FF)' : '#888888',
                            flexShrink: 0
                          }}
                        >
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      {notif.title && (
                        <div
                          style={{
                            fontFamily: 'var(--font-body, "Inter", sans-serif)',
                            fontSize: '12px',
                            color: '#a0a4b8',
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {notif.body}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div
            className="student-notification-popover-footer"
            style={{
              borderTop: '2px solid #ffffff',
              background: '#000000',
              padding: '10px 16px',
              textAlign: 'center'
            }}
          >
            <Link
              href="/student/notifications"
              onClick={() => setIsOpen(false)}
              style={{
                display: 'block',
                width: '100%',
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: 'var(--electric-blue, #0057FF)',
                textDecoration: 'none',
                transition: 'color 0.15s'
              }}
              className="hover:text-white"
            >
              VIEW ALL DISPATCHES ↗
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
