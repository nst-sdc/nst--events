'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  studentsApi,
  EditableProfileData,
  SectionVisibility,
} from '../../lib/students-api';
import { Modal } from '../ui/Modal';
import {
  Globe,
  Share2,
  Eye,
  EyeOff,
  Star,
  Check,
  AlertCircle,
  ExternalLink,
  Save,
  Tag,
  Award,
  Layers,
  Sparkles,
} from 'lucide-react';

const portfolioSettingsStyles = `
  .sps-container {
    border: 3px solid #000000;
    background: #FFFFFF;
    color: #0A0D14;
    padding: 32px;
    box-shadow: 12px 12px 0px var(--electric-blue);
  }
  html.dark .sps-container, .dark .sps-container {
    border: 2px solid rgba(245,245,242,0.2);
    background: #0d0e12;
    color: #F5F5F2;
  }
  .sps-panel {
    background: #F8F9FA;
    border: 2px solid #000000;
    padding: 20px;
    margin-bottom: 28px;
  }
  html.dark .sps-panel, .dark .sps-panel {
    background: #000000;
    border: 2px solid rgba(245,245,242,0.2);
  }
  .sps-input-wrap {
    display: flex;
    align-items: center;
    background: #FFFFFF;
    border: 1px solid #000000;
  }
  html.dark .sps-input-wrap, .dark .sps-input-wrap {
    background: #050505;
    border: 1px solid rgba(245,245,242,0.3);
  }
  .sps-input-field {
    background: #FFFFFF;
    border: 1px solid #D0D5DD;
    color: #0A0D14;
    font-family: var(--font-mono);
    outline: none;
  }
  html.dark .sps-input-field, .dark .sps-input-field {
    background: #050505;
    border: 1px solid rgba(245,245,242,0.3);
    color: #FFFFFF;
  }
  .sps-textarea-field {
    background: #FFFFFF;
    border: 1px solid #D0D5DD;
    color: #0A0D14;
    font-family: var(--font-body);
    outline: none;
  }
  html.dark .sps-textarea-field, .dark .sps-textarea-field {
    background: #050505;
    border: 1px solid rgba(245,245,242,0.3);
    color: #FFFFFF;
  }
  .sps-card-item {
    background: #FFFFFF;
    border: 1px solid #000000;
    color: #0A0D14;
  }
  html.dark .sps-card-item, .dark .sps-card-item {
    background: #000000;
    border: 1px solid rgba(245,245,242,0.2);
    color: #F5F5F2;
  }
  .sps-text-subtle {
    color: #475467;
  }
  html.dark .sps-text-subtle, .dark .sps-text-subtle {
    color: #a0a4b8;
  }
  .sps-btn-neutral {
    background: #FFFFFF;
    border: 2px solid #000000;
    color: #0A0D14;
  }
  html.dark .sps-btn-neutral, .dark .sps-btn-neutral {
    background: #050505;
    border: 2px solid var(--electric-blue);
    color: #FFFFFF;
  }
  .sps-skill-chip {
    background: #F0F4FF;
    border: 1px solid #0057FF;
    color: #0057FF;
  }
  html.dark .sps-skill-chip, .dark .sps-skill-chip {
    background: #050505;
    border: 1px solid rgba(245,245,242,0.3);
    color: var(--acid-green);
  }
`;

export function StudentPortfolioSettings() {
  const queryClient = useQueryClient();

  // Fetch full editable profile data
  const { data, isLoading, error, refetch } = useQuery<EditableProfileData>({
    queryKey: ['my-student-profile'],
    queryFn: () => studentsApi.getMyProfile(),
  });

  // Local state for editable text & links
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [links, setLinks] = useState({
    github: '',
    linkedin: '',
    portfolio: '',
    other: '',
  });

  // Handle editing state
  const [handle, setHandle] = useState('');
  const [handleMsg, setHandleMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Copy URL state
  const [copied, setCopied] = useState(false);

  // Preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Initialize local state when data loads
  useEffect(() => {
    if (data?.user) {
      setHeadline(data.user.headline || '');
      setBio(data.user.bio || '');
      setSkills(data.user.skills || []);
      setLinks({
        github: data.user.externalLinks?.github || '',
        linkedin: data.user.externalLinks?.linkedin || '',
        portfolio: data.user.externalLinks?.portfolio || '',
        other: data.user.externalLinks?.other || '',
      });
    }
    if (data?.profile?.slug) {
      setHandle(data.profile.slug);
    }
  }, [data]);

  // Mutations
  const updateContentMutation = useMutation({
    mutationFn: () =>
      studentsApi.updateMyProfile({
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        skills,
        externalLinks: {
          github: links.github.trim() || undefined,
          linkedin: links.linkedin.trim() || undefined,
          portfolio: links.portfolio.trim() || undefined,
          other: links.other.trim() || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
    },
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: (payload: { section_visibility?: Partial<SectionVisibility>; directory_listed?: boolean }) =>
      studentsApi.updateMyVisibility(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
    },
  });

  const curateMutation = useMutation({
    mutationFn: (payload: {
      item_type: 'PROJECT' | 'ACHIEVEMENT' | 'CLUB' | 'LINK';
      source_record_id: string;
      hidden?: boolean;
      featured?: boolean;
      display_order?: number;
    }) => studentsApi.curateItem(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
    },
  });

  const changeHandleMutation = useMutation({
    mutationFn: (newHandle: string) => studentsApi.changeHandle(newHandle),
    onSuccess: (res) => {
      setHandleMsg({ type: 'success', text: `Handle updated to @${res.slug}! Redirects preserved.` });
      queryClient.invalidateQueries({ queryKey: ['my-student-profile'] });
    },
    onError: (err: any) => {
      setHandleMsg({ type: 'error', text: err?.message || 'Failed to update handle. Slug may be taken or invalid.' });
    },
  });

  if (isLoading) {
    return (
      <div className="sps-container animate-pulse">
        <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-900 mb-4" />
        <div className="h-24 w-full bg-neutral-200 dark:bg-neutral-900" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="sps-container" style={{ borderColor: 'var(--warm-red)' }}>
        <p className="micro-annotation" style={{ color: 'var(--warm-red)' }}>
          FAILED TO LOAD PORTFOLIO SETTINGS
        </p>
        <button onClick={() => refetch()} className="profile-cta-btn" style={{ marginTop: '12px' }}>
          RETRY ↺
        </button>
      </div>
    );
  }

  const profile = data?.profile || { slug: '', directoryListed: true, sectionVisibility: {} as any };
  const curatedItems = data?.curatedItems || [];
  const availableProjects = data?.availableProjects || [];
  const availableAchievements = data?.availableAchievements || [];
  const availableClubs = data?.availableClubs || [];
  const visibility = profile?.sectionVisibility || {};

  const toggleSection = (key: keyof SectionVisibility) => {
    updateVisibilityMutation.mutate({
      section_visibility: {
        [key]: !visibility[key],
      },
    });
  };

  const toggleDirectoryListed = () => {
    updateVisibilityMutation.mutate({
      directory_listed: !profile.directoryListed,
    });
  };

  const getCuration = (type: string, id: string) => {
    return curatedItems.find((c) => c.itemType === type && c.sourceRecordId === id);
  };

  const toggleItemHidden = (type: 'PROJECT' | 'ACHIEVEMENT' | 'CLUB', id: string) => {
    const curation = getCuration(type, id);
    const currentlyHidden = curation ? curation.hidden : false;
    curateMutation.mutate({
      item_type: type,
      source_record_id: id,
      hidden: !currentlyHidden,
    });
  };

  const toggleItemFeatured = (type: 'PROJECT', id: string) => {
    const curation = getCuration(type, id);
    const currentlyFeatured = curation ? curation.featured : false;
    curateMutation.mutate({
      item_type: type,
      source_record_id: id,
      featured: !currentlyFeatured,
    });
  };

  const handleCopyLink = () => {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://events.nstsdc.org';
    const profileUrl = `${siteUrl}/students/${profile.slug}`;
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const sk = newSkill.trim().toLowerCase();
    if (sk && !skills.includes(sk) && skills.length < 20) {
      setSkills([...skills, sk]);
      setNewSkill('');
    }
  };

  const removeSkill = (sk: string) => {
    setSkills(skills.filter((s) => s !== sk));
  };

  return (
    <>
      <style href="student-portfolio-settings-styles" precedence="high">
        {portfolioSettingsStyles}
      </style>
      <div className="sps-container">
      {/* Header */}
      <div className="micro-annotation annotation-blue" style={{ marginBottom: '8px' }}>
        PUBLIC DOSSIER // PORTFOLIO & RECOGNITION
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
          PUBLIC PROFILE & VISIBILITY
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowPreviewModal(true)}
            style={{
              background: 'transparent',
              border: '2px solid var(--electric-blue)',
              color: 'var(--electric-blue)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Eye size={14} />
            <span>LIVE PREVIEW</span>
          </button>
          <Link
            href={`/students/${profile.slug}`}
            target="_blank"
            style={{
              background: 'var(--electric-blue)',
              border: '2px solid var(--electric-blue)',
              color: '#ffffff',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '8px 16px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>VIEW PUBLIC DOSSIER</span>
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      <p className="sps-text-subtle" style={{ fontSize: '14px', lineHeight: 1.6, marginBottom: '28px' }}>
        Your public portfolio showcases your verified NST accomplishments, academic credentials, published software, and official event recognitions. You have full granular control over which sections and individual achievements appear on your public dossier.
      </p>

      {/* ── 1. Canonical Public Handle & Link Sharing ── */}
      <div className="sps-panel">
        <div className="micro-annotation" style={{ marginBottom: '8px' }}>
          CANONICAL PUBLIC URL & HANDLE
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="sps-input-wrap" style={{ flex: '1 1 280px', padding: '8px 14px' }}>
            <span className="sps-text-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', marginRight: '4px' }}>
              /students/
            </span>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              placeholder="your-unique-handle"
              className="sps-input-field"
              style={{
                background: 'transparent',
                border: 'none',
                width: '100%',
                fontWeight: 700,
              }}
            />
          </div>
          <button
            onClick={() => changeHandleMutation.mutate(handle)}
            disabled={changeHandleMutation.isPending || handle === profile.slug}
            className="sps-btn-neutral"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '10px 18px',
              cursor: handle === profile.slug ? 'not-allowed' : 'pointer',
              opacity: handle === profile.slug ? 0.5 : 1,
            }}
          >
            {changeHandleMutation.isPending ? 'UPDATING...' : 'CHANGE HANDLE'}
          </button>
          <button
            onClick={handleCopyLink}
            className={copied ? '' : 'sps-btn-neutral'}
            style={{
              background: copied ? 'var(--acid-green)' : undefined,
              border: copied ? '2px solid var(--acid-green)' : undefined,
              color: copied ? '#000000' : undefined,
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '10px 18px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span>{copied ? 'COPIED!' : 'COPY LINK'}</span>
          </button>
        </div>

        {handleMsg && (
          <div
            style={{
              marginTop: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: handleMsg.type === 'success' ? 'var(--acid-green)' : 'var(--warm-red)',
            }}
          >
            {handleMsg.text}
          </div>
        )}

        {/* Directory Listing Switch */}
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.1))', paddingTop: '14px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 800 }}>
              Include in Public Student Directory
            </div>
            <div className="sps-text-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
              Allows classmates and campus recruiters to find you in the <code>/students</code> directory search.
            </div>
          </div>
          <button
            onClick={toggleDirectoryListed}
            style={{
              background: profile.directoryListed ? 'var(--electric-blue)' : '#222',
              border: '2px solid #000',
              color: '#fff',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            {profile.directoryListed ? 'LISTED ✓' : 'UNLISTED'}
          </button>
        </div>
      </div>

      {/* ── 2. Section Visibility Matrix ── */}
      <div style={{ marginBottom: '32px' }}>
        <div className="micro-annotation annotation-blue" style={{ marginBottom: '12px' }}>
          SECTION-LEVEL PRIVACY CONTROLS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {[
            { key: 'identity', label: 'Full Display Name', desc: 'If hidden, approved handle @slug is shown instead' },
            { key: 'avatar', label: 'Profile Photo', desc: 'If hidden, initials fallback block is displayed' },
            { key: 'academic', label: 'Academic & Batch', desc: 'Verified program, graduation year & campus' },
            { key: 'bio', label: 'Headline & Biography', desc: 'Personal bio and technical intro' },
            { key: 'skills', label: 'Skills & Specializations', desc: 'Technical skill tags and interest areas' },
            { key: 'links', label: 'External Portfolio Links', desc: 'GitHub, LinkedIn, personal website' },
            { key: 'projects', label: 'Selected NST Projects', desc: 'Published projects and software contributions' },
            { key: 'achievements', label: 'Competition Honors', desc: 'Authoritative event podiums & awards' },
            { key: 'clubs', label: 'Campus Clubs & Roles', desc: 'Verified memberships and leadership titles' },
          ].map(({ key, label, desc }) => {
            const isVisible = !!visibility[key as keyof SectionVisibility];
            return (
              <div
                key={key}
                className="sps-card-item"
                style={{
                  border: `2px solid ${isVisible ? 'var(--electric-blue)' : 'var(--border-subtle, rgba(0,0,0,0.15))'}`,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 800 }}>
                      {label}
                    </span>
                    {isVisible ? (
                      <span style={{ color: 'var(--acid-green)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                        <Eye size={12} /> VISIBLE
                      </span>
                    ) : (
                      <span style={{ color: '#888', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                        <EyeOff size={12} /> HIDDEN
                      </span>
                    )}
                  </div>
                  <p className="sps-text-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', margin: '4px 0 0 0' }}>
                    {desc}
                  </p>
                </div>
                <button
                  onClick={() => toggleSection(key as keyof SectionVisibility)}
                  style={{
                    background: isVisible ? 'var(--electric-blue)' : 'transparent',
                    border: '1px solid var(--border-default, rgba(0,0,0,0.2))',
                    color: isVisible ? '#ffffff' : 'inherit',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  }}
                >
                  {isVisible ? 'HIDE SECTION' : 'SHOW ON PROFILE'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Content Editor (Headline, Bio, Skills, Links) ── */}
      <div className="sps-panel">
        <div className="micro-annotation annotation-green" style={{ marginBottom: '16px' }}>
          EDIT STUDENT PORTFOLIO CONTENT
        </div>

        {/* Headline */}
        <div style={{ marginBottom: '18px' }}>
          <label className="sps-text-subtle" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', marginBottom: '6px' }}>
            HEADLINE (E.G. &ldquo;SYSTEMS & FULL-STACK ENGINEER | ML RESEARCHER&rdquo;)
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={120}
            placeholder="Write a punchy one-line technical headline..."
            className="sps-input-field"
            style={{
              padding: '10px 14px',
              width: '100%',
              fontSize: '13px',
            }}
          />
        </div>

        {/* Bio */}
        <div style={{ marginBottom: '18px' }}>
          <label className="sps-text-subtle" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', marginBottom: '6px' }}>
            SHORT BIOGRAPHY / PORTFOLIO INTRO
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Share your technical background, current projects, and focus areas..."
            className="sps-textarea-field"
            style={{
              padding: '10px 14px',
              width: '100%',
              fontSize: '13px',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Skills Tag Manager */}
        <div style={{ marginBottom: '20px' }}>
          <label className="sps-text-subtle" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', marginBottom: '6px' }}>
            TECHNICAL SKILLS (MAX 20)
          </label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add skill (e.g. rust, react, pytorch)..."
              className="sps-input-field"
              style={{
                fontSize: '12px',
                padding: '8px 12px',
                flex: '1 1 200px',
              }}
            />
            <button
              onClick={addSkill}
              style={{
                background: 'var(--electric-blue)',
                border: 'none',
                color: '#ffffff',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              ADD SKILL +
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {skills.map((sk) => (
              <span
                key={sk}
                className="sps-skill-chip"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  padding: '3px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                #{sk}
                <button
                  onClick={() => removeSkill(sk)}
                  style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div>
            <label className="sps-text-subtle" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', marginBottom: '4px' }}>
              GITHUB PROFILE URL
            </label>
            <input
              type="url"
              value={links.github}
              onChange={(e) => setLinks({ ...links, github: e.target.value })}
              placeholder="https://github.com/..."
              className="sps-input-field"
              style={{ fontSize: '12px', padding: '8px 12px', width: '100%' }}
            />
          </div>
          <div>
            <label className="sps-text-subtle" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', marginBottom: '4px' }}>
              LINKEDIN PROFILE URL
            </label>
            <input
              type="url"
              value={links.linkedin}
              onChange={(e) => setLinks({ ...links, linkedin: e.target.value })}
              placeholder="https://linkedin.com/in/..."
              className="sps-input-field"
              style={{ fontSize: '12px', padding: '8px 12px', width: '100%' }}
            />
          </div>
          <div>
            <label className="sps-text-subtle" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', marginBottom: '4px' }}>
              PERSONAL PORTFOLIO URL
            </label>
            <input
              type="url"
              value={links.portfolio}
              onChange={(e) => setLinks({ ...links, portfolio: e.target.value })}
              placeholder="https://yourname.dev"
              className="sps-input-field"
              style={{ fontSize: '12px', padding: '8px 12px', width: '100%' }}
            />
          </div>
          <div>
            <label className="sps-text-subtle" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', marginBottom: '4px' }}>
              OTHER PROFILE / BLOG URL
            </label>
            <input
              type="url"
              value={links.other}
              onChange={(e) => setLinks({ ...links, other: e.target.value })}
              placeholder="https://..."
              className="sps-input-field"
              style={{ fontSize: '12px', padding: '8px 12px', width: '100%' }}
            />
          </div>
        </div>

        <button
          onClick={() => updateContentMutation.mutate()}
          disabled={updateContentMutation.isPending}
          className="profile-cta-btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Save size={14} />
          <span>{updateContentMutation.isPending ? 'SAVING...' : 'SAVE PORTFOLIO CONTENT'}</span>
        </button>
      </div>

      {/* ── 4. Item-Level Curation: Selected Projects ── */}
      <div style={{ marginBottom: '32px' }}>
        <div className="micro-annotation annotation-blue" style={{ marginBottom: '8px' }}>
          ITEM CURATION // SELECTED NST PROJECTS
        </div>
        <p className="sps-text-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginBottom: '14px' }}>
          Choose which published projects appear on your public dossier and designate featured work. Unpublishing a project at its source automatically hides it.
        </p>

        {availableProjects.length === 0 ? (
          <div className="sps-panel" style={{ border: '1px dashed var(--border-default, rgba(0,0,0,0.2))', padding: '20px', textAlign: 'center' }}>
            <span className="sps-text-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              No published projects yet. Create or contribute to a project in{' '}
              <Link href="/my/projects" style={{ color: 'var(--electric-blue)' }}>
                My Projects ↗
              </Link>
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {availableProjects.map((p) => {
              const curation = getCuration('PROJECT', p.id);
              const isHidden = curation?.hidden || false;
              const isFeatured = curation?.featured || false;

              return (
                <div
                  key={p.id}
                  className="sps-card-item"
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 800 }}>
                        {p.title}
                      </span>
                      {isFeatured && (
                        <span style={{ background: '#FF9500', color: '#000', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 900, padding: '2px 6px' }}>
                          ★ PINNED
                        </span>
                      )}
                    </div>
                    <div className="sps-text-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginTop: '2px' }}>
                      {p.role} · {p.category}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => toggleItemFeatured('PROJECT', p.id)}
                      style={{
                        background: isFeatured ? '#FF9500' : 'transparent',
                        border: '1px solid #FF9500',
                        color: isFeatured ? '#000' : '#FF9500',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Star size={12} />
                      <span>{isFeatured ? 'UNPIN' : 'PIN TO TOP'}</span>
                    </button>
                    <button
                      onClick={() => toggleItemHidden('PROJECT', p.id)}
                      style={{
                        background: isHidden ? '#222' : 'var(--electric-blue)',
                        border: 'none',
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '6px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      {isHidden ? 'SHOW ON PROFILE' : 'HIDE FROM PROFILE'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 5. Item-Level Curation: Official Achievements ── */}
      <div style={{ marginBottom: '32px' }}>
        <div className="micro-annotation annotation-amber" style={{ marginBottom: '8px' }}>
          ITEM CURATION // OFFICIAL COMPETITION HONORS
        </div>
        <p className="sps-text-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginBottom: '14px' }}>
          Display selected competition placements. Hiding an award from your public dossier does NOT modify the authoritative event results ledger.
        </p>

        {availableAchievements.length === 0 ? (
          <div className="sps-panel" style={{ border: '1px dashed var(--border-default, rgba(0,0,0,0.2))', padding: '20px', textAlign: 'center' }}>
            <span className="sps-text-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              No official event honors recorded yet.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {availableAchievements.map((ach) => {
              const curation = getCuration('ACHIEVEMENT', ach.id);
              const isHidden = curation?.hidden || false;

              return (
                <div
                  key={ach.id}
                  className="sps-card-item"
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 800 }}>
                        {ach.award_name}
                      </span>
                      {ach.placement && (
                        <span style={{ background: '#0057FF', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, padding: '2px 6px' }}>
                          Rank #{ach.placement}
                        </span>
                      )}
                    </div>
                    <div className="sps-text-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginTop: '2px' }}>
                      {ach.event?.title || 'Event'} · {ach.awarded_at ? new Date(ach.awarded_at).getFullYear() : '—'}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleItemHidden('ACHIEVEMENT', ach.id)}
                    style={{
                      background: isHidden ? '#222' : 'var(--electric-blue)',
                      border: 'none',
                      color: '#fff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '6px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    {isHidden ? 'SHOW ON PROFILE' : 'HIDE FROM PROFILE'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 6. Live Preview Modal ── */}
      {showPreviewModal && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          title="PUBLIC DOSSIER // LIVE PROJECTION PREVIEW"
          maxWidth="max-w-2xl"
        >
          <div style={{ padding: '16px', background: 'var(--surface-canvas, #F8F9FA)', color: 'var(--text-primary, #0A0D14)', maxHeight: '75vh', overflowY: 'auto' }}>
            <div className="micro-annotation annotation-blue" style={{ marginBottom: '12px' }}>
              EXACT PROJECTION AS SEEN BY LOGGED-OUT VISITORS
            </div>

            {/* Dossier Mock */}
            <div style={{ border: '2px solid var(--border-strong, #000)', padding: '24px', background: 'var(--surface-card, #FFFFFF)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', background: 'var(--electric-blue)', border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 900, color: '#fff' }}>
                  {visibility.avatar && data.user.avatarUrl ? (
                    <img src={data.user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (data.user.fullName || profile.slug).slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 900, margin: 0 }}>
                    {visibility.identity ? data.user.fullName : `@${profile.slug}`}
                  </h4>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--electric-blue)' }}>
                    @{profile.slug}
                  </div>
                  {visibility.academic && (
                    <div className="sps-text-subtle" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', marginTop: '4px' }}>
                      🎓 {data.user.program || 'Student'} {data.user.batch ? `· Batch ${data.user.batch}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {visibility.bio && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.1))', paddingTop: '12px' }}>
                  {headline && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--electric-blue)', fontWeight: 600 }}>{headline}</div>}
                  {bio && <p className="sps-text-subtle" style={{ fontSize: '13px', marginTop: '6px' }}>{bio}</p>}
                </div>
              )}

              {visibility.skills && skills.length > 0 && (
                <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {skills.map((s) => (
                    <span key={s} className="sps-skill-chip" style={{ padding: '2px 8px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                      #{s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="profile-cta-btn"
                style={{ fontSize: '11px', padding: '8px 16px' }}
              >
                CLOSE PREVIEW
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
    </>
  );
}
