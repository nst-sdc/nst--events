'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import React, { useState, useEffect, useMemo } from 'react';
import { useClubAdmin } from '../../../../../components/layout/ClubAdminProvider';
import { useClubDetail, useAddClubMember, useUpdateClubMemberRole, useRemoveClubMember, ClubRole, ClubMember } from '../../../../../hooks/useClubDetail';
import { useUpdateClub } from '../../../../../hooks/useUpdateClub';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { useAdminUsers } from '../../../../../hooks/useUserManagement';
import { useEvents } from '../../../../../hooks/useEvents';
import { useRegistrationsList } from '../../../../../hooks/useRegistrations';
import { useDebounce } from '../../../../../hooks/useDebounce';
import { apiClient } from '../../../../../lib/api';
import { canViewStudentDirectory } from '../../../../../lib/auth-helpers';
import { Users, Calendar, Settings, Image as ImageIcon, Plus, ShieldAlert, Search, Check, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Modal } from '../../../../../components/ui/Modal';

const manageClubStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --electric-blue-dark: #0042c7;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .mc-page {
    width: 100%;
    min-height: 100vh;
    background: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
  }

  .mc-inner {
    max-width: 1320px;
    margin: 0 auto;
    padding: 60px 32px 100px 32px;
  }

  .mc-micro {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }
  .mc-micro-blue { color: var(--electric-blue); }
  .mc-micro-red  { color: var(--warm-red); }

  /* ── Section Card ── */
  .mc-card {
    border: 3px solid #ffffff;
    background: var(--bg-dark-card);
    padding: 32px;
    margin-bottom: 32px;
    box-shadow: 8px 8px 0px #000000;
  }
  .mc-card-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 900;
    text-transform: uppercase;
    color: var(--bg-paper-white);
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 2px solid rgba(245,245,242,0.15);
  }

  /* ── Input / Textarea ── */
  .mc-input, .mc-textarea, .mc-select {
    width: 100%;
    background: #000;
    border: 2px solid rgba(245,245,242,0.25);
    color: var(--bg-paper-white);
    font-family: var(--font-mono);
    font-size: 13px;
    padding: 10px 14px;
    outline: none;
    transition: border-color 0.15s;
    border-radius: 0 !important;
  }
  .mc-input:focus, .mc-textarea:focus, .mc-select:focus {
    border-color: var(--electric-blue);
  }
  .mc-input::placeholder, .mc-textarea::placeholder {
    color: #555;
  }
  .mc-textarea {
    resize: vertical;
    min-height: 120px;
  }
  .mc-select {
    appearance: none;
  }

  /* ── Form label ── */
  .mc-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #a0a4b8;
    margin-bottom: 6px;
  }

  /* ── Buttons ── */
  .mc-btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--electric-blue);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 10px 24px;
    border: 2px solid var(--bg-paper-white);
    cursor: pointer;
    box-shadow: 3px 3px 0px #ffffff;
    transition: transform 0.15s, box-shadow 0.15s;
    border-radius: 0 !important;
  }
  .mc-btn-primary:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 5px 5px 0px #ffffff;
  }
  .mc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .mc-btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    color: var(--bg-paper-white);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 10px 24px;
    border: 2px solid rgba(245,245,242,0.4);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    border-radius: 0 !important;
  }
  .mc-btn-secondary:hover:not(:disabled) {
    border-color: var(--bg-paper-white);
    background: rgba(245,245,242,0.06);
  }
  .mc-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  .mc-btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--warm-red);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 10px 24px;
    border: 2px solid #fff;
    cursor: pointer;
    box-shadow: 3px 3px 0px #ffffff;
    transition: transform 0.15s, box-shadow 0.15s;
    border-radius: 0 !important;
  }
  .mc-btn-danger:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 5px 5px 0px #ffffff;
  }
  .mc-btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

  .mc-btn-ghost {
    background: none;
    border: none;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--electric-blue);
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: opacity 0.15s;
  }
  .mc-btn-ghost:hover { opacity: 0.75; }
  .mc-btn-ghost-red { color: var(--warm-red); }

  /* ── Banner Frame ── */
  .mc-banner-frame {
    width: 100%;
    height: 200px;
    border: 2px solid rgba(245,245,242,0.2);
    overflow: hidden;
    background: #111;
    margin-bottom: 20px;
  }
  .mc-banner-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(120%) grayscale(30%);
  }
  .mc-banner-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #444;
  }

  /* ── Table ── */
  .mc-table-wrap {
    overflow-x: auto;
    border: 2px solid rgba(245,245,242,0.15);
  }
  .mc-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 500px;
  }
  .mc-table thead tr {
    background: #0d0e12;
    border-bottom: 2px solid rgba(245,245,242,0.15);
  }
  .mc-table th {
    padding: 12px 16px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #a0a4b8;
    text-align: left;
  }
  .mc-table th:last-child { text-align: right; }
  .mc-table tbody tr {
    border-bottom: 1px solid rgba(245,245,242,0.08);
    transition: background 0.15s;
  }
  .mc-table tbody tr:last-child { border-bottom: none; }
  .mc-table tbody tr:hover { background: rgba(245,245,242,0.03); }
  .mc-table td {
    padding: 14px 16px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bg-paper-white);
  }
  .mc-table td:last-child { text-align: right; }

  /* ── Role Pill ── */
  .mc-role-pill {
    display: inline-block;
    padding: 3px 10px;
    border: 1px solid rgba(245,245,242,0.25);
    background: rgba(245,245,242,0.06);
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
  }

  /* ── Avatar ── */
  .mc-avatar {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(245,245,242,0.2);
    background: #0d0e12;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .mc-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .mc-avatar-initials {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--bg-paper-white);
  }

  /* ── Stats Card ── */
  .mc-stat-card {
    border: 2px solid rgba(245,245,242,0.15);
    background: #0d0e12;
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .mc-stat-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a0a4b8;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mc-stat-value {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 900;
    color: var(--bg-paper-white);
  }

  /* ── Error/Alert Banner ── */
  .mc-error-banner {
    padding: 10px 14px;
    background: rgba(255,59,48,0.08);
    border: 2px solid var(--warm-red);
    color: var(--warm-red);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  /* ── Grid Layout ── */
  .mc-grid {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 32px;
    align-items: start;
  }
  @media (max-width: 1024px) {
    .mc-grid { grid-template-columns: 1fr; }
    .mc-inner { padding: 40px 16px 80px 16px; }
  }

  /* ── Suggestions Dropdown & Selected Card ── */
  .mc-suggestion-box {
    margin-top: 8px;
    border: 2px solid rgba(245,245,242,0.2);
    background: #000000;
    max-height: 220px;
    overflow-y: auto;
  }
  .mc-suggestion-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    cursor: pointer;
    border-bottom: 1px solid rgba(245,245,242,0.08);
    transition: background 0.15s;
  }
  .mc-suggestion-item:last-child {
    border-bottom: none;
  }
  .mc-suggestion-item:hover {
    background: rgba(0, 87, 255, 0.15);
  }
  .mc-selected-card {
    border: 2px solid var(--electric-blue);
    background: rgba(0, 87, 255, 0.06);
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  /* ── Modal inner ── */
  .mc-modal-inner {
    padding: 24px;
    background: #0d0e12;
    color: var(--bg-paper-white);
  }
  .mc-modal-notice {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    background: rgba(245,245,242,0.04);
    border: 1px solid rgba(245,245,242,0.15);
    margin-bottom: 20px;
  }
  .mc-modal-notice-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: #a0a4b8;
    line-height: 1.5;
  }
`;

// --- Modals ---

interface StudentCandidate {
  id: string;
  fullName: string;
  email: string;
}

function AddMemberModal({ clubId, isOpen, onClose }: { clubId: string, isOpen: boolean, onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebounce(searchTerm, 250);
  const [selectedStudent, setSelectedStudent] = useState<StudentCandidate | null>(null);
  const [role, setRole] = useState<ClubRole>('MEMBER');
  const [error, setError] = useState('');
  const [isResolvingProfile, setIsResolvingProfile] = useState(false);

  const { data: currentUser } = useCurrentUser();
  const isPrivileged = canViewStudentDirectory(currentUser);

  // Privileged student directory query
  const { data: adminUsersData, isLoading: isAdminUsersLoading } = useAdminUsers(
    isPrivileged && debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : undefined
  );

  // Club events & registration attendee query for non-privileged club admins
  const { data: clubEvents } = useEvents({ filter_club_id: clubId, limit: 5 });
  const firstEventId = clubEvents?.data?.[0]?.id || '';
  const { data: regData1 } = useRegistrationsList(firstEventId);
  const secondEventId = clubEvents?.data?.[1]?.id || '';
  const { data: regData2 } = useRegistrationsList(secondEventId);

  const addMemberMutation = useAddClubMember(clubId);

  const assignableRoles: { label: string, value: ClubRole }[] = [
    { label: 'Member', value: 'MEMBER' },
    { label: 'Core Member', value: 'CORE_MEMBER' },
    { label: 'Club Admin', value: 'CLUB_ADMIN' },
  ];

  // Aggregate candidate directory
  const candidates = useMemo(() => {
    const map = new Map<string, StudentCandidate>();

    if (isPrivileged && adminUsersData?.pages) {
      for (const page of adminUsersData.pages) {
        for (const u of page.data) {
          map.set(u.id, {
            id: u.id,
            fullName: u.fullName || 'Student',
            email: u.email,
          });
        }
      }
    }

    if (regData1?.pages) {
      for (const page of regData1.pages) {
        for (const r of page.data) {
          if (r.user && !map.has(r.user.id)) {
            map.set(r.user.id, {
              id: r.user.id,
              fullName: r.user.fullName || 'Student',
              email: r.user.email,
            });
          }
        }
      }
    }

    if (regData2?.pages) {
      for (const page of regData2.pages) {
        for (const r of page.data) {
          if (r.user && !map.has(r.user.id)) {
            map.set(r.user.id, {
              id: r.user.id,
              fullName: r.user.fullName || 'Student',
              email: r.user.email,
            });
          }
        }
      }
    }

    return Array.from(map.values());
  }, [isPrivileged, adminUsersData, regData1, regData2]);

  // Filtered candidate list based on search term
  const filteredCandidates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return candidates.slice(0, 8);
    return candidates.filter(
      c => c.fullName.toLowerCase().includes(term) || c.email.toLowerCase().includes(term) || c.id.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [searchTerm, candidates]);

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm.trim());

  // Attempt to resolve UUID directly if typed or pasted
  const handleResolveDirectUUID = async (uuid: string) => {
    setIsResolvingProfile(true);
    try {
      const profile = await apiClient<any>(`/users/${uuid}/profile`);
      if (profile && profile.id) {
        setSelectedStudent({
          id: profile.id,
          fullName: profile.full_name || 'Student',
          email: profile.email || uuid,
        });
        setSearchTerm('');
      } else {
        setSelectedStudent({
          id: uuid,
          fullName: 'Student',
          email: uuid,
        });
      }
    } catch {
      setSelectedStudent({
        id: uuid,
        fullName: 'Student',
        email: uuid,
      });
    } finally {
      setIsResolvingProfile(false);
    }
  };

  const handleSelectCandidate = (candidate: StudentCandidate) => {
    setSelectedStudent(candidate);
    setSearchTerm('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setError('Please search for and select a student candidate first.');
      return;
    }
    setError('');
    try {
      await addMemberMutation.mutateAsync({ user_id: selectedStudent.id, role });
      setSelectedStudent(null);
      setSearchTerm('');
      setRole('MEMBER');
      onClose();
    } catch (err: any) {
      setError(err?.data?.error || err.message || 'Failed to add member');
    }
  };

  const handleResetModal = () => {
    setSelectedStudent(null);
    setSearchTerm('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleResetModal} title="ADD CLUB MEMBER">
      <div className="mc-modal-inner">
        <div className="mc-modal-notice">
          <ShieldAlert style={{ width: 18, height: 18, color: '#a0a4b8', flexShrink: 0, marginTop: 2 }} />
          <p className="mc-modal-notice-text">
            Search for a student by their full name or college email address to enroll them as a member of this club.
          </p>
        </div>

        {error && <div className="mc-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {selectedStudent ? (
            <div>
              <label className="mc-label">SELECTED STUDENT</label>
              <div className="mc-selected-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div className="mc-avatar" style={{ width: 40, height: 40, background: 'var(--electric-blue)' }}>
                    <span className="mc-avatar-initials" style={{ fontSize: 14, color: '#fff' }}>
                      {selectedStudent.fullName.charAt(0) || 'S'}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: '#fff' }}>
                        {selectedStudent.fullName}
                      </span>
                      <Check style={{ width: 14, height: 14, color: 'var(--acid-green)' }} />
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#a0a4b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedStudent.email}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#666', marginTop: 2 }}>
                      ID: {selectedStudent.id}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="mc-btn-ghost"
                  style={{ fontSize: 10 }}
                >
                  CHANGE
                </button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <label className="mc-label">SEARCH BY NAME OR EMAIL</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Type student name, email, or user ID..."
                  className="mc-input"
                  style={{ paddingLeft: 36 }}
                  autoFocus
                />
                <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#666' }} />
              </div>

              {/* Live Dropdown / Suggestions */}
              {(searchTerm.trim().length > 0 || candidates.length > 0) && (
                <div className="mc-suggestion-box">
                  {isUUID && !candidates.some(c => c.id.toLowerCase() === searchTerm.trim().toLowerCase()) && (
                    <div
                      onClick={() => handleResolveDirectUUID(searchTerm.trim())}
                      className="mc-suggestion-item"
                      style={{ background: 'rgba(200, 255, 0, 0.08)' }}
                    >
                      <div className="mc-avatar">
                        <UserIcon style={{ width: 14, height: 14, color: 'var(--acid-green)' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--acid-green)' }}>
                          ADD VIA DIRECT USER ID
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#aaa' }}>
                          {searchTerm.trim()}
                        </div>
                      </div>
                      <span className="mc-micro mc-micro-blue">SELECT</span>
                    </div>
                  )}

                  {filteredCandidates.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCandidate(c)}
                      className="mc-suggestion-item"
                    >
                      <div className="mc-avatar">
                        <span className="mc-avatar-initials">{c.fullName.charAt(0) || 'S'}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: '#fff' }}>
                          {c.fullName}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#a0a4b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.email}
                        </div>
                      </div>
                      <span className="mc-micro mc-micro-blue">SELECT</span>
                    </div>
                  ))}

                  {filteredCandidates.length === 0 && !isUUID && (
                    <div style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666' }}>
                      {isAdminUsersLoading ? 'SEARCHING DIRECTORY...' : 'NO MATCHING STUDENTS FOUND. TRY PASTING A USER UUID.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mc-label">CLUB ROLE</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as ClubRole)}
              className="mc-select"
            >
              {assignableRoles.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
            <button type="button" onClick={handleResetModal} className="mc-btn-secondary">
              CANCEL
            </button>
            <button
              type="submit"
              disabled={!selectedStudent || addMemberMutation.isPending || isResolvingProfile}
              className="mc-btn-primary"
            >
              {addMemberMutation.isPending ? 'ADDING...' : isResolvingProfile ? 'RESOLVING...' : 'CONFIRM & ADD MEMBER'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function ChangeRoleModal({ clubId, member, isOpen, onClose }: { clubId: string, member: ClubMember | null, isOpen: boolean, onClose: () => void }) {
  const [role, setRole] = useState<ClubRole>('MEMBER');
  const [error, setError] = useState('');

  const updateRoleMutation = useUpdateClubMemberRole(clubId, member?.user_id || 'unselected');

  useEffect(() => {
    if (member) setRole(member.role);
  }, [member]);

  const assignableRoles: { label: string, value: ClubRole }[] = [
    { label: 'Member', value: 'MEMBER' },
    { label: 'Core Member', value: 'CORE_MEMBER' },
    { label: 'Club Admin', value: 'CLUB_ADMIN' },
  ];

  if (!member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (role === member.role) return onClose();
    try {
      await updateRoleMutation.mutateAsync({ role });
      onClose();
    } catch (err: any) {
      setError(err?.data?.error || err.message || 'Failed to update role');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CHANGE ROLE">
      <div className="mc-modal-inner">
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#a0a4b8', marginBottom: 20, lineHeight: 1.5 }}>
          Update role for <strong style={{ color: '#fff' }}>{member.full_name}</strong>.
        </p>

        {error && <div className="mc-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="mc-label">New Club Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as ClubRole)}
              className="mc-select"
            >
              {assignableRoles.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
            <button type="button" onClick={onClose} className="mc-btn-secondary">CANCEL</button>
            <button type="submit" disabled={updateRoleMutation.isPending} className="mc-btn-primary">
              {updateRoleMutation.isPending ? 'SAVING...' : 'SAVE ROLE'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}


export default function ClubManagePage() {
  const { activeClubId, managedClubs, isHydrated } = useClubAdmin();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !activeClubId && managedClubs.length === 0) {
      router.push('/student/home');
    }
  }, [isHydrated, activeClubId, managedClubs.length, router]);

  const { data: club, isLoading } = useClubDetail(activeClubId || '');
  const updateClub = useUpdateClub();
  const { data: currentUser } = useCurrentUser();
  const removeMemberMutation = useRemoveClubMember(activeClubId || '');

  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedMemberRole, setSelectedMemberRole] = useState<ClubMember | null>(null);
  const [selectedMemberRemove, setSelectedMemberRemove] = useState<ClubMember | null>(null);
  const [removeError, setRemoveError] = useState('');

  const isCurrentUserClubAdmin = React.useMemo(() => {
    if (!club || !currentUser) return false;
    if (currentUser.global_role === 'PLATFORM_ADMIN' || currentUser.global_role === 'FACULTY_ADMIN') return true;
    const membership = club.members.find(m => m.user_id === currentUser.id);
    return membership?.role === 'CLUB_ADMIN';
  }, [club, currentUser]);

  const handleRemoveConfirm = async () => {
    if (!selectedMemberRemove || !activeClubId) return;
    setRemoveError('');
    try {
      await removeMemberMutation.mutateAsync(selectedMemberRemove.user_id);
      setSelectedMemberRemove(null);
    } catch (err: any) {
      setRemoveError(err?.data?.error || err.message || 'Failed to remove member');
    }
  };

  useEffect(() => {
    if (club) {
      setDescription(club.description || '');
      setBannerUrl(club.banner_url || '');
    }
  }, [club]);

  if (!isHydrated || isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, border: '3px solid #0057FF',
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#a0a4b8' }}>
            LOADING CLUB...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!club) return null;

  const handleSave = () => {
    if (!activeClubId) return;
    updateClub.mutate({
      id: activeClubId,
      payload: { description, banner_url: bannerUrl },
    }, {
      onSuccess: () => setIsEditing(false),
    });
  };

  return (
    <>
      <style href="student-manage-club-styles" precedence="high">
        {manageClubStyles}
      </style>
      <div className="mc-page">
        <div className="mc-inner">

          {/* Page Header */}
          <div style={{ borderBottom: '3px solid #fff', paddingBottom: 24, marginBottom: 40 }}>
            <div className="mc-micro mc-micro-blue" style={{ marginBottom: 8 }}>CLUB HUB // MANAGEMENT</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5.5vw, 64px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: -1, lineHeight: 0.92, color: '#fff' }}>
              {club.name}
            </h1>
          </div>

          <div className="mc-grid">

            {/* ── Left Column ── */}
            <div>

              {/* Club Profile Card */}
              <div className="mc-card">
                <div className="mc-card-title" style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Settings size={16} />
                    CLUB PROFILE
                  </span>
                  {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="mc-btn-ghost">
                      EDIT PROFILE ↗
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <label className="mc-label">Banner Image URL</label>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <ImageIcon size={16} style={{ color: '#a0a4b8', flexShrink: 0 }} />
                        <input
                          type="url"
                          value={bannerUrl}
                          onChange={(e) => setBannerUrl(e.target.value)}
                          className="mc-input"
                          placeholder="https://example.com/banner.jpg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mc-label">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mc-textarea"
                        placeholder="Tell everyone what this club is about..."
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 12, borderTop: '1px solid rgba(245,245,242,0.1)' }}>
                      <button onClick={() => { setIsEditing(false); setDescription(club.description || ''); setBannerUrl(club.banner_url || ''); }} className="mc-btn-secondary">
                        CANCEL
                      </button>
                      <button onClick={handleSave} disabled={updateClub.isPending} className="mc-btn-primary">
                        {updateClub.isPending ? 'SAVING...' : 'SAVE CHANGES'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {club.banner_url ? (
                      <div className="mc-banner-frame">
                        <img src={club.banner_url} alt="Club Banner" />
                      </div>
                    ) : (
                      <div className="mc-banner-frame">
                        <div className="mc-banner-placeholder">
                          <ImageIcon size={32} style={{ opacity: 0.3 }} />
                          <span className="mc-micro">NO BANNER IMAGE SET</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="mc-label">Description</div>
                      {club.description ? (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#a0a4b8', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {club.description}
                        </p>
                      ) : (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#444', fontStyle: 'italic' }}>No description set.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Roster Card */}
              {isCurrentUserClubAdmin && (
                <div className="mc-card">
                  <div className="mc-card-title" style={{ justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={16} />
                      CLUB ROSTER
                    </span>
                    <button onClick={() => setIsAddMemberModalOpen(true)} className="mc-btn-ghost">
                      <Plus size={13} /> ADD MEMBER
                    </button>
                  </div>

                  {club.members.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', borderTop: '2px dashed rgba(245,245,242,0.1)' }}>
                      <p className="mc-micro">NO MEMBERS FOUND</p>
                    </div>
                  ) : (
                    <div className="mc-table-wrap">
                      <table className="mc-table">
                        <thead>
                          <tr>
                            <th>Member</th>
                            <th>Role</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {club.members.map((member) => {
                            const isSelf = member.user_id === currentUser?.id;
                            const canManage = !isSelf && member.role !== 'CLUB_ADMIN' && member.role !== 'FACULTY_MENTOR';

                            return (
                              <tr key={member.user_id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div className="mc-avatar">
                                      {member.avatar_url ? (
                                        <img src={member.avatar_url} alt="avatar" />
                                      ) : (
                                        <span className="mc-avatar-initials">{member.full_name.substring(0, 2)}</span>
                                      )}
                                    </div>
                                    <span style={{ fontWeight: 600, color: '#fff' }}>
                                      {member.full_name}
                                      {isSelf && <span style={{ color: '#a0a4b8', fontWeight: 400, marginLeft: 6, fontSize: 11 }}>(You)</span>}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className="mc-role-pill">{member.role.replace('_', ' ')}</span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, minHeight: 24 }}>
                                    {canManage ? (
                                      <>
                                        <button onClick={() => setSelectedMemberRole(member)} className="mc-btn-ghost">
                                          EDIT ROLE
                                        </button>
                                        <button onClick={() => setSelectedMemberRemove(member)} className="mc-btn-ghost mc-btn-ghost-red">
                                          REMOVE
                                        </button>
                                      </>
                                    ) : (
                                      <span style={{ color: '#333', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>—</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Right Column: Stats ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="mc-card" style={{ padding: 20 }}>
                <div className="mc-card-title" style={{ fontSize: 14, marginBottom: 16 }}>OVERVIEW</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="mc-stat-card">
                    <span className="mc-stat-label"><Users size={14} /> Members</span>
                    <span className="mc-stat-value">{club.members.length}</span>
                  </div>
                  <div className="mc-stat-card">
                    <span className="mc-stat-label"><Calendar size={14} /> Events</span>
                    <span className="mc-stat-value">{club.event_count}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <AddMemberModal
        clubId={activeClubId || ''}
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
      />

      <ChangeRoleModal
        clubId={activeClubId || ''}
        member={selectedMemberRole}
        isOpen={!!selectedMemberRole}
        onClose={() => setSelectedMemberRole(null)}
      />

      <Modal isOpen={!!selectedMemberRemove} onClose={() => !removeMemberMutation.isPending && setSelectedMemberRemove(null)} title="REMOVE MEMBER">
        <div className="mc-modal-inner">
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#a0a4b8', marginBottom: 20, lineHeight: 1.5 }}>
            Are you sure you want to remove <strong style={{ color: '#fff' }}>{selectedMemberRemove?.full_name}</strong> from {club.name}?
          </p>

          {removeError && <div className="mc-error-banner">{removeError}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              onClick={() => setSelectedMemberRemove(null)}
              disabled={removeMemberMutation.isPending}
              className="mc-btn-secondary"
            >
              CANCEL
            </button>
            <button
              onClick={handleRemoveConfirm}
              disabled={removeMemberMutation.isPending}
              className="mc-btn-danger"
            >
              {removeMemberMutation.isPending ? 'REMOVING...' : 'REMOVE MEMBER'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
