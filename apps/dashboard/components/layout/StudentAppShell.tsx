'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Calendar, User, Bell, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useUnreadCount } from '../../hooks/useNotifications';
import { BackButton } from '../ui/BackButton';
import { StudentNotificationPopover } from '../notifications/StudentNotificationPopover';
import { useClubAdmin } from './ClubAdminProvider';
import { ClubAdminToggle } from './ClubAdminToggle';
import { NstLogoMark } from '../brand/NstLogo';
import { StudentFooter } from '../brand/StudentFooter';

const studentNavItems = [
  { label: 'Home', href: '/student/home', icon: Home },
  { label: 'Campus', href: '/student/campus', icon: Compass, exactMatch: false },
  { label: 'My Events', href: '/student/events', icon: Calendar },
  { label: 'Profile', href: '/student/profile', icon: User, exactMatch: false },
];

const adminNavItems = [
  { label: 'Club Hub', href: '/student/manage/club', icon: Compass },
  { label: 'Events', href: '/student/manage/events', icon: Calendar, exactMatch: false },
];

import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';

export function StudentAppShell({ children }: { children: React.ReactNode }) {
  useRealtimeNotifications();
  const pathname = usePathname();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const { isClubAdminMode } = useClubAdmin();

  const navItems = isClubAdminMode ? adminNavItems : studentNavItems;

  const isActive = (item: { href: string; exactMatch?: boolean }) => {
    if (item.exactMatch === false) {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return pathname === item.href;
  };

  const segments = pathname.split('/').filter(Boolean);
  const isDeepRoute = segments.length > (segments[1] === 'campus' || segments[1] === 'manage' ? 3 : 2);

  const isCampusActive = !isClubAdminMode && isActive({ href: '/student/campus', exactMatch: false });
  const isEditorial = pathname.startsWith('/student');
  const rawFirstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'STUDENT';
  const displayFirstName = rawFirstName.toUpperCase();

  return (
    <div className="min-h-screen flex flex-col font-sans pb-[64px] md:pb-0 bg-[#050505] text-[#F5F5F2]">
      
      {/* Global Header (Desktop & Mobile) */}
      <header className="sticky top-0 z-50 bg-[#050505] border-b border-[#F5F5F2]/15 text-[#F5F5F2] transform-gpu">
        <div className="flex justify-between items-center w-full px-4 md:px-8 py-3 max-w-[1360px] mx-auto">
          
          {/* Brand & Mobile Back Button */}
          <div className="flex items-center gap-6">
            {isDeepRoute ? (
              <BackButton className="md:hidden" />
            ) : null}
            <Link
              aria-label="NST Events Home"
              href={isClubAdminMode ? "/student/manage/club" : "/student/home"}
              className={clsx(
                "flex items-center gap-3 transition-opacity hover:opacity-90",
                isDeepRoute ? "hidden md:flex" : "flex"
              )}
            >
              <div className="w-8 h-8 bg-[#0057FF] flex items-center justify-center shadow-[3px_3px_0px_#ffffff] flex-shrink-0">
                <NstLogoMark size={20} color="#ffffff" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-['Syne',sans-serif] text-[19px] font-black tracking-tight text-[#F5F5F2] uppercase">
                  NST EVENTS
                </span>
                {isClubAdminMode ? (
                  <span className="font-['JetBrains_Mono',monospace] text-[8px] font-bold tracking-widest text-[#9a9db0] uppercase mt-0.5">
                    CLUB PORTAL
                  </span>
                ) : null}
              </div>
            </Link>
          </div>

          {/* Right: Navigation Links (Desktop) & Trailing Actions */}
          <div className="flex items-center gap-8">
            <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-7 font-['JetBrains_Mono',monospace] text-[11px] font-bold uppercase tracking-[1.5px]">
              {!isClubAdminMode ? (
                <>
                  <Link
                    aria-current={isActive({ href: '/student/home' }) ? 'page' : undefined}
                    href="/student/home"
                    className={clsx(
                      "transition-colors duration-200", 
                      isActive({ href: '/student/home' }) ? "text-[#0057FF]" : "text-[#a0a4b8] hover:text-[#0057FF]"
                    )}
                  >
                    HOME
                  </Link>
                  
                  {/* Campus Dropdown */}
                  <div className="relative group">
                    <Link 
                      href="/student/campus" 
                      className={clsx(
                        "flex items-center gap-1 transition-colors relative z-10",
                        isCampusActive ? "text-[#0057FF]" : "text-[#a0a4b8] hover:text-[#0057FF]"
                      )}
                    >
                      CAMPUS &darr;
                    </Link>
                    
                    {/* Nested Menu Container with transparent spacer for unbroken hit area */}
                    <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="w-48 bg-[#0d0e12] border-2 border-[#000000] shadow-[4px_4px_0px_#0057FF]">
                        <Link href="/student/campus/discover" className="block px-4 py-2.5 text-[11px] text-[#a0a4b8] hover:text-[#ffffff] hover:bg-[#0057FF] border-b border-[#222] transition-colors">DISCOVER</Link>
                        <Link href="/student/campus/leaderboard" className="block px-4 py-2.5 text-[11px] text-[#a0a4b8] hover:text-[#ffffff] hover:bg-[#0057FF] border-b border-[#222] transition-colors">LEADERBOARD</Link>
                        <Link href="/student/campus/clubs" className="block px-4 py-2.5 text-[11px] text-[#a0a4b8] hover:text-[#ffffff] hover:bg-[#0057FF] transition-colors">CLUBS</Link>
                      </div>
                    </div>
                  </div>

                  <Link
                    aria-current={isActive({ href: '/student/events' }) ? 'page' : undefined}
                    href="/student/events"
                    className={clsx(
                      "transition-colors duration-200", 
                      isActive({ href: '/student/events' }) ? "text-[#0057FF]" : "text-[#a0a4b8] hover:text-[#0057FF]"
                    )}
                  >
                    MY EVENTS
                  </Link>
                </>
              ) : (
                <>
                  <Link aria-current={isActive({ href: '/student/manage/club' }) ? 'page' : undefined} href="/student/manage/club" className={clsx(
                    "pb-1 transition-all duration-200", 
                    isActive({ href: '/student/manage/club' }) ? "text-[#0057FF] border-b-2 border-[#0057FF]" : "text-[#a0a4b8] hover:text-[#0057FF]"
                  )}>
                    Club Hub
                  </Link>
                  <Link aria-current={isActive({ href: '/student/manage/events', exactMatch: false }) ? 'page' : undefined} href="/student/manage/events" className={clsx(
                    "pb-1 transition-all duration-200", 
                    isActive({ href: '/student/manage/events', exactMatch: false }) ? "text-[#0057FF] border-b-2 border-[#0057FF]" : "text-[#a0a4b8] hover:text-[#0057FF]"
                  )}>
                    Events
                  </Link>
                </>
              )}
            </nav>

            <div className="flex items-center gap-4">
              <ClubAdminToggle />

              {/* Notifications */}
              <StudentNotificationPopover />

              {/* User Badge (hidden on reduced screen sizes) */}
              <Link aria-label="User Profile" href="/student/profile" className="hidden md:flex items-center gap-2 group">
                <div className="font-['JetBrains_Mono',monospace] text-[11px] font-bold tracking-wider text-[#ffffff] bg-[#0057FF] px-3.5 py-1.5 uppercase shadow-[3px_3px_0px_#ffffff] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
                  {displayFirstName}
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={clsx("flex-grow flex flex-col w-full", isEditorial ? "" : "max-w-[1440px] mx-auto")}>
        {children}
      </div>

      {/* Global Student Footer */}
      <StudentFooter />

      {/* Mobile Bottom Navigation (Hidden on Desktop & Deep Routes) */}
      <nav className={clsx(
        "fixed bottom-0 w-full bg-[#050505] border-t border-[#F5F5F2]/15 z-50 md:hidden",
        isDeepRoute && "hidden"
      )}>
        <div className="flex justify-around items-center h-[64px]">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center justify-center w-full h-full relative transition-colors",
                  active ? "text-[#0057FF]" : "text-[#a0a4b8] hover:text-[#0057FF]"
                )}
              >
                <item.icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                <span
                  className="font-['JetBrains_Mono',monospace] text-[9px] mt-1 uppercase tracking-widest font-bold"
                >
                  {item.label}
                </span>
                {active && (
                  <div className="absolute top-0 w-1/2 h-[2px] bg-[#0057FF]"></div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
