'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEventDetail, useMyRegistration } from '../../../../../hooks/useEventDetail';
import { useRegisterForEvent, useCancelRegistration } from '../../../../../hooks/useRegisterForEvent';
import { useTeamLookup } from '../../../../../hooks/useTeams';
import { ArrowLeft, Clock, MapPin, Users, Info, Calendar } from 'lucide-react';
import { Modal } from '../../../../../components/ui/Modal';
import { TeamGatewayModal } from './components/TeamGatewayModal';
import { AttendanceDisputeModal } from './components/AttendanceDisputeModal';
import { useAttendanceDisputes, useMyAttendance } from '../../../../../hooks/useAttendance';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { useEventLifecycle } from '../../../../../hooks/useEventLifecycle';
import { useClubAdmin } from '../../../../../components/layout/ClubAdminProvider';
import { useEventFormFields } from '../../../../../hooks/useEventFormFields';
import { useProfileValues } from '../../../../../hooks/useProfileValues';

const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

const eventDetailStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --electric-blue-dark: #0042c7;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --warm-amber: #FF9500;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .ed-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  .ed-inner {
    max-width: 1320px;
    margin: 0 auto;
    padding: 40px 32px 100px 32px;
  }

  /* ── Texture & Noise ── */
  .collage-noise-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.35;
    background-image: radial-gradient(rgba(245, 245, 242, 0.08) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  /* ── Micro Annotations ── */
  .ed-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .ed-micro-blue { color: var(--electric-blue); }
  .ed-micro-green { color: var(--acid-green); }

  /* ── Back Button ── */
  .ed-back-btn {
    background: transparent;
    color: #ffffff;
    border: 2px solid rgba(245, 245, 242, 0.25);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 8px 18px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.15s;
    margin-bottom: 28px;
    border-radius: 0 !important;
  }
  .ed-back-btn:hover {
    border-color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
    transform: translate(-2px, -2px);
    box-shadow: 3px 3px 0px #ffffff;
  }

  /* ── Banner Frame ── */
  .ed-banner-card {
    width: 100%;
    height: 340px;
    background: #111;
    border: 3px solid #ffffff;
    box-shadow: 12px 12px 0px var(--electric-blue);
    margin-bottom: 36px;
    position: relative;
    overflow: hidden;
    border-radius: 0 !important;
  }
  .ed-banner-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(120%) grayscale(30%);
  }
  .ed-tape-strip {
    position: absolute;
    top: -12px;
    left: 40px;
    background: rgba(245, 245, 242, 0.85);
    color: #000;
    border: 1px dashed rgba(0, 0, 0, 0.4);
    padding: 3px 18px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    transform: rotate(-3deg);
    z-index: 5;
  }

  /* ── Header Headline Area ── */
  .ed-header {
    border-bottom: 3px solid var(--bg-paper-white);
    padding-bottom: 28px;
    margin-bottom: 40px;
    position: relative;
  }

  .ed-watermark {
    position: absolute;
    top: -24px;
    right: 0;
    font-family: var(--font-display);
    font-size: clamp(60px, 12vw, 150px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.03);
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    line-height: 0.8;
  }

  .ed-title {
    font-family: var(--font-display);
    font-size: clamp(36px, 6vw, 76px);
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: -2px;
    text-transform: uppercase;
    color: var(--bg-paper-white);
    margin-top: 8px;
    margin-bottom: 18px;
    word-break: break-word;
  }

  .ed-host-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(245, 245, 242, 0.25);
    padding: 6px 14px;
    text-decoration: none;
    color: inherit;
    transition: all 0.15s;
    border-radius: 0 !important;
  }
  .ed-host-badge:hover {
    border-color: var(--electric-blue);
    background: rgba(0, 87, 255, 0.12);
  }

  /* ── Main Two Column Layout ── */
  .ed-grid-layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 48px;
    align-items: start;
  }

  /* ── Section Box ── */
  .ed-box {
    border: 3px solid var(--bg-paper-white);
    background: var(--bg-dark-card);
    padding: 32px;
    box-shadow: 10px 10px 0px #000000;
    margin-bottom: 32px;
    border-radius: 0 !important;
  }

  .ed-box-blue {
    box-shadow: 10px 10px 0px var(--electric-blue);
  }

  .ed-box-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #ffffff;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }

  .ed-box-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.5px;
    color: #ffffff;
  }

  /* ── Primary CTA Button ── */
  .ed-cta-btn {
    width: 100%;
    background: var(--electric-blue);
    color: #ffffff;
    border: 2px solid var(--bg-paper-white);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 14px 24px;
    cursor: pointer;
    box-shadow: 4px 4px 0px #ffffff;
    transition: transform 0.15s, box-shadow 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    border-radius: 0 !important;
  }
  .ed-cta-btn:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #ffffff;
  }
  .ed-cta-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ed-status-badge {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 10px 14px;
    text-align: center;
    border: 2px solid rgba(245, 245, 242, 0.25);
    background: #000000;
    color: #a0a4b8;
    width: 100%;
    display: block;
  }

  .ed-status-badge.confirmed {
    background: rgba(0, 87, 255, 0.15);
    color: var(--electric-blue);
    border-color: var(--electric-blue);
  }

  .ed-status-badge.waitlisted {
    background: rgba(255, 149, 0, 0.15);
    color: var(--warm-amber);
    border-color: var(--warm-amber);
  }

  /* ── Logistic Items ── */
  .ed-spec-item {
    display: flex;
    gap: 14px;
    padding: 14px 0;
    border-bottom: 1px dashed rgba(245, 245, 242, 0.18);
  }
  .ed-spec-item:last-child {
    border-bottom: none;
  }

  @media (max-width: 992px) {
    .ed-grid-layout {
      grid-template-columns: 1fr;
      gap: 32px;
    }
    .ed-inner {
      padding: 32px 16px 80px 16px;
    }
  }
`;

export default function StudentEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const { setClubAdminMode, setActiveClubId } = useClubAdmin();

  const { data: event, isLoading: isLoadingEvent, isError: isErrorEvent } = useEventDetail(eventId);
  const { data: registration, isLoading: isLoadingReg } = useMyRegistration(eventId);

  const { mutate: register, isPending: isRegistering } = useRegisterForEvent(eventId);
  const { mutate: cancel, isPending: isCanceling } = useCancelRegistration(eventId);

  const { data: team, isLoading: isLoadingTeam, isError: isErrorTeam } = useTeamLookup(registration?.team_id);

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isTeamGatewayOpen, setIsTeamGatewayOpen] = useState(false);
  const [disputeSessionId, setDisputeSessionId] = useState<string | null>(null);

  const { data: eventFormFields } = useEventFormFields(eventId);
  const { data: profileValues } = useProfileValues();
  const [formResponses, setFormResponses] = useState<Record<string, string>>({});
  const [preFilledFields, setPreFilledFields] = useState<Record<string, string>>({});
  const [editableFields, setEditableFields] = useState<string[]>([]);

  const { data: disputesData, isLoading: isLoadingDisputes } = useAttendanceDisputes(eventId);
  const { data: myAttendanceData, isLoading: isLoadingAttendance } = useMyAttendance(eventId);
  const myAttendanceRecords = myAttendanceData?.pages.flatMap(p => p.data) || [];

  const { data: currentUser } = useCurrentUser();
  const { submitMutation } = useEventLifecycle();

  const isClubAdminForEvent = event?.eventClubs?.some((ec: any) => 
    ec.isPrimary && currentUser?.club_memberships?.some(m => m.club_id === ec.club.id && m.role === 'CLUB_ADMIN')
  );

  // Grouped Loading state
  if (isLoadingEvent || isLoadingReg) {
    return (
      <>
        <style href="student-event-detail-styles" precedence="high">
          {eventDetailStyles}
        </style>
        <div className="ed-page">
          <div className="ed-inner" style={{ paddingTop: '80px', textAlign: 'center' }}>
            <div className="ed-micro ed-micro-blue" style={{ marginBottom: '16px' }}>
              QUERYING ARCHIVE // EVENT DOSSIER
            </div>
            <div style={{ height: '48px', background: 'rgba(255,255,255,0.1)', width: '60%', margin: '0 auto 20px auto' }} />
            <div style={{ height: '24px', background: 'rgba(255,255,255,0.06)', width: '40%', margin: '0 auto' }} />
          </div>
        </div>
      </>
    );
  }

  if (isErrorEvent || !event) {
    return (
      <>
        <style href="student-event-detail-styles" precedence="high">
          {eventDetailStyles}
        </style>
        <div className="ed-page">
          <div className="ed-inner" style={{ paddingTop: '100px', textAlign: 'center', maxWidth: '640px' }}>
            <div className="ed-micro" style={{ color: 'var(--warm-red)', marginBottom: '16px' }}>
              FAULT // RECORD NOT FOUND
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '16px' }}>
              EVENT COULD NOT BE LOADED
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: '#a0a4b8', marginBottom: '32px', lineHeight: 1.6 }}>
              This campus event may have been removed or is temporarily unavailable.
            </p>
            <button onClick={() => router.back()} className="ed-cta-btn" style={{ display: 'inline-flex', width: 'auto' }}>
              ← RETURN TO PREVIOUS VIEW
            </button>
          </div>
        </div>
      </>
    );
  }

  const primaryClub = event.eventClubs?.find((c) => c.isPrimary)?.club;
  const dbNow = new Date();
  const isPermanentLock = new Date(event.endTime).getTime() + 24 * 60 * 60 * 1000 <= dbNow.getTime();
  const isLocked = event.lock_state !== 'UNLOCKED' || isPermanentLock;
  const isEnded = new Date(event.endTime) <= dbNow;

  const registrationCount = (event as any).registrationCount ?? (event as any).registration_count;
  const isCapacityFull = event.maxCapacity !== null && typeof registrationCount === 'number' && registrationCount >= event.maxCapacity;

  const handleOpenRegisterModal = () => {
    const initial: Record<string, string> = {};
    const preFilled: Record<string, string> = {};
    if (eventFormFields && profileValues) {
      eventFormFields.forEach(f => {
        const profileMatch = profileValues.find(p => p.fieldDefinitionId === f.fieldDefinitionId);
        if (profileMatch) {
          initial[f.fieldDefinitionId] = profileMatch.value;
          preFilled[f.fieldDefinitionId] = profileMatch.value;
        }
      });
    }
    setFormResponses(initial);
    setPreFilledFields(preFilled);
    setEditableFields([]);
    setIsRegisterModalOpen(true);
  };

  const handleRegisterConfirm = () => {
    // Validate required fields
    if (eventFormFields) {
      const missingRequired = eventFormFields.find(f => f.isRequired && !formResponses[f.fieldDefinitionId]);
      if (missingRequired) {
        alert(`Please fill in required field: ${missingRequired.fieldDefinition.label}`);
        return;
      }
    }

    const payload = {
      responses: Object.entries(formResponses).map(([fieldDefinitionId, value]) => ({
        fieldDefinitionId,
        value,
      }))
    };

    register(payload, {
      onSuccess: () => {
        setIsRegisterModalOpen(false);
      }
    });
  };

  const handleCancelConfirm = () => {
    cancel(undefined, {
      onSuccess: () => {
        setIsCancelModalOpen(false);
      }
    });
  };

  const renderRegistrationAction = () => {
    if (isEnded) {
      return (
        <div className="ed-status-badge">
          SESSION CONCLUDED // EVENT ENDED
        </div>
      );
    }

    if (isLocked) {
      return (
        <div className="ed-status-badge">
          SYSTEM NOTICE // REGISTRATION LOCKED
        </div>
      );
    }

    const isUnregistered = !registration || registration.status === 'NOT_REGISTERED' || registration.status === 'CANCELLED';
    
    if (isUnregistered) {
      if (event.registrationStatus === 'UPCOMING') {
        const openTime = event.registrationStartTime 
          ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.registrationStartTime)) 
          : 'SOON';
        return (
          <div className="ed-status-badge">
            SYSTEM NOTICE // REGISTRATION OPENS {openTime.toUpperCase()}
          </div>
        );
      }

      if (event.registrationStatus === 'CLOSED') {
        return (
          <div className="ed-status-badge">
            SYSTEM NOTICE // REGISTRATION CLOSED
          </div>
        );
      }
    }

    // Unregistered State for Team Event
    if (event.registrationType === 'TEAM' && (!registration || (!registration.team_id && registration.status !== 'REGISTERED' && registration.status !== 'WAITLISTED'))) {
      return (
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#a0a4b8', marginBottom: '14px', lineHeight: 1.5 }}>
            This is a collective team competition. Assemble or join an official squad to secure access.
          </p>
          <button 
            onClick={() => setIsTeamGatewayOpen(true)}
            className="ed-cta-btn"
          >
            REGISTER / JOIN SQUAD ↗
          </button>
        </div>
      );
    }

    // Unregistered State for Individual Event
    if (!registration || registration.status === 'NOT_REGISTERED') {
      return (
        <button
          onClick={handleOpenRegisterModal}
          disabled={isRegistering}
          className="ed-cta-btn"
        >
          {isCapacityFull ? 'JOIN WAITLIST QUEUE ↗' : 'CONFIRM REGISTRATION PASS ↗'}
        </button>
      );
    }

    return null;
  };

  const renderCancellation = () => {
    if (isEnded || isLocked || !registration || registration.status === 'NOT_REGISTERED' || registration.status === 'CANCELLED') return null;
    if (event.registrationType === 'TEAM') return null;

    return (
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <button 
          onClick={() => setIsCancelModalOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: 'var(--warm-red)',
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >
          DISMISS / CANCEL REGISTRATION ✕
        </button>
      </div>
    );
  };

  const formatModalDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(dateString));
  };

  const formatModalTime = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(dateString));
  };

  const renderDisputeSection = () => {
    if (registration?.status !== 'REGISTERED' || !event.attendanceSessions?.length) return null;

    if (isLoadingDisputes || isLoadingAttendance) {
      return (
        <div style={{ marginTop: '20px', padding: '16px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center' }}>
          <span className="ed-micro">CHECKING ATTENDANCE LEDGER...</span>
        </div>
      );
    }

    return (
      <div style={{ marginTop: '24px' }}>
        <div className="ed-micro ed-micro-blue" style={{ borderBottom: '1px dashed rgba(255,255,255,0.2)', paddingBottom: '8px', marginBottom: '12px' }}>
          VERIFIED CHECK-IN LEDGER
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {event.attendanceSessions.map((session: any) => {
            const attendanceRecord = myAttendanceRecords.find(r => r.sessionId === session.id);
            const sessionDispute = disputesData?.pages?.flatMap(p => p.data)?.find(d => d.sessionId === session.id);
            const disputeWindowEnd = new Date(event.endTime).getTime() + 24 * 60 * 60 * 1000;
            const isWindowOpen = new Date().getTime() <= disputeWindowEnd;

            return (
              <div key={session.id} style={{ padding: '12px 14px', border: '1px solid rgba(255,255,255,0.15)', background: '#000000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                    {session.title}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#888', marginTop: '2px' }}>
                    {formatModalDate(session.startTime)} • {formatModalTime(session.startTime)}
                  </div>
                </div>

                <div>
                  {attendanceRecord ? (
                    <span 
                      className="ed-micro" 
                      style={{ 
                        color: attendanceRecord.status === 'PRESENT' ? 'var(--acid-green)' : attendanceRecord.status === 'EXCUSED' ? 'var(--electric-blue)' : 'var(--warm-red)' 
                      }}
                    >
                      {attendanceRecord.status}
                    </span>
                  ) : sessionDispute ? (
                    <span className="ed-micro" style={{ color: 'var(--warm-amber)' }}>
                      DISPUTE {sessionDispute.status}
                    </span>
                  ) : (
                    <div>
                      {!isEnded ? (
                        <span className="ed-micro" style={{ color: '#888' }}>PENDING</span>
                      ) : (
                        <>
                          <span className="ed-micro" style={{ color: 'var(--warm-red)', display: 'block', textAlign: 'right' }}>ABSENT</span>
                          {isWindowOpen ? (
                            <button 
                              onClick={() => setDisputeSessionId(session.id)}
                              style={{ background: 'none', border: 'none', color: '#fff', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700 }}
                            >
                              REPORT ISSUE ↗
                            </button>
                          ) : (
                            <span className="ed-micro" style={{ fontSize: '8px', color: '#666' }}>LOCKED</span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const bannerUrl = (event.metadata as any)?.banner_url as string | undefined;

  return (
    <>
      <style href="student-event-detail-styles" precedence="high">
        {eventDetailStyles}
      </style>
      <div className="collage-noise-overlay" />

      {/* REGISTRATION MODAL */}
      <Modal 
        isOpen={isRegisterModalOpen} 
        onClose={() => !isRegistering && setIsRegisterModalOpen(false)} 
        title={isCapacityFull ? "JOIN WAITLIST QUEUE" : "CONFIRM EVENT PASS"}
      >
        <div style={{ padding: '24px', paddingTop: 0, fontFamily: 'var(--font-body)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', color: '#fff', marginBottom: '20px' }}>
            {event.title}
          </h3>
          
          <div style={{ borderTop: '2px solid #fff', borderBottom: '2px solid #fff', padding: '16px 0', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div className="ed-micro">DATE SPECIFICATION</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                {formatModalDate(event.startTime)}
              </div>
            </div>
            <div>
              <div className="ed-micro">SESSION WINDOW</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                {formatModalTime(event.startTime)} — {formatModalTime(event.endTime)}
              </div>
            </div>
            <div>
              <div className="ed-micro">ADMISSION FORMAT</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--electric-blue)', marginTop: '2px' }}>
                Individual Registration Pass
              </div>
            </div>
          </div>

          {/* DYNAMIC FORM FIELDS */}
          {eventFormFields && eventFormFields.length > 0 && (
            <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="ed-micro" style={{ borderBottom: '1px dashed rgba(255,255,255,0.2)', paddingBottom: '8px' }}>
                REQUIRED REGISTRATION DETAILS
              </div>
              {eventFormFields.map((field) => {
                const isPreFilled = !!preFilledFields[field.fieldDefinitionId];
                const isEditable = !isPreFilled || editableFields.includes(field.fieldDefinitionId);

                return (
                <div key={field.fieldDefinitionId} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label 
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: '#a0a4b8', textTransform: 'uppercase', letterSpacing: '1px' }}
                  >
                    {field.fieldDefinition.label} {field.isRequired && <span style={{ color: 'var(--electric-blue)' }}>*</span>}
                  </label>
                  
                  {isEditable ? (
                    <>
                      {field.fieldDefinition.fieldType === 'SELECT' ? (
                        <select
                          value={formResponses[field.fieldDefinitionId] || ''}
                          onChange={(e) => setFormResponses(prev => ({ ...prev, [field.fieldDefinitionId]: e.target.value }))}
                          className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
                          required={field.isRequired}
                          style={{ appearance: 'none' }}
                        >
                          <option value="">Select an option</option>
                          {field.fieldDefinition.options?.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.fieldDefinition.fieldType === 'NUMBER' ? 'number' : field.fieldDefinition.fieldType === 'EMAIL' ? 'email' : 'text'}
                          value={formResponses[field.fieldDefinitionId] || ''}
                          onChange={(e) => setFormResponses(prev => ({ ...prev, [field.fieldDefinitionId]: e.target.value }))}
                          className="w-full bg-[#0e1017] border-2 border-white/20 px-3.5 py-2.5 text-xs font-mono text-[#F5F5F2] focus:border-[#0057FF] focus:outline-none transition-colors"
                          required={field.isRequired}
                          placeholder={field.fieldDefinition.fieldType === 'URL' ? 'https://...' : ''}
                        />
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.3)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#fff', wordBreak: 'break-all' }}>
                        {formResponses[field.fieldDefinitionId] || '-'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditableFields(prev => [...prev, field.fieldDefinitionId])}
                        style={{ background: 'none', border: 'none', color: '#00E5FF', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}
                      >
                        EDIT
                      </button>
                    </div>
                  )}

                  {field.fieldDefinition.isReusable && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {isPreFilled && !isEditable ? '✓ Confirm this saved value is correct' : '(Saved to profile)'}
                      </span>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}

          {isCapacityFull && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#a0a4b8', marginBottom: '24px', lineHeight: 1.5 }}>
              This session has reached maximum designated capacity. Joining the waitlist queues your ticket for automatic confirmation if a spot is freed.
            </p>
          )}

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setIsRegisterModalOpen(false)}
              disabled={isRegistering}
              style={{
                flex: 1,
                background: 'transparent',
                border: '2px solid #fff',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                padding: '12px 20px',
                cursor: 'pointer'
              }}
            >
              DISMISS
            </button>
            <button 
              onClick={handleRegisterConfirm}
              disabled={isRegistering}
              className="ed-cta-btn"
              style={{ flex: 2 }}
            >
              {isRegistering ? 'PROCESSING...' : isCapacityFull ? 'CONFIRM WAITLIST ↗' : 'AUTHORIZE PASS ↗'}
            </button>
          </div>
        </div>
      </Modal>

      {/* CANCELLATION MODAL */}
      <Modal 
        isOpen={isCancelModalOpen} 
        onClose={() => !isCanceling && setIsCancelModalOpen(false)} 
        title="DISMISS REGISTRATION"
      >
        <div style={{ padding: '24px', paddingTop: 0, fontFamily: 'var(--font-body)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: '#a0a4b8', marginBottom: '24px', lineHeight: 1.6 }}>
            Are you sure you want to release your confirmed pass for <strong style={{ color: '#fff' }}>{event.title}</strong>? 
            {event.maxCapacity !== null && " Your allocated seat will immediately be passed to the next waitlisted student."}
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isCanceling}
              style={{
                flex: 1,
                background: 'transparent',
                border: '2px solid #fff',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                padding: '12px 20px',
                cursor: 'pointer'
              }}
            >
              KEEP PASS
            </button>
            <button 
              onClick={handleCancelConfirm}
              disabled={isCanceling}
              style={{
                flex: 1,
                background: 'var(--warm-red)',
                border: '2px solid #fff',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                padding: '12px 20px',
                cursor: 'pointer'
              }}
            >
              {isCanceling ? 'RELEASING...' : 'CONFIRM CANCELLATION'}
            </button>
          </div>
        </div>
      </Modal>

      {/* TEAM GATEWAY MODAL */}
      <TeamGatewayModal 
        eventId={eventId}
        isOpen={isTeamGatewayOpen}
        onClose={() => setIsTeamGatewayOpen(false)}
      />

      <div className="ed-page">
        <div className="ed-inner">

          {/* Top Return Button */}
          <div>
            <button onClick={() => router.back()} className="ed-back-btn">
              <ArrowLeft size={14} /> RETURN TO PREVIOUS ARCHIVE
            </button>
          </div>

          {/* Hero Banner Frame (if present) */}
          {bannerUrl && (
            <div className="ed-banner-card">
              <div className="ed-tape-strip">
                OFFICIAL DOSSIER // {event.eventType || 'CAMPUS EVENT'}
              </div>
              <img src={bannerUrl} alt={event.title} />
            </div>
          )}

          {/* Header Section */}
          <section className="ed-header">
            <div className="ed-watermark">ARCHIVE</div>
            
            <div className="ed-micro ed-micro-blue" style={{ marginBottom: '6px' }}>
              CAMPUS EVENT RECORD // {event.eventType ? event.eventType.replace(/_/g, ' ') : 'EVENT DOSSIER'}
            </div>

            <h1 className="ed-title">
              {event.title}
            </h1>

            {primaryClub && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span className="ed-micro">HOSTED BY:</span>
                <Link href={`/student/campus/clubs/${primaryClub.id}`} className="ed-host-badge">
                  {primaryClub.bannerUrl ? (
                    <img 
                      src={primaryClub.bannerUrl} 
                      alt={primaryClub.name} 
                      style={{ width: '20px', height: '20px', objectFit: 'cover', border: '1px solid #fff' }} 
                    />
                  ) : (
                    <div style={{ width: '20px', height: '20px', background: 'var(--electric-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900 }}>
                      {primaryClub.name.charAt(0)}
                    </div>
                  )}
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: '#fff' }}>
                    {primaryClub.name} ↗
                  </span>
                </Link>
              </div>
            )}
          </section>

          {/* Main 2-Column Grid */}
          <div className="ed-grid-layout">
            
            {/* Left Column: Manifesto & Agenda */}
            <div>
              {/* About Section */}
              <div className="ed-box">
                <div className="ed-box-header">
                  <span className="ed-box-title">ABOUT THE EVENT</span>
                  <span className="ed-micro ed-micro-blue">MANIFESTO</span>
                </div>

                <div style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: '#e0e0e0', lineHeight: 1.7 }}>
                  {event.description ? (
                    event.description.split('\n').map((para, i) => (
                      <p key={i} style={{ marginBottom: '16px' }}>{para}</p>
                    ))
                  ) : (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>No detailed manifesto provided for this campus session.</p>
                  )}
                </div>
              </div>

              {/* Agenda Section */}
              {event.metadata?.agenda && event.metadata.agenda.length > 0 && (
                <div className="ed-box">
                  <div className="ed-box-header">
                    <span className="ed-box-title">TIMELINE &amp; AGENDA</span>
                    <span className="ed-micro ed-micro-green">{event.metadata.agenda.length} BLOCKS</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {event.metadata.agenda.map((item, idx) => {
                      let formattedTime = item.time;
                      try {
                        formattedTime = timeFormatter.format(new Date(item.time));
                      } catch {
                        // fallback
                      }

                      return (
                        <div key={idx} style={{ padding: '14px', border: '1px dashed rgba(245,245,242,0.2)', background: 'rgba(255,255,255,0.03)', display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--electric-blue)', minWidth: '90px', flexShrink: 0 }}>
                            {formattedTime}
                          </span>
                          <div>
                            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', color: '#fff', marginBottom: '4px' }}>
                              {item.title}
                            </h4>
                            {item.description && (
                              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: '#a0a4b8', lineHeight: 1.5, margin: 0 }}>
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Status & Logistics */}
            <div>
              
              {/* Registration / Status Box */}
              <div className="ed-box ed-box-blue">
                <div className="ed-box-header">
                  <span className="ed-box-title">PASS STATUS</span>
                  <span className="ed-micro ed-micro-blue">ADMISSION</span>
                </div>

                {isClubAdminForEvent ? (
                  <div style={{ padding: '16px', border: '2px solid var(--electric-blue)', background: 'rgba(0,87,255,0.1)' }}>
                    <div className="ed-micro ed-micro-blue" style={{ marginBottom: '6px' }}>
                      SECURITY CLEARANCE // ORGANIZER
                    </div>
                    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                      You organize this event
                    </h4>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#a0a4b8', lineHeight: 1.5, marginBottom: '18px' }}>
                      Participant passes are disabled for primary organizers. Access operations via Club Management.
                    </p>

                    {event.state === 'DRAFT' && (
                      <button 
                        onClick={() => submitMutation.mutate(eventId)}
                        disabled={submitMutation.isPending}
                        className="ed-cta-btn"
                        style={{ marginBottom: '10px' }}
                      >
                        {submitMutation.isPending ? 'SUBMITTING...' : 'SUBMIT FOR APPROVAL ↗'}
                      </button>
                    )}

                    <button 
                      onClick={() => {
                        setClubAdminMode(true);
                        if (primaryClub) setActiveClubId(primaryClub.id);
                        router.push(`/student/events/${eventId}/manage`);
                      }}
                      className="ed-cta-btn"
                    >
                      EVENT MANAGEMENT ↗
                    </button>
                  </div>
                ) : (
                  <>
                    {registration && (registration.status !== 'NOT_REGISTERED' || registration.team_id) ? (
                      <div>
                        {registration.status === 'CANCELLED' && (
                          <div className="ed-status-badge" style={{ color: 'var(--warm-red)', borderColor: 'var(--warm-red)' }}>
                            REGISTRATION CANCELLED
                          </div>
                        )}

                        {event.registrationType === 'TEAM' && registration.team_id ? (
                          <div style={{ padding: '16px', border: '2px solid rgba(255,255,255,0.2)', background: '#000' }}>
                            <div className="ed-micro ed-micro-blue" style={{ marginBottom: '4px' }}>
                              SQUAD IDENTITY
                            </div>
                            {isLoadingTeam ? (
                              <div className="ed-micro">SYNCHRONIZING TEAM...</div>
                            ) : isErrorTeam || !team ? (
                              <div className="ed-micro" style={{ color: 'var(--warm-red)' }}>TEAM LEDGER ERROR</div>
                            ) : (
                              <>
                                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#fff', marginBottom: '6px' }}>
                                  {team.name}
                                </h4>
                                <div className="ed-micro" style={{ marginBottom: '14px' }}>
                                  STATUS: {team.status || 'ACTIVE'} &bull; {team.member_count} {event.metadata?.maximum_team_size ? `/ ${event.metadata.maximum_team_size}` : ''} MEMBERS
                                </div>
                                <Link href={`/student/events/${eventId}/team`} className="ed-cta-btn">
                                  ACCESS TEAM HUB ↗
                                </Link>
                              </>
                            )}
                          </div>
                        ) : (
                          <>
                            {registration.status === 'REGISTERED' && (
                              <div className="ed-status-badge confirmed">
                                ✓ ADMISSION PASS VERIFIED
                              </div>
                            )}

                            {registration.status === 'WAITLISTED' && (
                              <div className="ed-status-badge waitlisted">
                                ⏳ WAITLISTED // POSITION #{registration.waitlist_position || 1}
                              </div>
                            )}
                          </>
                        )}

                        {renderCancellation()}
                      </div>
                    ) : (
                      renderRegistrationAction()
                    )}
                  </>
                )}

                {renderDisputeSection()}
              </div>

              {/* Event Logistics Details Box */}
              <div className="ed-box">
                <div className="ed-box-header">
                  <span className="ed-box-title">LOGISTICS</span>
                  <span className="ed-micro">SPECIFICATIONS</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Date */}
                  <div className="ed-spec-item">
                    <Calendar size={18} style={{ color: 'var(--electric-blue)', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div className="ed-micro">SESSION DATE</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                        {dateFormatter.format(new Date(event.startTime))}
                      </div>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="ed-spec-item">
                    <Clock size={18} style={{ color: 'var(--electric-blue)', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div className="ed-micro">TIME WINDOW</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                        {timeFormatter.format(new Date(event.startTime))} — {timeFormatter.format(new Date(event.endTime))}
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  {event.locationName && (
                    <div className="ed-spec-item">
                      <MapPin size={18} style={{ color: 'var(--electric-blue)', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div className="ed-micro">CAMPUS LOCATION</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                          {event.locationName}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Format */}
                  {event.registrationType && (
                    <div className="ed-spec-item">
                      <Users size={18} style={{ color: 'var(--electric-blue)', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div className="ed-micro">PARTICIPATION FORMAT</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                          {event.registrationType === 'TEAM' ? (
                            <>
                              TEAM COMPETITION 
                              {event.metadata?.minimum_team_size && (
                                <span style={{ color: '#a0a4b8', fontSize: '12px', marginLeft: '6px' }}>
                                  ({event.metadata.minimum_team_size} - {event.metadata.maximum_team_size || '∞'} members)
                                </span>
                              )}
                            </>
                          ) : (
                            'INDIVIDUAL REGISTRATION'
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Capacity */}
                  {event.maxCapacity !== null && typeof registrationCount === 'number' && (
                    <div className="ed-spec-item">
                      <Info size={18} style={{ color: 'var(--electric-blue)', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div className="ed-micro">CAPACITY METRIC</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                          {registrationCount} / {event.maxCapacity}{' '}
                          <span style={{ fontSize: '11px', color: '#a0a4b8', fontWeight: 400 }}>
                            {event.registrationType === 'TEAM' ? 'TEAMS' : 'SEATS'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>

        </div>
      </div>

      {disputeSessionId && (
        <AttendanceDisputeModal
          isOpen={!!disputeSessionId}
          onClose={() => setDisputeSessionId(null)}
          eventId={eventId}
          sessionId={disputeSessionId}
        />
      )}
    </>
  );
}
