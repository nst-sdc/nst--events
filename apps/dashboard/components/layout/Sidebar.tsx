'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';
import { ContextSwitcher } from '../ui/ContextSwitcher';
import { DevClubBadge } from '../brand/DevClubBadge';
import { DevClubCreditsModal } from '../brand/DevClubCreditsModal';
import { DASHBOARD_APP_VERSION } from '../../lib/brand-config';

import { useCurrentUser } from '../../hooks/useCurrentUser';
import { isPlatformAdmin, isFacultyAdmin, canViewStudentDirectory } from '../../lib/auth-helpers';

export function Sidebar() {
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();

  const platformAdmin = isPlatformAdmin(currentUser);
  const facultyAdmin = isFacultyAdmin(currentUser);
  const adminAccess = platformAdmin || facultyAdmin;

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/events', label: 'Events' },
    { href: '/clubs', label: 'Clubs' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/profile', label: 'Profile' },
  ];

  if (adminAccess) {
    links.push({ href: '/admin', label: 'Admin Hub' });
    
    if (canViewStudentDirectory(currentUser)) {
      links.push({ href: '/admin/users', label: 'Users & Roles' });
    }

    links.push({ href: '/admin/academic-programs', label: 'Academic Programs' });
    links.push({ href: '/admin/academic-batches', label: 'Academic Batches' });
  }

  const isFacultyMentor = currentUser?.club_memberships?.some(cm => cm.role === 'FACULTY_MENTOR');
  if (adminAccess || isFacultyMentor) {
    links.push({ href: '/admin/approvals', label: 'Approvals' });
  }

  const isClubAdmin = currentUser?.club_memberships?.some(cm => cm.role === 'CLUB_ADMIN');
  if (adminAccess || isClubAdmin) {
    links.push({ href: '/admin/analytics', label: 'Analytics' });
  }

  if (platformAdmin) {
    links.push({ href: '/admin/audit-logs', label: 'Audit Logs' });
    links.push({ href: '/admin/queues', label: 'Queue Monitoring' });
  }

  const [isCreditsOpen, setIsCreditsOpen] = useState(false);

  return (
    <>
      <aside className="w-64 border-r border-gray-800 bg-gray-900 min-h-screen hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-800 shrink-0">
          <h1 className="text-xl font-bold text-white">NST Events</h1>
        </div>
        <ContextSwitcher />
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(`${link.href}/`)) || (link.href === '/admin' && pathname === '/admin');
            return (
              <Link 
                key={link.href}
                href={link.href} 
                className={cn(
                  "block px-3 py-2 text-sm font-medium rounded-md",
                  isActive 
                    ? "bg-gray-800 text-white" 
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800 bg-gray-950/60 shrink-0">
          <DevClubBadge
            variant="terminal"
            size="sm"
            onClick={() => setIsCreditsOpen(true)}
            className="w-full justify-center"
          />
          <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500 font-mono">
            <span>v{DASHBOARD_APP_VERSION}</span>
            <button
              type="button"
              onClick={() => setIsCreditsOpen(true)}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Credits
            </button>
          </div>
        </div>
      </aside>
      <DevClubCreditsModal
        isOpen={isCreditsOpen}
        onClose={() => setIsCreditsOpen(false)}
      />
    </>
  );
}
