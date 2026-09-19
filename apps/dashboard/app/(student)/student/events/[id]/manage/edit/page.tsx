'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { useEventDetail } from '../../../../../../../hooks/useEventDetail';
import { useUpdateEvent } from '../../../../../../../hooks/useUpdateEvent';
import { useEventLifecycle } from '../../../../../../../hooks/useEventLifecycle';
import { useClubAdmin } from '../../../../../../../components/layout/ClubAdminProvider';
import { useAcademicBatches } from '../../../../../../../hooks/useAcademicBatches';
import { useClubs } from '../../../../../../../hooks/useClubs';
import { StudentEventFormFieldsManager } from '../../../../../../../components/student/StudentEventFormFieldsManager';
import { StudentEventFormsManager } from '../../../../../../../components/student/StudentEventFormsManager';
import { MultiSelect } from '../../../../../components/MultiSelect';
import { Modal } from '../../../../../../../components/ui/Modal';

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
    minimum_team_size: '',
    maximum_team_size: '',
    audience: 'ALL_STUDENTS',
    audience_batch_ids: [] as string[],
    collaborating_club_ids: [] as string[]
  });

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
      const end = new Date(event.endTime);

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
  };

  const handleMultiSelectChange = (name: string, values: string[]) => {
    setFormData(prev => ({ ...prev, [name]: values }));
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();

    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}:00`).toISOString();
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}:00`).toISOString();

    let registration_start_time;
    let registration_end_time;
    if (formData.registrationStartDate && formData.registrationStartTime) {
      registration_start_time = new Date(`${formData.registrationStartDate}T${formData.registrationStartTime}:00`).toISOString();
    }
    if (formData.registrationEndDate && formData.registrationEndTime) {
      registration_end_time = new Date(`${formData.registrationEndDate}T${formData.registrationEndTime}:00`).toISOString();
    }

    const payload: any = {
      title: formData.title,
      description: formData.description || undefined,
      start_time: startDateTime,
      end_time: endDateTime,
      registration_start_time,
      registration_end_time,
      location_name: formData.location_name || undefined,
      event_type: formData.event_type,
      visibility: formData.visibility,
      registration_type: formData.registration_type,
      attendance_type: formData.attendance_type,
      audience: formData.audience,
      audience_batch_ids: formData.audience === 'SPECIFIC_BATCHES' ? formData.audience_batch_ids : [],
      max_capacity: formData.max_capacity ? parseInt(formData.max_capacity, 10) : undefined,
      metadata: {
        banner_url: formData.banner_url || undefined,
        minimum_team_size: formData.registration_type === 'TEAM' && formData.minimum_team_size ? parseInt(formData.minimum_team_size, 10) : undefined,
        maximum_team_size: formData.registration_type === 'TEAM' && formData.maximum_team_size ? parseInt(formData.maximum_team_size, 10) : undefined
      }
    };

    updateEvent.mutate(payload, {
      onSuccess: () => {
        router.push(`/student/events/${eventId}/manage`);
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
        <button 
          onClick={() => setIsSubmitModalOpen(true)}
          disabled={submitMutation.isPending || updateEvent.isPending}
          className="px-6 py-3 bg-[#C8FF00] text-black font-mono font-black text-xs tracking-widest hover:bg-white transition-all uppercase flex items-center gap-2 border-2 border-black shadow-[3px_3px_0px_#000] whitespace-nowrap disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval ↗'}
        </button>
      </div>

      <form onSubmit={handleSaveDraft} className="space-y-8 p-6 md:p-8 border-2 border-white/15 bg-[#090a0f] shadow-[8px_8px_0px_#000]">
        
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
            <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Event Banner URL *</label>
            <input 
              required
              type="url"
              name="banner_url"
              value={formData.banner_url}
              onChange={handleChange}
              className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-sm font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              placeholder="https://images.unsplash.com/... or https://cdn.example.com/banner.jpg"
            />
            {formData.banner_url && (
              <div className="mt-3 border-2 border-white/15 overflow-hidden max-h-48 bg-black shadow-[4px_4px_0px_#000]">
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
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Registration Start Date (Optional)</label>
              <input 
                type="date"
                name="registrationStartDate"
                value={formData.registrationStartDate}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Registration Start Time</label>
              <input 
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
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Registration End Date (Optional)</label>
              <input 
                type="date"
                name="registrationEndDate"
                value={formData.registrationEndDate}
                onChange={handleChange}
                className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#a0a4b8] uppercase tracking-widest mb-1.5">Registration End Time</label>
              <input 
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
                <option value="SOCIAL">Social</option>
                <option value="COMPETITION">Competition</option>
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
                <option value="UNLISTED">Unlisted</option>
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
            {updateEvent.isPending ? 'Saving...' : 'Save Draft Changes'}
          </button>
        </div>

      </form>

      {/* REGISTRATION FORM FIELDS CONFIG */}
      <div className="mt-8">
        <StudentEventFormFieldsManager eventId={eventId} />
      </div>

      {/* ADDITIONAL SCHEDULED FORMS */}
      <div className="mt-8">
        <StudentEventFormsManager eventId={eventId} />
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
