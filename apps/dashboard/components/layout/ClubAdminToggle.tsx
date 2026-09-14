'use client';

import React from 'react';
import { useClubAdmin } from './ClubAdminProvider';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

export function ClubAdminToggle() {
  const { isClubAdminMode, setClubAdminMode, activeClubId, setActiveClubId, managedClubs, isHydrated } = useClubAdmin();
  const router = useRouter();

  // Do not render anything if not hydrated or if they have no managed clubs
  if (!isHydrated || managedClubs.length === 0) {
    return null;
  }

  const activeClub = managedClubs.find(c => c.id === activeClubId);

  const handleToggle = (toAdmin: boolean) => {
    setClubAdminMode(toAdmin);
    if (toAdmin) {
      router.push(`/student/manage/club`);
    } else {
      router.push(`/student/home`);
    }
  };

  const handleClubChange = (clubId: string) => {
    setActiveClubId(clubId);
    if (isClubAdminMode) {
      router.push(`/student/manage/club`);
    }
  };

  return (
    <div className="flex items-center border-2 border-white/20 bg-[#090a0f] p-0.5 shadow-[3px_3px_0px_#000] font-['JetBrains_Mono',monospace] text-[11px] uppercase tracking-wider font-bold hidden md:flex">
      {/* Student Mode Button */}
      <button 
        onClick={() => handleToggle(false)}
        className={clsx(
          "px-3 py-1.5 transition-all",
          !isClubAdminMode 
            ? "bg-[#0057FF] text-white shadow-[2px_2px_0px_#000]" 
            : "text-[#a0a4b8] hover:text-white"
        )}
      >
        STUDENT
      </button>

      {/* Club Admin Mode Button & Dropdown */}
      <div className={clsx(
        "flex items-center transition-all relative group",
        isClubAdminMode 
          ? "bg-[#0057FF] text-white shadow-[2px_2px_0px_#000]" 
          : "text-[#a0a4b8] hover:text-white"
      )}>
        <button 
          onClick={() => {
            if (!isClubAdminMode) handleToggle(true);
          }}
          className="pl-3 py-1.5 flex items-center h-full text-left"
        >
          CLUB ADMIN
          {isClubAdminMode && activeClub && (
            <span className="ml-1 opacity-80">· {activeClub.name}</span>
          )}
        </button>

        {isClubAdminMode && managedClubs.length > 1 && (
          <div className="relative flex items-center h-full">
            <div className="px-2 py-1.5 cursor-pointer h-full flex items-center hover:opacity-80">
              <ChevronDown className="w-3 h-3" />
            </div>
            
            {/* Dropdown Menu */}
            <div className="absolute top-full right-0 mt-1.5 w-52 bg-[#0d0e12] border-2 border-black shadow-[4px_4px_0px_#0057FF] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              {managedClubs.map(club => (
                <button
                  key={club.id}
                  onClick={() => handleClubChange(club.id)}
                  className={clsx(
                    "w-full text-left px-3.5 py-2.5 border-b border-white/10 last:border-b-0 text-[11px] tracking-wider transition-colors",
                    activeClubId === club.id 
                      ? "text-white bg-[#0057FF] font-bold" 
                      : "text-[#a0a4b8] hover:text-white hover:bg-white/10"
                  )}
                >
                  {club.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {(!isClubAdminMode || managedClubs.length <= 1) && (
          <div className="pr-3" />
        )}
      </div>
    </div>
  );
}
