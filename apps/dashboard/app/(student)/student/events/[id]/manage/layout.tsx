'use client';

import React, { useEffect, use } from 'react';
import { useClubAdmin } from '../../../../../../components/layout/ClubAdminProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEventDetail } from '../../../../../../hooks/useEventDetail';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowLeft, LayoutDashboard, Users, UserCheck, ShieldAlert } from 'lucide-react';

export default function EventManageLayout({ children, params }: { children: React.ReactNode, params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const { isClubAdminMode, setClubAdminMode, setActiveClubId, managedClubs, isHydrated } = useClubAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const { data: event, isLoading } = useEventDetail(eventId);

  useEffect(() => {
    if (!isHydrated || isLoading) return;

    // Check if the current user manages a club associated with this event
    const eventClubIds = event?.eventClubs?.map(ec => ec.clubId) || [];
    const matchedClub = managedClubs.find(mc => eventClubIds.includes(mc.id));

    if (matchedClub) {
      if (!isClubAdminMode) {
        setClubAdminMode(true);
      }
      setActiveClubId(matchedClub.id);
    } else if (!isClubAdminMode) {
      // User is neither in admin mode nor manages this event's club
      router.push(`/student/events/${eventId}`);
    }
  }, [isHydrated, isLoading, isClubAdminMode, event, managedClubs, setClubAdminMode, setActiveClubId, eventId, router]);

  const tabs = [
    { name: 'Overview', path: `/student/events/${eventId}/manage`, icon: LayoutDashboard },
    { name: 'Registrations', path: `/student/events/${eventId}/manage/registrations`, icon: Users },
    { name: 'Teams', path: `/student/events/${eventId}/manage/teams`, icon: ShieldAlert, show: event?.registrationType === 'TEAM' },
    { name: 'Attendance', path: `/student/events/${eventId}/manage/attendance`, icon: UserCheck }
  ];

  if (!isHydrated || isLoading) {
    return (
      <div className="w-full flex-grow flex justify-center items-center h-64 bg-[#050505]">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 border-3 border-[#0057FF] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-mono text-[#a0a4b8] uppercase tracking-widest">Loading Event Management...</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="w-full max-w-[1360px] mx-auto px-6 py-8 md:px-10 md:py-12 bg-[#050505] text-[#F5F5F2] font-sans">
      
      <Link 
        href={`/student/events/${eventId}`}
        className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-[#0057FF] hover:text-white transition-colors mb-6 inline-flex"
      >
        <ArrowLeft className="w-4 h-4" /> Return to Public Event View
      </Link>

      <div className="mb-8 p-6 bg-[#090a0f] border-3 border-[#F5F5F2] shadow-[8px_8px_0px_#0057FF] relative overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#0057FF] via-[#C8FF00] to-[#0057FF] absolute top-0 left-0" />
        
        <div className="font-mono text-[11px] font-bold tracking-widest uppercase mb-1.5 text-[#0057FF] flex items-center gap-2.5">
          <span>EVENT MANAGEMENT PORTAL</span>
          <span className="text-white/30">•</span>
          <span className={clsx(
            "px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase shadow-[2px_2px_0px_#000]",
            event.state === 'PUBLISHED' ? "bg-[#C8FF00] text-black border border-black" :
            event.state === 'DRAFT' ? "bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]" :
            "bg-white/10 text-white/70 border border-white/20"
          )}>
            {event.state}
          </span>
        </div>
        <h1 
          className="text-2xl sm:text-3xl md:text-4xl font-black text-[#F5F5F2] tracking-tight leading-tight uppercase mt-1" 
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          {event.title}
        </h1>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-8">
        {/* Nav Rail */}
        <div className="w-full md:w-64 flex-shrink-0 flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
          {tabs.filter(t => t.show !== false).map((tab) => {
            const isActive = pathname === tab.path;
            return (
              <Link
                key={tab.name}
                href={tab.path}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 border-2 whitespace-nowrap transition-all shadow-[2px_2px_0px_#000]",
                  isActive 
                    ? "bg-[#0057FF] border-[#0057FF] text-white font-bold shadow-[4px_4px_0px_#000]" 
                    : "border-white/15 bg-[#090a0f] hover:border-white/40 text-[#a0a4b8] hover:text-white font-medium"
                )}
              >
                <tab.icon className={clsx("w-4 h-4", isActive ? "text-white" : "text-[#a0a4b8]")} />
                <span className="text-xs font-mono uppercase tracking-widest">{tab.name}</span>
              </Link>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-grow w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
