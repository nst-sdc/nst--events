'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Calendar, User, Users, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import clsx from 'clsx';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { BackButton } from '../ui/BackButton';
import { StudentNotificationPopover } from '../notifications/StudentNotificationPopover';
import { useClubAdmin } from './ClubAdminProvider';
import { ClubAdminToggle } from './ClubAdminToggle';
import { NstLogoMark } from '../brand/NstLogo';
import { isPlatformAdmin, isFacultyAdmin } from '../../lib/auth-helpers';
import { StudentFooter } from '../brand/StudentFooter';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';

const studentNavItems = [
  { label: 'Home', href: '/student/home', icon: Home },
  { label: 'Events', href: '/student/campus/discover', icon: Calendar, exactMatch: false },
  { label: 'Campus', href: '/student/campus', icon: Compass, exactMatch: false },
  { label: 'My Events', href: '/student/events', icon: Calendar },
  { label: 'Projects', href: '/projects', icon: Compass, exactMatch: false },
  { label: 'Students', href: '/students', icon: Users, exactMatch: false },
  { label: 'Profile', href: '/my/profile', icon: User, exactMatch: false },
];

const publicNavItems = [
  { label: 'Events', href: '/student/campus/discover', icon: Calendar, exactMatch: false },
  { label: 'Projects', href: '/projects', icon: Compass, exactMatch: false },
  { label: 'Students', href: '/students', icon: Users, exactMatch: false },
  { label: 'Sign In', href: '/login', icon: User },
];

const adminNavItems = [
  { label: 'Club Hub', href: '/student/manage/club', icon: Compass },
  { label: 'Events', href: '/student/manage/events', icon: Calendar, exactMatch: false },
];

const shellStyles = `
  /* Scoped Light Theme Overrides for Student Shell */
  html.light .student-shell-wrapper {
    background-color: #FFFFFF !important;
    color: #050505 !important;
  }

  html.light .student-app-header {
    background-color: #FFFFFF !important;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
    color: #050505 !important;
  }

  html.light .student-app-header .brand-logo-text {
    color: #050505 !important;
  }

  html.light .student-app-header .nav-link-item {
    color: #555566 !important;
  }

  html.light .student-app-header .nav-link-item:hover {
    color: #0057FF !important;
  }

  html.light .student-app-header .nav-link-item-active {
    color: #0057FF !important;
  }

  html.light .campus-dropdown-menu {
    background: #FFFFFF !important;
    border: 2px solid #000000 !important;
    box-shadow: 4px 4px 0px #0057FF !important;
  }

  html.light .campus-dropdown-item {
    color: #050505 !important;
    border-bottom: 1px solid #ECECE8 !important;
  }

  html.light .campus-dropdown-item:hover {
    background: #0057FF !important;
    color: #FFFFFF !important;
  }

  html.light .student-user-badge {
    box-shadow: 3px 3px 0px #000000 !important;
  }

  html.light .student-bottom-nav {
    background-color: #FFFFFF !important;
    border-top: 1px solid rgba(0, 0, 0, 0.12) !important;
  }

  html.light .student-bottom-nav .nav-link-item {
    color: #555566 !important;
  }

  html.light .student-bottom-nav .nav-link-item:hover {
    color: #0057FF !important;
  }

  /* Scoped Light Theme Overrides for Student Header Actions */
  html.light .student-notification-btn {
    border-color: rgba(0, 0, 0, 0.25) !important;
    color: #050505 !important;
    background-color: transparent !important;
  }

  html.light .student-notification-btn:hover {
    border-color: #000000 !important;
    color: #0057FF !important;
    box-shadow: 3px 3px 0px #000000 !important;
  }

  html.light .student-notification-btn[aria-expanded="true"] {
    background-color: rgba(0, 87, 255, 0.1) !important;
    border-color: #0057FF !important;
    color: #0057FF !important;
    box-shadow: 3px 3px 0px #0057FF !important;
  }

  html.light .student-notification-dot {
    border-color: #FFFFFF !important;
  }

  html.light .student-notification-popover {
    background: #FFFFFF !important;
    border: 3px solid #000000 !important;
    box-shadow: 6px 6px 0px #0057FF !important;
    color: #050505 !important;
  }

  html.light .student-notification-popover-header {
    background: #F5F5F2 !important;
    border-bottom: 2px solid #000000 !important;
  }

  html.light .student-notification-popover-header .popover-title {
    color: #050505 !important;
  }

  html.light .student-notification-empty-title {
    color: #050505 !important;
  }

  html.light .student-notification-item {
    border-bottom-color: rgba(0, 0, 0, 0.1) !important;
  }

  html.light .student-notification-item-title {
    color: #050505 !important;
  }

  html.light .student-notification-popover-footer {
    background: #F5F5F2 !important;
    border-top: 2px solid #000000 !important;
  }

  /* Light theme toggle button */
  html.light .student-theme-toggle-btn {
    border-color: rgba(0, 0, 0, 0.25) !important;
    color: #050505 !important;
    background-color: transparent !important;
  }

  html.light .student-theme-toggle-btn:hover {
    border-color: #000000 !important;
    color: #0057FF !important;
    box-shadow: 3px 3px 0px #000000 !important;
  }
`;

export function StudentAppShell({ children }: { children: React.ReactNode }) {
  useRealtimeNotifications();
  const pathname = usePathname() || '';
  const { data: user } = useCurrentUser();
  const { isClubAdminMode } = useClubAdmin();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const rAF = requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      });
      return () => cancelAnimationFrame(rAF);
    }
  }, [pathname]);

  const navItems = isClubAdminMode ? adminNavItems : (user ? studentNavItems : publicNavItems);

  const isActive = (item: { href: string; exactMatch?: boolean }) => {
    if (item.href === '/student/campus/discover') {
      return pathname === '/student/campus/discover' || pathname.startsWith('/student/campus/discover') || pathname.startsWith('/event/');
    }
    if (item.href === '/student/campus') {
      return pathname === '/student/campus' || (pathname.startsWith('/student/campus/') && !pathname.startsWith('/student/campus/discover'));
    }
    if (item.exactMatch === false) {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return pathname === item.href;
  };

  const segments = pathname.split('/').filter(Boolean);
  const isDeepRoute = segments.length > (segments[1] === 'campus' || segments[1] === 'manage' ? 3 : 2);

  const isEditorial = pathname.startsWith('/student') || pathname.startsWith('/my') || pathname.startsWith('/projects') || pathname.startsWith('/students');
  const rawFirstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'STUDENT';
  const displayFirstName = rawFirstName.toUpperCase();

  const logoTargetHref = isClubAdminMode ? '/student/manage/club' : (user ? '/student/home' : '/login');

  return (
    <div className="min-h-screen flex flex-col font-sans pb-[64px] md:pb-0 bg-[#050505] text-[#F5F5F2] student-shell-wrapper">
      <style dangerouslySetInnerHTML={{ __html: shellStyles }} />
      
      {/* Global Header (Desktop & Mobile) */}
      <header className="sticky top-0 z-50 bg-[#050505] border-b border-[#F5F5F2]/15 text-[#F5F5F2] transform-gpu student-app-header">
        <div className="flex justify-between items-center w-full px-4 md:px-8 py-3 max-w-[1360px] mx-auto">
          
          {/* Brand & Mobile Back Button */}
          <div className="flex items-center gap-6">
            {isDeepRoute ? (
              <BackButton className="md:hidden" />
            ) : null}
            <Link
              aria-label="NST Events Home"
              href={logoTargetHref}
              className={clsx(
                "flex items-center gap-3 transition-opacity hover:opacity-90",
                isDeepRoute ? "hidden md:flex" : "flex"
              )}
            >
              <div className="w-8 h-8 bg-[#0057FF] flex items-center justify-center shadow-[2px_2px_0px_#ffffff] shrink-0 text-white">
                <NstLogoMark className="w-5 h-5 fill-current" />
              </div>
              <span className="font-['Syne',sans-serif] font-black text-lg tracking-wider uppercase text-[#F5F5F2] brand-logo-text">
                NST EVENTS
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-8">
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 text-[11px] font-['JetBrains_Mono',monospace] font-bold tracking-widest uppercase">
              {!isClubAdminMode ? (
                user ? (
                  <>
                    <Link
                      aria-current={isActive({ href: '/student/home' }) ? 'page' : undefined}
                      href="/student/home"
                      className={clsx(
                        "transition-colors duration-200 nav-link-item", 
                        isActive({ href: '/student/home' }) ? "text-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                      )}
                    >
                      HOME
                    </Link>

                    <Link
                      aria-current={isActive({ href: '/student/campus', exactMatch: false }) ? 'page' : undefined}
                      href="/student/campus"
                      className={clsx(
                        "transition-colors duration-200 nav-link-item", 
                        isActive({ href: '/student/campus', exactMatch: false }) ? "text-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                      )}
                    >
                      CAMPUS
                    </Link>

                    <Link
                      aria-current={isActive({ href: '/student/events' }) ? 'page' : undefined}
                      href="/student/events"
                      className={clsx(
                        "transition-colors duration-200 nav-link-item", 
                        isActive({ href: '/student/events' }) ? "text-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                      )}
                    >
                      MY EVENTS
                    </Link>

                    <Link
                      aria-current={isActive({ href: '/projects', exactMatch: false }) ? 'page' : undefined}
                      href="/projects"
                      className={clsx(
                        "transition-colors duration-200 nav-link-item", 
                        isActive({ href: '/projects', exactMatch: false }) ? "text-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                      )}
                    >
                      PROJECTS
                    </Link>

                    <Link
                      aria-current={isActive({ href: '/students', exactMatch: false }) ? 'page' : undefined}
                      href="/students"
                      className={clsx(
                        "transition-colors duration-200 nav-link-item", 
                        isActive({ href: '/students', exactMatch: false }) ? "text-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                      )}
                    >
                      STUDENTS
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      aria-current={isActive({ href: '/student/campus/discover' }) ? 'page' : undefined}
                      href="/student/campus/discover"
                      className={clsx(
                        "transition-colors duration-200 nav-link-item", 
                        isActive({ href: '/student/campus/discover' }) ? "text-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                      )}
                    >
                      EVENTS
                    </Link>

                    <Link
                      aria-current={isActive({ href: '/projects', exactMatch: false }) ? 'page' : undefined}
                      href="/projects"
                      className={clsx(
                        "transition-colors duration-200 nav-link-item", 
                        isActive({ href: '/projects', exactMatch: false }) ? "text-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                      )}
                    >
                      PROJECTS
                    </Link>

                    <Link
                      aria-current={isActive({ href: '/students', exactMatch: false }) ? 'page' : undefined}
                      href="/students"
                      className={clsx(
                        "transition-colors duration-200 nav-link-item", 
                        isActive({ href: '/students', exactMatch: false }) ? "text-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                      )}
                    >
                      STUDENTS
                    </Link>
                  </>
                )
              ) : (
                <>
                  <Link aria-current={isActive({ href: '/student/manage/club' }) ? 'page' : undefined} href="/student/manage/club" className={clsx(
                    "pb-1 transition-all duration-200 nav-link-item", 
                    isActive({ href: '/student/manage/club' }) ? "text-[#0057FF] border-b-2 border-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                  )}>
                    Club Hub
                  </Link>
                  <Link aria-current={isActive({ href: '/student/manage/events', exactMatch: false }) ? 'page' : undefined} href="/student/manage/events" className={clsx(
                    "pb-1 transition-all duration-200 nav-link-item", 
                    isActive({ href: '/student/manage/events', exactMatch: false }) ? "text-[#0057FF] border-b-2 border-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                  )}>
                    Events
                  </Link>
                </>
              )}
            </nav>

            <div className="flex items-center gap-3 md:gap-4">
              {(!user || isPlatformAdmin(user) || isFacultyAdmin(user)) && (
                <Link
                  href="/admin"
                  className="hidden md:inline-flex items-center text-[10px] font-mono font-bold text-[#a0a4b8] hover:text-[#0057FF] border border-white/20 px-2.5 py-1 uppercase tracking-wider transition-colors"
                >
                  ADMIN OPS &rarr;
                </Link>
              )}
              <ClubAdminToggle />

              {/* Theme Toggle (Light / Dark Mode) */}
              {mounted ? (
                <button
                  type="button"
                  onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
                  aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
                  title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
                  style={{ width: '36px', height: '36px', borderRadius: 0 }}
                  className="flex items-center justify-center border-2 border-[#F5F5F2]/25 text-[#ffffff] cursor-pointer transition-all hover:border-white hover:shadow-[3px_3px_0px_#ffffff] student-theme-toggle-btn"
                >
                  {resolvedTheme === 'light' ? (
                    <Moon size={17} strokeWidth={2} />
                  ) : (
                    <Sun size={17} strokeWidth={2} />
                  )}
                </button>
              ) : (
                <div style={{ width: '36px', height: '36px' }} />
              )}

              {/* Notifications */}
              <StudentNotificationPopover />

              {/* User Badge or Sign In button */}
              {user ? (
                <Link aria-label="User Profile" href="/my/profile" className="hidden md:flex items-center gap-2 group">
                  <div
                    title={displayFirstName}
                    className="font-['JetBrains_Mono',monospace] text-[11px] font-bold tracking-wider text-[#ffffff] bg-[#0057FF] px-3.5 py-1.5 uppercase shadow-[3px_3px_0px_#ffffff] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 max-w-[140px] truncate student-user-badge"
                  >
                    {displayFirstName}
                  </div>
                </Link>
              ) : (
                <Link aria-label="Sign In" href="/login" className="hidden md:flex items-center gap-2 group">
                  <div className="font-['JetBrains_Mono',monospace] text-[11px] font-bold tracking-wider text-[#ffffff] bg-[#0057FF] px-3.5 py-1.5 uppercase shadow-[3px_3px_0px_#ffffff] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
                    SIGN IN
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={clsx("grow flex flex-col w-full", isEditorial ? "" : "max-w-[1440px] mx-auto")}>
        {children}
      </div>

      {/* Global Student Footer */}
      <StudentFooter />

      {/* Mobile Bottom Navigation (Hidden on Desktop & Deep Routes) */}
      <nav className={clsx(
        "fixed bottom-0 w-full bg-[#050505] border-t border-[#F5F5F2]/15 z-50 md:hidden student-bottom-nav",
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
                  "flex flex-col items-center justify-center w-full h-full relative transition-colors nav-link-item",
                  active ? "text-[#0057FF] nav-link-item-active" : "text-[#a0a4b8] hover:text-[#0057FF]"
                )}
              >
                <item.icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                <span
                  className="font-['JetBrains_Mono',monospace] text-[9px] mt-1 uppercase tracking-widest font-bold"
                >
                  {item.label}
                </span>
                {active && (
                  <div className="absolute top-0 w-1/2 h-0.5 bg-[#0057FF]"></div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
