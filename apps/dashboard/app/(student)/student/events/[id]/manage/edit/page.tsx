'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useEventDetail } from '../../../../../../../hooks/useEventDetail';
import { useUpdateEvent } from '../../../../../../../hooks/useUpdateEvent';
import { useEventLifecycle } from '../../../../../../../hooks/useEventLifecycle';
import { useClubAdmin } from '../../../../../../../components/layout/ClubAdminProvider';
import { useAcademicBatches } from '../../../../../../../hooks/useAcademicBatches';
import { useClubs } from '../../../../../../../hooks/useClubs';
import { StudentFormStudio } from '../../../../../../../components/student/StudentFormStudio';
import { MultiSelect } from '../../../../../components/MultiSelect';
import { Modal } from '../../../../../../../components/ui/Modal';

const BANNER_PRESETS = [
  {
    label: 'Cyber Hackathon',
    category: 'HACKATHON',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Code & Dev Workshop',
    category: 'WORKSHOP',
    url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Design & Neon Jam',
    category: 'OTHER',
    url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Keynote & Tech Talk',
    category: 'SEMINAR',
    url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Campus Cultural Fest',
    category: 'CULTURAL',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'E-Sports & Gaming Arena',
    category: 'COMPETITION',
    url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
  },
];

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLocalTime = (d: Date) => {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const toIsoDateTime = (dateStr: string, timeStr: string): string | null => {
  if (!dateStr) return null;
  const time = timeStr ? (timeStr.length === 5 ? `${timeStr}:00` : timeStr) : '00:00:00';
  const d = new Date(`${dateStr}T${time}`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
};

const extractErrorMessage = (err: any): string => {
  if (!err) return 'Failed to save draft changes';
  if (typeof err === 'string') return err;
  if (err.data?.error) return err.data.error;
  if (err.data?.message) return err.data.message;
  if (err.data?.detail) return err.data.detail;
  if (Array.isArray(err.data?.issues) && err.data.issues.length > 0) {
    return err.data.issues.map((i: any) => i.message || `${i.path?.join('.')}: invalid`).join(', ');
  }
  if (err.message) return err.message;
  return 'Failed to save draft changes. Please verify all fields.';
};

export default function ManageEventEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const { isHydrated } = useClubAdmin();
  const { data: event, isLoading: isLoadingEvent } = useEventDetail(eventId);
  const updateEvent = useUpdateEvent(eventId);
  const { submitMutation } = useEventLifecycle();

  const { data: batchesData } = useAcademicBatches();
  const { data: clubsData } = useClubs();

  const eligibleClubs = clubsData?.data?.map(c => ({ id: c.id, name: c.name })) || [];

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    banner_url: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    registrationStartDate: '',
    registrationStartTime: '',
    registrationEndDate: '',
    registrationEndTime: '',
    location_name: '',
    event_type: 'WORKSHOP',
    visibility: 'PUBLIC',
    registration_type: 'INDIVIDUAL',
    attendance_type: 'SINGLE',
    max_capacity: '',
    max_participants: '',
    minimum_team_size: '',
    maximum_team_size: '',
    audience: 'ALL_STUDENTS',
    audience_batch_ids: [] as string[],
    collaborating_club_ids: [] as string[]
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      const metadata = event.metadata as any || {};
      const collabs = (event.eventClubs || [])
        .filter(ec => !ec.isPrimary)
        .map(ec => ec.clubId);

      // Parse start and end times in local timezone
      const start = new Date(event.startTime);
      let end = new Date(event.endTime);
      if (isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
        // Fallback: If corrupt or end <= start, default end to start + 2 hours
        end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      }

      const startDate = formatLocalDate(start);
      const startTime = formatLocalTime(start);
      const endDate = formatLocalDate(end);
      const endTime = formatLocalTime(end);

      let registrationStartDate = '';
      let registrationStartTime = '';
      if (event.registrationStartTime) {
        const regStart = new Date(event.registrationStartTime);
        registrationStartDate = formatLocalDate(regStart);
        registrationStartTime = formatLocalTime(regStart);
      }

      let registrationEndDate = '';
      let registrationEndTime = '';
      if (event.registrationEndTime) {
        const regEnd = new Date(event.registrationEndTime);
        registrationEndDate = formatLocalDate(regEnd);
        registrationEndTime = formatLocalTime(regEnd);
      }

      setFormData({
        title: event.title || '',
        description: event.description || '',
        banner_url: metadata.banner_url || '',
        startDate,
        startTime,
        endDate,
        endTime,
        registrationStartDate,
        registrationStartTime,
        registrationEndDate,
        registrationEndTime,
        location_name: event.locationName || '',
        event_type: event.eventType || 'WORKSHOP',
        visibility: event.visibility || 'PUBLIC',
        registration_type: event.registrationType || 'INDIVIDUAL',
        attendance_type: (event.attendanceType as any) || metadata.attendance_type || 'SINGLE',
        max_capacity: event.maxCapacity ? String(event.maxCapacity) : '',
        max_participants: (event as any).maxParticipants ? String((event as any).maxParticipants) : '',
        minimum_team_size: metadata.minimum_team_size ? String(metadata.minimum_team_size) : '',
        maximum_team_size: metadata.maximum_team_size ? String(metadata.maximum_team_size) : '',
        audience: (event.audience as any) || metadata.audience || 'ALL_STUDENTS',
        audience_batch_ids: event.audienceBatchIds || metadata.audience_batch_ids || [],
        collaborating_club_ids: collabs
      });
    }
  }, [event]);

  // If not draft or published, or locked, kick out to view/manage
  useEffect(() => {
    if (isHydrated && event && event.state !== 'DRAFT' && event.state !== 'PUBLISHED') {
      router.push(`/student/events/${eventId}/manage`);
    }
  }, [isHydrated, event, eventId, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (saveError) setSaveError(null);
  };

  const handleMultiSelectChange = (name: string, values: string[]) => {
    setFormData(prev => ({ ...prev, [name]: values }));
    if (saveError) setSaveError(null);
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    if (!formData.title || formData.title.trim().length < 3) {
      setSaveError('Event title must be at least 3 characters long.');
      return;
    }

    const startDateTime = toIsoDateTime(formData.startDate, formData.startTime);
    if (!startDateTime) {
      setSaveError('Please provide a valid event start date and time.');
      return;
    }

    const endDateTime = toIsoDateTime(formData.endDate, formData.endTime);
    if (!endDateTime) {
      setSaveError('Please provide a valid event end date and time.');
      return;
    }

    if (new Date(startDateTime).getTime() >= new Date(endDateTime).getTime()) {
      setSaveError('Event start time must be before end time.');
      return;
    }

    if (!formData.registrationStartDate || !formData.registrationStartTime) {
      setSaveError('Registration start date and time are required for Club Admins.');
      return;
    }

    if (!formData.registrationEndDate || !formData.registrationEndTime) {
      setSaveError('Registration end date and time are required for Club Admins.');
      return;
    }

    const regStartIso = toIsoDateTime(formData.registrationStartDate, formData.registrationStartTime);
    if (!regStartIso) {
      setSaveError('Invalid registration start date or time.');
      return;
    }
    const registration_start_time = regStartIso;

    const regEndIso = toIsoDateTime(formData.registrationEndDate, formData.registrationEndTime);
    if (!regEndIso) {
      setSaveError('Invalid registration end date or time.');
      return;
    }
    const registration_end_time = regEndIso;

    if (registration_start_time && registration_end_time) {
      if (new Date(registration_start_time).getTime() >= new Date(registration_end_time).getTime()) {
        setSaveError('Registration start time must be before registration end time.');
        return;
      }
    }

    if (registration_start_time && new Date(registration_start_time).getTime() >= new Date(endDateTime).getTime()) {
      setSaveError('Registration start time must be before event end time.');
      return;
    }

    if (registration_end_time && new Date(registration_end_time).getTime() > new Date(endDateTime).getTime()) {
      setSaveError('Registration end time must be less than or equal to event end time.');
      return;
    }

    if (formData.audience === 'SPECIFIC_BATCHES' && (!formData.audience_batch_ids || formData.audience_batch_ids.length === 0)) {
      setSaveError('Please select at least one batch for Specific Batches audience.');
      return;
    }

    if (formData.registration_type === 'TEAM') {
      const min = parseInt(formData.minimum_team_size, 10);
      const max = parseInt(formData.maximum_team_size, 10);
      if (isNaN(min) || min < 1) {
        setSaveError('Minimum team size must be an integer greater than or equal to 1.');
        return;
      }
      if (isNaN(max) || max < min) {
        setSaveError('Maximum team size must be greater than or equal to minimum team size.');
        return;
      }
    }

    const maxCapacity = formData.max_capacity ? parseInt(formData.max_capacity, 10) : null;
    if (formData.max_capacity && (isNaN(maxCapacity!) || maxCapacity! < 1)) {
      setSaveError('Maximum capacity must be a positive integer.');
      return;
    }

    const maxParticipants = formData.registration_type === 'TEAM'
      ? (formData.max_participants ? parseInt(formData.max_participants, 10) : null)
      : null;
    if (formData.registration_type === 'TEAM' && formData.max_participants && (isNaN(maxParticipants!) || maxParticipants! < 1)) {
      setSaveError('Maximum participants must be a positive integer.');
      return;
    }

    const metadata: Record<string, any> = {
      ...((event?.metadata as any) || {}),
    };

    if (formData.banner_url?.trim()) {
      metadata.banner_url = formData.banner_url.trim();
    } else {
      delete metadata.banner_url;
    }

    if (formData.registration_type === 'TEAM') {
      metadata.minimum_team_size = parseInt(formData.minimum_team_size, 10);
      metadata.maximum_team_size = parseInt(formData.maximum_team_size, 10);
    } else {
      delete metadata.minimum_team_size;
      delete metadata.maximum_team_size;
    }

    const payload: any = {
      title: formData.title.trim(),
      description: formData.description?.trim() || undefined,
      start_time: startDateTime,
      end_time: endDateTime,
      registration_start_time,
      registration_end_time,
      location_name: formData.location_name?.trim() || undefined,
      event_type: formData.event_type,
      visibility: formData.visibility,
      registration_type: formData.registration_type,
      attendance_type: formData.attendance_type,
      audience: formData.audience,
      audience_batch_ids: formData.audience === 'SPECIFIC_BATCHES' ? formData.audience_batch_ids : [],
      max_capacity: maxCapacity,
      max_participants: maxParticipants,
      metadata,
    };

    updateEvent.mutate(payload, {
      onSuccess: () => {
        setSaveSuccess(true);
        router.push(`/student/events/${eventId}/manage`);
      },
      onError: (err: any) => {
        const msg = extractErrorMessage(err);
        setSaveError(msg);
      }
    });
  };

  const handleConfirmSubmit = () => {
    setSubmitError(null);
    submitMutation.mutate(eventId, {
      onSuccess: () => {
        setIsSubmitModalOpen(false);
        router.push(`/student/events/${eventId}/manage`);
      },
      onError: (err: any) => {
        setSubmitError(err?.data?.error || err?.message || 'Failed to submit event for approval');
      }
    });
  };

  if (isLoadingEvent || !event) {
    return (
      <div className="w-full h-32 flex items-center justify-center border-2 border-white/15 bg-[#090a0f]">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 border-2 border-[#0057FF] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#a0a4b8]">Loading Event Specification...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-white/15 pb-4">
        <div>
          <Link 
            href={`/student/events/${eventId}/manage`}
            className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#0057FF] hover:text-white transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4" /> Discard Edits
          </Link>
          <h1 className="text-2xl font-black text-[#F5F5F2] uppercase tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Edit Event Parameters
          </h1>
        </div>
        {event.state === 'DRAFT' && (
          <button 
            onClick={() => setIsSubmitModalOpen(true)}
            disabled={submitMutation.isPending || updateEvent.isPending}
            className="px-6 py-3 bg-[#C8FF00] text-black font-mono font-black text-xs tracking-widest hover:bg-white transition-all uppercase flex items-center gap-2 border-2 border-black shadow-[3px_3px_0px_#000] whitespace-nowrap disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval ↗'}
          </button>
        )}
      </div>

      <form onSubmit={handleSaveDraft} className="space-y-8 p-6 md:p-8 border-2 border-white/15 bg-[#090a0f] shadow-[8px_8px_0px_#000]">
        
        {saveError && (
          <div className="p-4 bg-red-500/10 border-2 border-[#FF3B30] text-[#FF3B30] flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider">Cannot Save Changes</h4>
              <p className="text-xs font-mono mt-1 text-[#FF857F]">{saveError}</p>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="p-4 bg-[#C8FF00]/10 border-2 border-[#C8FF00] text-[#C8FF00] flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-mono uppercase tracking-wider font-bold">
              {event.state === 'DRAFT' ? 'Draft changes saved successfully! Redirecting...' : 'Changes saved successfully! Redirecting...'}
            </span>
          </div>
        )}

        {/* Basic Info */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-white/10 pb-2 mb-4">
            <span className="w-2 h-2 bg-[#0057FF] inline-block"></span>
            <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-[#F5F5F2] uppercase">Core Specification</h2>
          </div>
          
          <div>
            <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Event Title *</label>
            <input 
              required
              minLength={3}
              maxLength={255}
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-sm font-sans text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Description</label>
            <textarea 
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-sm font-sans text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors resize-y"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Event Banner Poster (Optional)</label>
            
            {/* Curated Presets Library */}
            <div className="mb-3">
              <span className="text-[10px] font-mono text-[#a0a4b8] uppercase tracking-wider block mb-2">
                Quick Curated Posters:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {BANNER_PRESETS.map((preset) => {
                  const isSelected = formData.banner_url === preset.url;
                  return (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, banner_url: preset.url }));
                        if (saveError) setSaveError(null);
                      }}
                      className={`relative aspect-video rounded overflow-hidden border-2 text-left transition-all group ${
                        isSelected ? 'border-[#C8FF00] shadow-[0_0_8px_rgba(200,255,0,0.5)]' : 'border-white/15 hover:border-white/40'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                        <span className="text-[9px] font-mono font-bold text-white truncate block w-full">
                          {preset.label}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#C8FF00] rounded-full border border-black shadow" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Banner URL */}
            <div>
              <span className="text-[10px] font-mono text-[#a0a4b8] uppercase tracking-wider block mb-1.5">
                Or Custom Image URL:
              </span>
              <div className="flex gap-2">
                <input 
                  type="text"
                  name="banner_url"
                  value={formData.banner_url}
                  onChange={handleChange}
                  className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
                  placeholder="https://images.unsplash.com/... or https://cdn.example.com/banner.jpg"
                />
                {formData.banner_url && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, banner_url: '' }))}
                    className="px-3 py-2 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono text-xs uppercase"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {formData.banner_url && (
              <div className="mt-3 border-2 border-white/15 overflow-hidden max-h-48 bg-black shadow-[4px_4px_0px_#000] rounded relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={formData.banner_url} 
                  alt="Banner preview" 
                  className="w-full h-48 object-cover" 
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
              </div>
            )}
          </div>
        </section>

        {/* Date & Time */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-white/10 pb-2 mb-4">
            <span className="w-2 h-2 bg-[#0057FF] inline-block"></span>
            <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-[#F5F5F2] uppercase">Schedule & Duration</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Start Date *</label>
              <input 
                required
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Start Time *</label>
              <input 
                required
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">End Date *</label>
              <input 
                required
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">End Time *</label>
              <input 
                required
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Registration Start Date *</label>
              <input 
                required
                type="date"
                name="registrationStartDate"
                value={formData.registrationStartDate}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Registration Start Time *</label>
              <input 
                required
                type="time"
                name="registrationStartTime"
                value={formData.registrationStartTime}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Registration End Date *</label>
              <input 
                required
                type="date"
                name="registrationEndDate"
                value={formData.registrationEndDate}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Registration End Time *</label>
              <input 
                required
                type="time"
                name="registrationEndTime"
                value={formData.registrationEndTime}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Location & Format */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-white/10 pb-2 mb-4">
            <span className="w-2 h-2 bg-[#0057FF] inline-block"></span>
            <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-[#F5F5F2] uppercase">Format & Venue</h2>
          </div>
          
          <div>
            <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Campus Venue / Location Name</label>
            <input 
              type="text"
              name="location_name"
              value={formData.location_name}
              onChange={handleChange}
              className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-sm font-sans text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Event Type</label>
              <select 
                name="event_type"
                value={formData.event_type}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              >
                <option value="WORKSHOP">Workshop</option>
                <option value="HACKATHON">Hackathon</option>
                <option value="SEMINAR">Seminar</option>
                <option value="COMPETITION">Competition</option>
                <option value="MEETUP">Meetup</option>
                <option value="CULTURAL">Cultural</option>
                <option value="SPORTS">Sports</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Visibility</label>
              <select 
                name="visibility"
                value={formData.visibility}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              >
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Attendance Ledger</label>
              <select 
                name="attendance_type"
                value={formData.attendance_type}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              >
                <option value="SINGLE">Single Session</option>
                <option value="MULTI_SESSION">Multi Session</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t-2 border-white/10">
            <h3 className="text-xs font-mono font-bold tracking-widest text-[#F5F5F2] uppercase mb-4">Audience & Access Scope</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Audience</label>
                <select 
                  name="audience"
                  value={formData.audience}
                  onChange={handleChange}
                  className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
                >
                  <option value="ALL_STUDENTS">All Students</option>
                  <option value="SPECIFIC_BATCHES">Specific Batches</option>
                </select>
              </div>

              {formData.audience === 'SPECIFIC_BATCHES' && (
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Eligible Batches</label>
                  <MultiSelect
                    options={batchesData?.map(b => ({ value: b.id, label: b.display_name })) || []}
                    selectedValues={formData.audience_batch_ids}
                    onChange={(values: string[]) => handleMultiSelectChange('audience_batch_ids', values)}
                    placeholder="Select batches..."
                  />
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Collaborating Clubs</label>
              <MultiSelect
                disabled
                options={eligibleClubs.map(c => ({ value: c.id, label: c.name }))}
                selectedValues={formData.collaborating_club_ids}
                onChange={(values: string[]) => handleMultiSelectChange('collaborating_club_ids', values)}
                placeholder="Select clubs..."
              />
              <p className="text-[10px] font-mono text-[#a0a4b8] mt-1">
                Collaborating clubs are locked after initial creation.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t-2 border-white/10">
            <h3 className="text-xs font-mono font-bold tracking-widest text-[#F5F5F2] uppercase mb-4">Registration & Quota</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Registration Type</label>
                <select 
                  name="registration_type"
                  value={formData.registration_type}
                  onChange={handleChange}
                  className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="TEAM">Team</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">
                  {formData.registration_type === 'TEAM' ? "Maximum Teams" : "Maximum Participants"}
                </label>
                <input 
                  type="number"
                  min="1"
                  name="max_capacity"
                  value={formData.max_capacity}
                  onChange={handleChange}
                  placeholder="Leave empty for unlimited"
                  className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
                />
              </div>

              {formData.registration_type === 'TEAM' && (
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">
                    Maximum Participants
                  </label>
                  <input 
                    type="number"
                    min="1"
                    name="max_participants"
                    value={formData.max_participants}
                    onChange={handleChange}
                    placeholder="Leave empty for unlimited"
                    className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
                  />
                </div>
              )}

              {formData.registration_type === 'TEAM' && (
                <>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Minimum Team Size *</label>
                    <input 
                      required
                      type="number"
                      min="1"
                      name="minimum_team_size"
                      value={formData.minimum_team_size}
                      onChange={handleChange}
                      placeholder="e.g. 2"
                      className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Maximum Team Size *</label>
                    <input 
                      required
                      type="number"
                      min="1"
                      name="maximum_team_size"
                      value={formData.maximum_team_size}
                      onChange={handleChange}
                      placeholder="e.g. 4"
                      className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {saveError && (
          <div className="p-3 bg-red-500/10 border border-[#FF3B30] text-[#FF3B30] font-mono text-xs uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="pt-6 border-t-2 border-white/10 flex justify-end gap-3">
          <Link 
            href={`/student/events/${eventId}/manage`}
            className="px-6 py-3 border-2 border-white/20 text-[#a0a4b8] hover:text-white hover:border-white font-mono font-bold text-xs tracking-widest uppercase transition-all"
          >
            Cancel
          </Link>
          <button 
            type="submit"
            disabled={updateEvent.isPending || submitMutation.isPending}
            className="px-8 py-3 bg-[#0057FF] text-white hover:bg-[#0042c7] border-2 border-[#0057FF] font-mono font-bold text-xs tracking-widest uppercase flex items-center gap-2 shadow-[3px_3px_0px_#000] disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4" />
            {updateEvent.isPending
              ? 'Saving...'
              : event.state === 'DRAFT'
              ? 'Save Draft Changes'
              : 'Save Changes'}
          </button>
        </div>

      </form>

      {/* FORM STUDIO (REGISTRATION & IN-EVENT FORMS) */}
      <div className="mt-8">
        <StudentFormStudio eventId={eventId} />
      </div>

      <Modal 
        isOpen={isSubmitModalOpen} 
        onClose={() => !submitMutation.isPending && setIsSubmitModalOpen(false)} 
        title="SUBMIT FOR APPROVAL"
      >
        <div className="p-6 bg-[#0d0e12] text-[#F5F5F2]">
          <p className="font-sans text-sm text-[#a0a4b8] mb-6 leading-relaxed">
            Are you sure you want to submit <strong className="text-white">{event.title}</strong> for approval? Once submitted, the draft specification will be locked from further edits while pending review.
          </p>

          {submitError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-[#FF3B30] text-[#FF3B30] font-mono text-xs uppercase tracking-wider">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(false)}
              disabled={submitMutation.isPending}
              className="px-5 py-2.5 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={submitMutation.isPending}
              className="px-5 py-2.5 bg-[#C8FF00] text-black hover:bg-white border-2 border-black font-mono text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_#000] disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Confirm Submission ↗'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
