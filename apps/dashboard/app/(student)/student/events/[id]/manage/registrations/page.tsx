'use client';

import React, { use, useState } from 'react';
import { useRegistrationsList } from '../../../../../../../hooks/useRegistrations';
import { useEventDetail } from '../../../../../../../hooks/useEventDetail';
import { StudentRegistrationResponsesModal } from '../../../../../../../components/student/StudentRegistrationResponsesModal';
import clsx from 'clsx';
import { Search } from 'lucide-react';

export default function ManageRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const { isLoading: isLoadingEvent } = useEventDetail(eventId);
  
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useRegistrationsList(
    eventId, 
    filterStatus || undefined
  );

  const registrations = data?.pages.flatMap(p => p.data) || [];

  const filteredRegistrations = registrations.filter(reg => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (reg.user.fullName || '').toLowerCase();
    const email = (reg.user.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  if (isLoadingEvent || isLoading) {
    return (
      <div className="w-full h-32 flex items-center justify-center border-2 border-white/15 bg-[#090a0f]">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 border-2 border-[#0057FF] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#a0a4b8]">Loading Registrations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        <div className="flex bg-[#090a0f] border-2 border-white/20 w-full sm:w-72 relative shadow-[3px_3px_0px_#000]">
          <Search className="w-4 h-4 text-[#a0a4b8] absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roster by student..."
            className="w-full bg-transparent pl-9 pr-3 py-2 text-xs font-mono text-[#F5F5F2] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#a0a4b8] hidden sm:inline">Filter:</span>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#090a0f] border-2 border-white/20 px-3 py-2 text-xs font-mono uppercase tracking-widest text-[#F5F5F2] focus:outline-none w-full sm:w-auto shadow-[3px_3px_0px_#000]"
          >
            <option value="">All Registrations</option>
            <option value="REGISTERED">Registered</option>
            <option value="WAITLISTED">Waitlisted</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

      </div>

      {/* Table Area */}
      <div className="overflow-x-auto border-2 border-white/15 bg-[#090a0f] shadow-[6px_6px_0px_#000]">
        <table className="w-full text-left border-collapse font-sans">
          <thead>
            <tr className="border-b-2 border-white/15 bg-[#0e1017]">
              <th className="px-5 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#a0a4b8]">Student Operative</th>
              <th className="px-5 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#a0a4b8]">Pass State</th>
              <th className="px-5 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#a0a4b8]">Timestamp</th>
              <th className="px-5 py-3.5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#a0a4b8]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRegistrations.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-14 text-center text-[#a0a4b8] text-xs font-mono uppercase tracking-widest">
                  No student registrations found matching query.
                </td>
              </tr>
            ) : (
              filteredRegistrations.map((reg) => (
                <tr key={reg.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4">
                    <div className="text-sm font-bold text-[#F5F5F2]" style={{ fontFamily: "'Syne', sans-serif" }}>
                      {reg.user.fullName || 'Unknown Student'}
                    </div>
                    <div className="text-xs font-mono text-[#a0a4b8] mt-0.5">
                      {reg.user.email}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={clsx(
                      "text-[10px] font-mono font-bold tracking-widest uppercase px-2.5 py-1 border shadow-[2px_2px_0px_#000]",
                      reg.registrationStatus === 'REGISTERED' ? "border-black bg-[#C8FF00] text-black font-black" :
                      reg.registrationStatus === 'WAITLISTED' ? "border-[#FF9500] bg-[#FF9500]/20 text-[#FF9500]" :
                      "border-white/15 text-white/50 bg-white/5"
                    )}>
                      {reg.registrationStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-[#a0a4b8] tabular-nums">
                    {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(reg.registeredAt))}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setSelectedRegistrationId(reg.id)}
                      className="px-4 py-2 border-2 border-white/20 text-[#a0a4b8] font-mono text-[10px] uppercase tracking-widest hover:text-[#00E5FF] hover:border-[#00E5FF] transition-all"
                    >
                      VIEW RESPONSES
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2.5 border-2 border-white/20 text-[#a0a4b8] font-mono text-xs uppercase tracking-widest hover:text-white hover:border-white transition-all disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Loading more...' : 'Load Additional Records'}
          </button>
        </div>
      )}
      
      <StudentRegistrationResponsesModal 
        eventId={eventId}
        registrationId={selectedRegistrationId}
        onClose={() => setSelectedRegistrationId(null)}
      />
    </div>
  );
}
