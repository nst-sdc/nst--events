'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { useClubAdmin } from '../../../../../../components/layout/ClubAdminProvider';
import { useCreateEvent, useSubmitEventForApproval } from '../../../../../../hooks/useCreateEvent';
import { useAcademicBatches } from '../../../../../../hooks/useAcademicBatches';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useClubs } from '../../../../../../hooks/useClubs';
import { MultiSelect } from '../../../../components/MultiSelect';

const createEventStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .ce-page {
    width: 100%;
    min-height: 100vh;
    background: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
  }

  .ce-inner {
    max-width: 860px;
    margin: 0 auto;
    padding: 60px 32px 100px 32px;
  }

  .ce-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .ce-micro-blue { color: var(--electric-blue); }

  /* ── Back Link ── */
  .ce-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
    text-decoration: none;
    margin-bottom: 32px;
    transition: color 0.15s;
  }
  .ce-back:hover { color: var(--electric-blue); }

  /* ── Section card ── */
  .ce-section {
    border: 2px solid rgba(245,245,242,0.15);
    background: var(--bg-dark-card);
    padding: 28px;
    margin-bottom: 24px;
  }
  .ce-section-title {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--electric-blue);
    border-bottom: 1px solid rgba(245,245,242,0.1);
    padding-bottom: 12px;
    margin-bottom: 20px;
  }

  /* ── Form Controls ── */
  .ce-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #a0a4b8;
    margin-bottom: 6px;
  }
  .ce-input, .ce-textarea, .ce-select {
    width: 100%;
    background: #000;
    border: 2px solid rgba(245,245,242,0.2);
    color: var(--bg-paper-white);
    font-family: var(--font-mono);
    font-size: 13px;
    padding: 10px 14px;
    outline: none;
    transition: border-color 0.15s;
    border-radius: 0 !important;
  }
  .ce-input:focus, .ce-textarea:focus, .ce-select:focus {
    border-color: var(--electric-blue);
  }
  .ce-input::placeholder, .ce-textarea::placeholder {
    color: #444;
  }
  .ce-textarea { resize: vertical; min-height: 110px; }
  .ce-select { appearance: none; }

  .ce-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 600px) {
    .ce-form-row { grid-template-columns: 1fr; }
    .ce-inner { padding: 40px 16px 80px 16px; }
  }

  .ce-field { margin-bottom: 16px; }
  .ce-field:last-child { margin-bottom: 0; }

  /* ── Sub-section divider ── */
  .ce-sub-title {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #555;
    border-top: 1px solid rgba(245,245,242,0.08);
    padding-top: 20px;
    margin-top: 20px;
    margin-bottom: 16px;
  }

  /* ── Image preview ── */
  .ce-img-preview {
    margin-top: 10px;
    border: 2px solid rgba(245,245,242,0.15);
    overflow: hidden;
    height: 160px;
    background: #111;
  }
  .ce-img-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* ── Action Row ── */
  .ce-action-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding-top: 20px;
    border-top: 2px solid rgba(245,245,242,0.1);
  }

  .ce-btn-cancel {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    color: var(--bg-paper-white);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 11px 22px;
    border: 2px solid rgba(245,245,242,0.3);
    text-decoration: none;
    transition: border-color 0.15s, background 0.15s;
    cursor: pointer;
  }
  .ce-btn-cancel:hover {
    border-color: var(--bg-paper-white);
    background: rgba(245,245,242,0.06);
  }

  .ce-btn-draft {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    color: var(--electric-blue);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 11px 22px;
    border: 2px solid var(--electric-blue);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .ce-btn-draft:hover:not(:disabled) {
    background: var(--electric-blue);
    color: #fff;
  }
  .ce-btn-draft:disabled { opacity: 0.5; cursor: not-allowed; }

  .ce-btn-submit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--acid-green);
    color: #000;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 11px 22px;
    border: 2px solid #000;
    cursor: pointer;
    box-shadow: 3px 3px 0px rgba(245,245,242,0.3);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .ce-btn-submit:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 5px 5px 0px rgba(245,245,242,0.3);
  }
  .ce-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export default function CreateEventPage() {
  const { activeClubId, isHydrated } = useClubAdmin();
  const router = useRouter();
  const createEvent = useCreateEvent();
  const submitApproval = useSubmitEventForApproval();

  const [submitAction, setSubmitAction] = useState<'DRAFT' | 'SUBMIT'>('DRAFT');
  const { data: clubsData } = useClubs();
  const { data: batchesData } = useAcademicBatches();

  const eligibleClubs = clubsData?.data?.map(c => ({ id: c.id, name: c.name })) || [];
  const collaboratingClubsOptions = eligibleClubs.filter(c => c.id !== activeClubId);

  useEffect(() => {
    if (isHydrated && !activeClubId) {
      router.push('/student/home');
    }
  }, [isHydrated, activeClubId, router]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    banner_url: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
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
    collaborating_club_ids: [] as string[],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleMultiSelectChange = (name: string, values: string[]) => {
    setFormData(prev => ({ ...prev, [name]: values }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClubId) return;

    const start_time = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
    const end_time = new Date(`${formData.endDate}T${formData.endTime}`).toISOString();

    if (!formData.banner_url.trim()) {
      alert('Event Banner Image URL is mandatory.');
      return;
    }

    const payload = {
      title: formData.title,
      description: formData.description,
      start_time,
      end_time,
      location_name: formData.location_name,
      event_type: formData.event_type,
      visibility: formData.visibility,
      registration_type: formData.registration_type,
      attendance_type: formData.attendance_type,
      max_capacity: formData.max_capacity ? parseInt(formData.max_capacity) : undefined,
      audience: formData.audience as any,
      audience_batch_ids: formData.audience === 'SPECIFIC_BATCHES' ? formData.audience_batch_ids : undefined,
      club_ids: [
        { club_id: activeClubId, is_primary: true },
        ...formData.collaborating_club_ids.map(id => ({ club_id: id, is_primary: false })),
      ],
      metadata: {
        banner_url: formData.banner_url.trim(),
        ...(formData.registration_type === 'TEAM' ? {
          minimum_team_size: formData.minimum_team_size ? parseInt(formData.minimum_team_size) : undefined,
          maximum_team_size: formData.maximum_team_size ? parseInt(formData.maximum_team_size) : undefined,
        } : {}),
      },
    };

    try {
      const event = await createEvent.mutateAsync(payload);
      if (submitAction === 'SUBMIT') {
        await submitApproval.mutateAsync(event.id);
      }
      router.push(`/student/events/${event.id}/manage`);
    } catch (error) {
      console.error('Failed to create/submit event:', error);
      alert('Failed to save event. Please try again.');
    }
  };

  if (!isHydrated) return null;

  return (
    <>
      <style href="student-create-event-styles" precedence="high">
        {createEventStyles}
      </style>
      <div className="ce-page">
        <div className="ce-inner">

          <Link href="/student/manage/events" className="ce-back">
            <ArrowLeft size={13} /> BACK TO EVENTS
          </Link>

          {/* Page Header */}
          <div style={{ borderBottom: '3px solid #fff', paddingBottom: 24, marginBottom: 40 }}>
            <div className="ce-micro ce-micro-blue" style={{ marginBottom: 8 }}>CLUB MANAGEMENT // CREATE EVENT</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5.5vw, 64px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: -1, lineHeight: 0.92, color: '#fff' }}>
              NEW EVENT
            </h1>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Basic Info */}
            <div className="ce-section">
              <div className="ce-section-title">BASIC DETAILS</div>

              <div className="ce-field">
                <label className="ce-label">Event Title *</label>
                <input
                  required minLength={3} maxLength={255}
                  type="text" name="title" value={formData.title}
                  onChange={handleChange} className="ce-input"
                  placeholder="e.g. AI Hackathon 2026"
                />
              </div>

              <div className="ce-field">
                <label className="ce-label">Description</label>
                <textarea
                  name="description" value={formData.description}
                  onChange={handleChange} className="ce-textarea"
                  placeholder="What is this event about?"
                />
              </div>

              <div className="ce-field">
                <label className="ce-label">Event Banner Image URL *</label>
                <input
                  required type="url" name="banner_url" value={formData.banner_url}
                  onChange={handleChange} className="ce-input"
                  placeholder="https://images.unsplash.com/..."
                />
                {formData.banner_url && (
                  <div className="ce-img-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formData.banner_url} alt="Banner preview"
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Date & Time */}
            <div className="ce-section">
              <div className="ce-section-title">DATE &amp; TIME</div>
              <div className="ce-form-row" style={{ marginBottom: 16 }}>
                <div>
                  <label className="ce-label">Start Date *</label>
                  <input required type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="ce-input" />
                </div>
                <div>
                  <label className="ce-label">Start Time *</label>
                  <input required type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="ce-input" />
                </div>
              </div>
              <div className="ce-form-row">
                <div>
                  <label className="ce-label">End Date *</label>
                  <input required type="date" name="endDate" value={formData.endDate} onChange={handleChange} className="ce-input" />
                </div>
                <div>
                  <label className="ce-label">End Time *</label>
                  <input required type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="ce-input" />
                </div>
              </div>
            </div>

            {/* Location & Format */}
            <div className="ce-section">
              <div className="ce-section-title">LOCATION &amp; FORMAT</div>

              <div className="ce-field">
                <label className="ce-label">Location Name</label>
                <input type="text" name="location_name" value={formData.location_name} onChange={handleChange} className="ce-input" placeholder="e.g. Auditorium 1" />
              </div>

              <div className="ce-form-row">
                <div className="ce-field">
                  <label className="ce-label">Event Type</label>
                  <select name="event_type" value={formData.event_type} onChange={handleChange} className="ce-select">
                    <option value="WORKSHOP">Workshop</option>
                    <option value="HACKATHON">Hackathon</option>
                    <option value="SEMINAR">Seminar</option>
                    <option value="SOCIAL">Social</option>
                    <option value="COMPETITION">Competition</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="ce-field">
                  <label className="ce-label">Visibility</label>
                  <select name="visibility" value={formData.visibility} onChange={handleChange} className="ce-select">
                    <option value="PUBLIC">Public</option>
                    <option value="PRIVATE">Private</option>
                    <option value="UNLISTED">Unlisted</option>
                  </select>
                </div>
              </div>

              <div className="ce-field">
                <label className="ce-label">Attendance Type</label>
                <select name="attendance_type" value={formData.attendance_type} onChange={handleChange} className="ce-select">
                  <option value="SINGLE">Single Session</option>
                  <option value="MULTI_SESSION">Multi Session</option>
                </select>
              </div>

              {/* Audience */}
              <div className="ce-sub-title">AUDIENCE &amp; ACCESS</div>
              <div className="ce-form-row" style={{ marginBottom: 16 }}>
                <div>
                  <label className="ce-label">Audience</label>
                  <select name="audience" value={formData.audience} onChange={handleChange} className="ce-select">
                    <option value="ALL_STUDENTS">All Students</option>
                    <option value="SPECIFIC_BATCHES">Specific Batches</option>
                  </select>
                </div>
                {formData.audience === 'SPECIFIC_BATCHES' && (
                  <div>
                    <label className="ce-label">Eligible Batches</label>
                    <MultiSelect
                      options={batchesData?.map(b => ({ value: b.id, label: b.display_name })) || []}
                      selectedValues={formData.audience_batch_ids}
                      onChange={(values: string[]) => handleMultiSelectChange('audience_batch_ids', values)}
                      placeholder="Select batches..."
                    />
                  </div>
                )}
              </div>

              <div className="ce-field">
                <label className="ce-label">Collaborating Clubs</label>
                <MultiSelect
                  options={collaboratingClubsOptions.map(c => ({ value: c.id, label: c.name }))}
                  selectedValues={formData.collaborating_club_ids}
                  onChange={(values: string[]) => handleMultiSelectChange('collaborating_club_ids', values)}
                  placeholder="Select clubs..."
                />
              </div>

              {/* Registration & Capacity */}
              <div className="ce-sub-title">REGISTRATION &amp; CAPACITY</div>
              <div className="ce-form-row">
                <div className="ce-field">
                  <label className="ce-label">Registration Type</label>
                  <select name="registration_type" value={formData.registration_type} onChange={handleChange} className="ce-select">
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="TEAM">Team</option>
                  </select>
                </div>
                <div className="ce-field">
                  <label className="ce-label">
                    {formData.registration_type === 'TEAM' ? 'Maximum Teams' : 'Maximum Participants'}
                  </label>
                  <input
                    type="number" min="1" name="max_capacity" value={formData.max_capacity}
                    onChange={handleChange} placeholder="Unlimited"
                    className="ce-input"
                  />
                </div>
              </div>

              {formData.registration_type === 'TEAM' && (
                <div className="ce-form-row">
                  <div className="ce-field">
                    <label className="ce-label">Min Team Size *</label>
                    <input required type="number" min="1" name="minimum_team_size" value={formData.minimum_team_size} onChange={handleChange} placeholder="e.g. 2" className="ce-input" />
                  </div>
                  <div className="ce-field">
                    <label className="ce-label">Max Team Size *</label>
                    <input required type="number" min="1" name="maximum_team_size" value={formData.maximum_team_size} onChange={handleChange} placeholder="e.g. 4" className="ce-input" />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="ce-action-row">
              <Link href="/student/manage/events" className="ce-btn-cancel">
                CANCEL
              </Link>
              <button
                type="submit"
                onClick={() => setSubmitAction('DRAFT')}
                disabled={createEvent.isPending || submitApproval.isPending}
                className="ce-btn-draft"
              >
                {createEvent.isPending && submitAction === 'DRAFT' ? 'SAVING...' : 'SAVE DRAFT'}
              </button>
              <button
                type="submit"
                onClick={() => setSubmitAction('SUBMIT')}
                disabled={createEvent.isPending || submitApproval.isPending}
                className="ce-btn-submit"
              >
                {(createEvent.isPending || submitApproval.isPending) && submitAction === 'SUBMIT' ? 'SUBMITTING...' : 'SUBMIT FOR APPROVAL ↗'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
