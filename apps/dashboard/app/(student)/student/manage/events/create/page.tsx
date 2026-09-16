'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo } from 'react';
import { useClubAdmin } from '../../../../../../components/layout/ClubAdminProvider';
import { useCreateEvent, useSubmitEventForApproval } from '../../../../../../hooks/useCreateEvent';
import { useAcademicBatches } from '../../../../../../hooks/useAcademicBatches';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  User,
  Sparkles,
  Zap,
  Wrench,
  Mic,
  PartyPopper,
  Trophy,
  Globe,
  Lock,
  EyeOff,
  CheckCircle2,
  Image as ImageIcon,
  Plus,
  Minus,
  Check,
  Layers,
  Info,
  ExternalLink,
  Eye,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useClubs } from '../../../../../../hooks/useClubs';
import { MultiSelect } from '../../../../components/MultiSelect';

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
    category: 'DESIGN',
    url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Keynote & Tech Talk',
    category: 'SEMINAR',
    url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Campus Social & Mixer',
    category: 'SOCIAL',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'E-Sports & Gaming Arena',
    category: 'COMPETITION',
    url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
  },
];

const EVENT_TYPES = [
  { value: 'HACKATHON', label: 'Hackathon', icon: Zap, desc: 'Build & sprint' },
  { value: 'WORKSHOP', label: 'Workshop', icon: Wrench, desc: 'Hands-on learning' },
  { value: 'SEMINAR', label: 'Seminar', icon: Mic, desc: 'Talks & keynotes' },
  { value: 'COMPETITION', label: 'Competition', icon: Trophy, desc: 'Tournaments & awards' },
  { value: 'SOCIAL', label: 'Social', icon: PartyPopper, desc: 'Mixers & gaming' },
  { value: 'OTHER', label: 'Other', icon: Sparkles, desc: 'Community meetup' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', icon: Globe, desc: 'Visible to everyone on campus' },
  { value: 'PRIVATE', label: 'Private', icon: Lock, desc: 'Direct invite link only' },
  { value: 'UNLISTED', label: 'Unlisted', icon: EyeOff, desc: 'Hidden from feed' },
] as const;

const getTomorrowDateString = (offsetDays = 1) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getUpcomingWeekendString = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dateNum = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${dateNum}`;
};

const formatPreviewDate = (dateStr: string, timeStr: string) => {
  if (!dateStr) return 'Date TBA';
  try {
    const d = new Date(`${dateStr}T${timeStr || '00:00'}`);
    if (isNaN(d.getTime())) return dateStr;
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = d.getDate();
    const timeFormatted = timeStr
      ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : '';
    return `${weekday}, ${month} ${day}${timeFormatted ? ` • ${timeFormatted}` : ''}`;
  } catch {
    return dateStr;
  }
};

const calculateDuration = (startDate: string, startTime: string, endDate: string, endTime: string) => {
  if (!startDate || !startTime || !endDate || !endTime) return null;
  try {
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    if (isNaN(diffMs) || diffMs <= 0) return null;

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      return `${days}d ${remainingHours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    }
    if (hours > 0) {
      return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    }
    return `${minutes} min`;
  } catch {
    return null;
  }
};

const createEventStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --bg-dark-surface: #14161f;
    --electric-blue: #0057FF;
    --electric-blue-dark: #0042c7;
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
    max-width: 1320px;
    margin: 0 auto;
    padding: 48px 32px 100px 32px;
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
  .ce-micro-green { color: var(--acid-green); }

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
    margin-bottom: 24px;
    transition: color 0.15s;
  }
  .ce-back:hover { color: var(--electric-blue); }

  /* ── Studio Grid ── */
  .ce-studio-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.42fr) minmax(360px, 0.98fr);
    gap: 40px;
    align-items: start;
  }
  @media (max-width: 1100px) {
    .ce-studio-grid {
      grid-template-columns: 1fr;
    }
    .ce-studio-preview-col {
      order: -1;
    }
  }

  /* ── Section Card ── */
  .ce-section {
    border: 3px solid rgba(245,245,242,0.18);
    background: var(--bg-dark-card);
    padding: 28px;
    margin-bottom: 28px;
    box-shadow: 6px 6px 0px #000;
  }
  .ce-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid rgba(245,245,242,0.12);
    padding-bottom: 12px;
    margin-bottom: 24px;
  }
  .ce-section-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ce-section-num {
    font-family: var(--font-mono);
    color: var(--electric-blue);
    font-weight: 800;
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
    margin-bottom: 8px;
  }
  .ce-input, .ce-textarea, .ce-select {
    width: 100%;
    background: #000;
    border: 2px solid rgba(245,245,242,0.22);
    color: var(--bg-paper-white);
    font-family: var(--font-mono);
    font-size: 13px;
    padding: 12px 14px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    border-radius: 0 !important;
  }
  .ce-input:focus, .ce-textarea:focus, .ce-select:focus {
    border-color: var(--electric-blue);
    box-shadow: 0 0 0 1px var(--electric-blue);
  }
  .ce-input::placeholder, .ce-textarea::placeholder {
    color: #555;
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
    .ce-inner { padding: 32px 16px 80px 16px; }
  }

  .ce-field { margin-bottom: 20px; }
  .ce-field:last-child { margin-bottom: 0; }

  /* ── Curated Banner Presets ── */
  .ce-preset-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 10px;
  }
  @media (max-width: 640px) {
    .ce-preset-grid { grid-template-columns: repeat(2, 1fr); }
  }
  .ce-preset-card {
    border: 2px solid rgba(245,245,242,0.18);
    background: #000;
    cursor: pointer;
    overflow: hidden;
    position: relative;
    height: 78px;
    transition: transform 0.15s, border-color 0.15s;
  }
  .ce-preset-card:hover {
    border-color: var(--electric-blue);
    transform: translateY(-2px);
  }
  .ce-preset-card.active {
    border-color: var(--acid-green);
    box-shadow: 3px 3px 0px #000;
  }
  .ce-preset-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: brightness(65%);
    transition: filter 0.15s;
  }
  .ce-preset-card:hover img, .ce-preset-card.active img {
    filter: brightness(95%);
  }
  .ce-preset-tag {
    position: absolute;
    bottom: 4px;
    left: 4px;
    background: rgba(0,0,0,0.85);
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #fff;
  }

  /* ── Segmented Choice Cards ── */
  .ce-choice-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .ce-choice-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  @media (max-width: 640px) {
    .ce-choice-grid-3, .ce-choice-grid-2 {
      grid-template-columns: 1fr;
    }
  }
  .ce-choice-card {
    border: 2px solid rgba(245,245,242,0.18);
    background: #000;
    padding: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-radius: 0 !important;
    text-align: left;
  }
  .ce-choice-card:hover {
    border-color: var(--electric-blue);
    background: rgba(0, 87, 255, 0.05);
  }
  .ce-choice-card.active {
    border-color: var(--acid-green);
    background: rgba(200, 255, 0, 0.07);
    box-shadow: 3px 3px 0px #000;
  }
  .ce-choice-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #fff;
  }
  .ce-choice-card.active .ce-choice-header {
    color: var(--acid-green);
  }
  .ce-choice-desc {
    font-family: var(--font-body);
    font-size: 11px;
    color: #888;
    line-height: 1.35;
  }

  /* ── Quick Date Chips ── */
  .ce-quick-date-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .ce-date-chip {
    background: #000;
    border: 1px solid rgba(245,245,242,0.25);
    color: var(--bg-paper-white);
    padding: 5px 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .ce-date-chip:hover {
    border-color: var(--electric-blue);
    background: rgba(0, 87, 255, 0.1);
  }

  /* ── Stepper ── */
  .ce-stepper {
    display: flex;
    align-items: center;
    border: 2px solid rgba(245,245,242,0.22);
    background: #000;
  }
  .ce-stepper-btn {
    background: none;
    border: none;
    color: var(--bg-paper-white);
    padding: 10px 14px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-weight: 700;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ce-stepper-btn:hover:not(:disabled) {
    background: rgba(245,245,242,0.12);
  }
  .ce-stepper-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .ce-stepper-val {
    flex: 1;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 700;
    color: #fff;
  }

  /* ── Live Preview Box ── */
  .ce-preview-box {
    position: sticky;
    top: 24px;
    border: 3px solid #ffffff;
    background: var(--bg-dark-card);
    box-shadow: 8px 8px 0px #000000;
  }
  .ce-preview-header {
    background: #050505;
    padding: 14px 20px;
    border-bottom: 2px solid rgba(245,245,242,0.15);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ce-preview-badge-live {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--acid-green);
  }
  .ce-pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--acid-green);
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.75); }
  }
  .ce-preview-card-body {
    padding: 24px;
    background: var(--bg-paper-white);
  }

  /* ── Poster Card ── */
  .ce-poster-card {
    background: var(--bg-paper-white);
    color: var(--bg-black);
    border: 3px solid #000000;
    padding: 20px;
    box-shadow: 10px 10px 0px #000000;
    display: flex;
    flex-direction: column;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    text-decoration: none;
    transform: translateZ(0);
    backface-visibility: hidden;
    contain: content;
    content-visibility: auto;
  }
  .ce-poster-card:hover {
    transform: translate3d(-4px, -4px, 0) rotate(-1deg);
    box-shadow: 14px 14px 0px #000000;
  }

  .ce-poster-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }

  .ce-date-badge {
    background: #000;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    padding: 4px 10px;
    text-transform: uppercase;
  }

  .ce-type-badge {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #000;
  }

  .ce-poster-title {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 900;
    line-height: 1.05;
    text-transform: uppercase;
    color: #000;
    margin-bottom: 12px;
    word-break: break-word;
  }

  .ce-poster-img-frame {
    width: 100%;
    height: 180px;
    background: #111;
    border: 2px solid #000;
    margin-bottom: 14px;
    position: relative;
    overflow: hidden;
    transform: translateZ(0);
    contain: paint;
  }
  .ce-poster-img-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: contrast(125%) grayscale(80%);
    transform: translateZ(0);
    backface-visibility: hidden;
    will-change: transform, filter;
    transition: filter 0.3s ease;
  }
  .ce-poster-card:hover .ce-poster-img-frame img {
    filter: contrast(100%) grayscale(0%);
  }

  .ce-poster-img-placeholder {
    width: 100%;
    height: 180px;
    background: linear-gradient(135deg, #111 0%, #1a1a2e 50%, #0d0e12 100%);
    border: 2px solid #000;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    transform: translateZ(0);
    contain: paint;
  }
  .ce-poster-img-placeholder::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(0,87,255,0.15) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  .ce-poster-img-placeholder-text {
    font-family: var(--font-display);
    font-size: 48px;
    font-weight: 900;
    color: rgba(255,255,255,0.06);
    text-transform: uppercase;
    letter-spacing: -2px;
    z-index: 1;
  }

  .ce-poster-desc {
    font-family: var(--font-body);
    font-size: 13.5px;
    color: #222;
    line-height: 1.5;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .ce-poster-footer {
    margin-top: auto;
    padding-top: 12px;
    border-top: 2px dashed #000;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
  }

  .ce-location-text {
    color: #333;
  }

  .ce-explore-btn {
    background: var(--electric-blue);
    color: #ffffff;
    border: 2px solid #000;
    padding: 8px 16px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 2px 2px 0px #000;
    transition: transform 0.1s, box-shadow 0.1s;
    border-radius: 0 !important;
  }
  .ce-explore-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0px #000;
  }

  /* ── Readiness Bar ── */
  .ce-readiness-card {
    background: #000;
    border-top: 2px solid rgba(245,245,242,0.12);
    padding: 16px 20px;
  }
  .ce-progress-track {
    width: 100%;
    height: 6px;
    background: rgba(245,245,242,0.1);
    margin-top: 8px;
    position: relative;
    overflow: hidden;
  }
  .ce-progress-fill {
    height: 100%;
    background: var(--acid-green);
    transition: width 0.25s ease;
  }

  /* ── Sticky Bottom Bar ── */
  .ce-sticky-bottom-bar {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(5, 5, 5, 0.94);
    backdrop-filter: blur(16px);
    border-top: 2px solid rgba(245,245,242,0.2);
    padding: 16px 32px;
    z-index: 40;
    margin-top: 40px;
  }
  .ce-bottom-bar-inner {
    max-width: 1320px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  /* ── Buttons ── */
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
    gap: 8px;
    background: var(--acid-green);
    color: #000;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 12px 26px;
    border: 2px solid #000;
    cursor: pointer;
    box-shadow: 4px 4px 0px rgba(245,245,242,0.3);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .ce-btn-submit:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px rgba(245,245,242,0.3);
  }
  .ce-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .ce-error-banner {
    padding: 12px 16px;
    background: rgba(255,59,48,0.12);
    border: 2px solid var(--warm-red);
    color: var(--warm-red);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
`;

export default function CreateEventPage() {
  const { activeClubId, managedClubs, isHydrated } = useClubAdmin();
  const router = useRouter();
  const createEvent = useCreateEvent();
  const submitApproval = useSubmitEventForApproval();

  const [submitAction, setSubmitAction] = useState<'DRAFT' | 'SUBMIT'>('DRAFT');
  const [formError, setFormError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'FORM' | 'PREVIEW'>('FORM');

  const { data: clubsData } = useClubs();
  const { data: batchesData } = useAcademicBatches();

  const activeClub = useMemo(() => {
    return managedClubs.find(c => c.id === activeClubId) || clubsData?.data?.find(c => c.id === activeClubId);
  }, [managedClubs, clubsData, activeClubId]);

  const eligibleClubs = clubsData?.data?.map(c => ({ id: c.id, name: c.name })) || [];
  const collaboratingClubsOptions = eligibleClubs.filter(c => c.id !== activeClubId);

  useEffect(() => {
    if (isHydrated && !activeClubId && managedClubs.length === 0) {
      router.push('/student/home');
    }
  }, [isHydrated, activeClubId, managedClubs.length, router]);

  // Form State with Smart Defaults
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    banner_url: BANNER_PRESETS[0].url,
    startDate: getTomorrowDateString(1),
    startTime: '10:00',
    endDate: getTomorrowDateString(1),
    endTime: '13:00',
    location_name: '',
    event_type: 'WORKSHOP',
    visibility: 'PUBLIC',
    registration_type: 'INDIVIDUAL',
    attendance_type: 'SINGLE',
    max_capacity: '',
    minimum_team_size: '2',
    maximum_team_size: '4',
    audience: 'ALL_STUDENTS',
    audience_batch_ids: [] as string[],
    collaborating_club_ids: [] as string[],
  });

  const durationText = useMemo(() => {
    return calculateDuration(formData.startDate, formData.startTime, formData.endDate, formData.endTime);
  }, [formData.startDate, formData.startTime, formData.endDate, formData.endTime]);

  const readinessCheck = useMemo(() => {
    const hasValidTitle = formData.title.trim().length >= 3;
    const hasBanner = formData.banner_url.trim().length > 0;
    const hasSchedule = !!(
      formData.startDate &&
      formData.startTime &&
      formData.endDate &&
      formData.endTime &&
      new Date(`${formData.endDate}T${formData.endTime}`) > new Date(`${formData.startDate}T${formData.startTime}`)
    );
    const hasValidTeamSize =
      formData.registration_type !== 'TEAM' ||
      (Number(formData.minimum_team_size) >= 1 &&
        Number(formData.maximum_team_size) >= Number(formData.minimum_team_size));
    const hasValidAudience =
      formData.audience !== 'SPECIFIC_BATCHES' || formData.audience_batch_ids.length > 0;

    const checks = [
      { id: 'title', label: 'Title (at least 3 characters)', valid: hasValidTitle },
      { id: 'banner', label: 'Banner poster image', valid: hasBanner },
      { id: 'schedule', label: 'Valid start & end time', valid: hasSchedule },
      { id: 'team', label: 'Team size rules', valid: hasValidTeamSize },
      { id: 'batches', label: 'Target batches', valid: hasValidAudience },
    ];

    const passed = checks.filter(c => c.valid).length;
    const total = checks.length;
    const percentage = Math.round((passed / total) * 100);

    return {
      checks,
      passed,
      total,
      percentage,
      isReady: hasValidTitle && hasBanner && hasSchedule && hasValidTeamSize && hasValidAudience,
    };
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };

      // Smart Date auto-sync: if start date is moved past end date, align end date
      if (name === 'startDate' && next.endDate < value) {
        next.endDate = value;
      }
      return next;
    });
  };

  const handleMultiSelectChange = (name: string, values: string[]) => {
    setFormData(prev => ({ ...prev, [name]: values }));
  };

  const setQuickDate = (mode: 'tomorrow' | 'weekend' | 'next_week') => {
    if (mode === 'tomorrow') {
      const t = getTomorrowDateString(1);
      setFormData(prev => ({
        ...prev,
        startDate: t,
        endDate: t,
        startTime: '10:00',
        endTime: '13:00',
      }));
    } else if (mode === 'weekend') {
      const w = getUpcomingWeekendString();
      setFormData(prev => ({
        ...prev,
        startDate: w,
        endDate: w,
        startTime: '11:00',
        endTime: '18:00',
      }));
    } else if (mode === 'next_week') {
      const n = getTomorrowDateString(7);
      setFormData(prev => ({
        ...prev,
        startDate: n,
        endDate: n,
        startTime: '14:00',
        endTime: '17:00',
      }));
    }
  };

  const adjustTeamSize = (field: 'minimum_team_size' | 'maximum_team_size', delta: number) => {
    const current = parseInt(formData[field], 10) || (field === 'minimum_team_size' ? 2 : 4);
    const updated = Math.max(1, current + delta);
    setFormData(prev => {
      const next = { ...prev, [field]: updated.toString() };
      if (field === 'minimum_team_size' && parseInt(next.maximum_team_size, 10) < updated) {
        next.maximum_team_size = updated.toString();
      }
      if (field === 'maximum_team_size' && parseInt(next.minimum_team_size, 10) > updated) {
        next.minimum_team_size = updated.toString();
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!activeClubId) {
      setFormError('No active club selected.');
      return;
    }

    if (!formData.title.trim() || formData.title.trim().length < 3) {
      setFormError('Title must be at least 3 characters.');
      return;
    }

    if (!formData.banner_url.trim()) {
      setFormError('Event Banner Image URL is mandatory.');
      return;
    }

    const start_time = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
    const end_time = new Date(`${formData.endDate}T${formData.endTime}`).toISOString();

    if (new Date(end_time) <= new Date(start_time)) {
      setFormError('End date/time must be strictly after Start date/time.');
      return;
    }

    const payload: any = {
      title: formData.title.trim(),
      start_time,
      end_time,
      event_type: formData.event_type,
      visibility: formData.visibility,
      registration_type: formData.registration_type,
      attendance_type: formData.attendance_type,
      audience: formData.audience,
      club_ids: [
        { club_id: activeClubId, is_primary: true },
        ...formData.collaborating_club_ids.map(id => ({ club_id: id, is_primary: false })),
      ],
      metadata: {
        banner_url: formData.banner_url.trim(),
        ...(formData.registration_type === 'TEAM'
          ? {
              minimum_team_size: parseInt(formData.minimum_team_size, 10) || 2,
              maximum_team_size: parseInt(formData.maximum_team_size, 10) || 4,
            }
          : {}),
      },
    };

    if (formData.description.trim()) {
      payload.description = formData.description.trim();
    }
    if (formData.location_name.trim()) {
      payload.location_name = formData.location_name.trim();
    }
    if (formData.max_capacity && parseInt(formData.max_capacity, 10) > 0) {
      payload.max_capacity = parseInt(formData.max_capacity, 10);
    }
    if (formData.audience === 'SPECIFIC_BATCHES' && formData.audience_batch_ids.length > 0) {
      payload.audience_batch_ids = formData.audience_batch_ids;
    }

    try {
      const event = await createEvent.mutateAsync(payload);
      if (submitAction === 'SUBMIT') {
        await submitApproval.mutateAsync(event.id);
      }
      router.push(`/student/events/${event.id}/manage`);
    } catch (error: any) {
      console.error('Failed to create/submit event:', error);
      setFormError(error?.data?.error || error?.message || 'Failed to save event. Please try again.');
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

          {/* Navigation & Header */}
          <Link href="/student/manage/events" className="ce-back">
            <ArrowLeft size={13} /> BACK TO EVENTS
          </Link>

          <div style={{ borderBottom: '3px solid #fff', paddingBottom: 24, marginBottom: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="ce-micro ce-micro-blue" style={{ marginBottom: 8 }}>
                EVENT CREATION STUDIO // {activeClub?.name || 'CLUB MANAGEMENT'}
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5.5vw, 64px)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: -1, lineHeight: 0.92, color: '#fff' }}>
                NEW EVENT
              </h1>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="flex md:hidden border-2 border-white/20 bg-[#000] p-1 font-mono text-[10px] font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setMobileTab('FORM')}
                className={`px-3 py-1.5 transition-all ${mobileTab === 'FORM' ? 'bg-[#0057FF] text-white' : 'text-[#a0a4b8]'}`}
              >
                <Sliders size={12} className="inline mr-1" /> BUILDER
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('PREVIEW')}
                className={`px-3 py-1.5 transition-all ${mobileTab === 'PREVIEW' ? 'bg-[#0057FF] text-white' : 'text-[#a0a4b8]'}`}
              >
                <Eye size={12} className="inline mr-1" /> PREVIEW ({readinessCheck.percentage}%)
              </button>
            </div>
          </div>

          {formError && (
            <div className="ce-error-banner">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} />
                {formError}
              </span>
              <button
                type="button"
                onClick={() => setFormError(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="ce-studio-grid">

              {/* ── Left Column: Creation Studio Form ── */}
              <div style={{ display: mobileTab === 'FORM' ? 'block' : 'none' }} className="md:!block">

                {/* 01. BASIC DETAILS & BANNER */}
                <div className="ce-section">
                  <div className="ce-section-header">
                    <span className="ce-section-title">
                      <span className="ce-section-num">01 //</span> EVENT IDENTITY
                    </span>
                    <span className="ce-micro">CORE INFO</span>
                  </div>

                  <div className="ce-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="ce-label" style={{ margin: 0 }}>EVENT TITLE *</label>
                      <span className="ce-micro" style={{ fontSize: 10 }}>{formData.title.length}/255</span>
                    </div>
                    <input
                      required minLength={3} maxLength={255}
                      type="text" name="title" value={formData.title}
                      onChange={handleChange} className="ce-input"
                      placeholder="e.g. Campus Hackathon 2026: Agentic AI Edition"
                    />
                  </div>

                  <div className="ce-field">
                    <label className="ce-label">DESCRIPTION &amp; AGENDA</label>
                    <textarea
                      name="description" value={formData.description}
                      onChange={handleChange} className="ce-textarea"
                      placeholder="Describe what participants will do, learn, win, or experience..."
                    />
                  </div>

                  <div className="ce-field">
                    <label className="ce-label">EVENT BANNER IMAGE POSTER *</label>
                    
                    {/* Curated Presets Library */}
                    <div style={{ marginBottom: 12 }}>
                      <div className="ce-micro" style={{ fontSize: 10, marginBottom: 6, color: '#888' }}>
                        ONE-CLICK CURATED POSTERS:
                      </div>
                      <div className="ce-preset-grid">
                        {BANNER_PRESETS.map((preset) => (
                          <div
                            key={preset.label}
                            onClick={() => setFormData(prev => ({ ...prev, banner_url: preset.url }))}
                            className={`ce-preset-card ${formData.banner_url === preset.url ? 'active' : ''}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={preset.url} alt={preset.label} />
                            <span className="ce-preset-tag">{preset.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Custom Image URL input */}
                    <div>
                      <div className="ce-micro" style={{ fontSize: 10, marginBottom: 6, color: '#888' }}>
                        OR PASTE CUSTOM IMAGE URL:
                      </div>
                      <input
                        required type="url" name="banner_url" value={formData.banner_url}
                        onChange={handleChange} className="ce-input"
                        placeholder="https://images.unsplash.com/..."
                      />
                    </div>
                  </div>
                </div>

                {/* 02. SCHEDULE & VENUE */}
                <div className="ce-section">
                  <div className="ce-section-header">
                    <span className="ce-section-title">
                      <span className="ce-section-num">02 //</span> SCHEDULE &amp; VENUE
                    </span>
                    <span className="ce-micro">TIMING</span>
                  </div>

                  {/* Quick Date Presets */}
                  <div className="ce-quick-date-bar">
                    <button type="button" onClick={() => setQuickDate('tomorrow')} className="ce-date-chip">
                      ⚡ TOMORROW
                    </button>
                    <button type="button" onClick={() => setQuickDate('weekend')} className="ce-date-chip">
                      📅 THIS WEEKEND
                    </button>
                    <button type="button" onClick={() => setQuickDate('next_week')} className="ce-date-chip">
                      🚀 NEXT WEEK
                    </button>
                  </div>

                  <div className="ce-form-row" style={{ marginBottom: 16 }}>
                    <div>
                      <label className="ce-label">START DATE *</label>
                      <input required type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="ce-input" />
                    </div>
                    <div>
                      <label className="ce-label">START TIME *</label>
                      <input required type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="ce-input" />
                    </div>
                  </div>

                  <div className="ce-form-row" style={{ marginBottom: 16 }}>
                    <div>
                      <label className="ce-label">END DATE *</label>
                      <input required type="date" name="endDate" value={formData.endDate} onChange={handleChange} className="ce-input" />
                    </div>
                    <div>
                      <label className="ce-label">END TIME *</label>
                      <input required type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="ce-input" />
                    </div>
                  </div>

                  {/* Duration & Timezone Indicator */}
                  {durationText && (
                    <div style={{ padding: '10px 14px', background: 'rgba(0, 87, 255, 0.08)', border: '1px solid var(--electric-blue)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="ce-micro ce-micro-blue" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={13} /> EVENT DURATION: {durationText}
                      </span>
                      <span className="ce-micro" style={{ fontSize: 9 }}>LOCAL TIMEZONE</span>
                    </div>
                  )}

                  <div className="ce-field">
                    <label className="ce-label">LOCATION / VENUE NAME</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text" name="location_name" value={formData.location_name}
                        onChange={handleChange} className="ce-input"
                        placeholder="e.g. University Main Auditorium / Hall B"
                        style={{ paddingLeft: 38 }}
                      />
                      <MapPin size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    </div>
                  </div>
                </div>

                {/* 03. FORMAT, ATTENDANCE & VISIBILITY */}
                <div className="ce-section">
                  <div className="ce-section-header">
                    <span className="ce-section-title">
                      <span className="ce-section-num">03 //</span> FORMAT &amp; ACCESS
                    </span>
                    <span className="ce-micro">EVENT CLASSIFICATION</span>
                  </div>

                  {/* Event Type Grid */}
                  <div className="ce-field">
                    <label className="ce-label">EVENT TYPE</label>
                    <div className="ce-choice-grid-3">
                      {EVENT_TYPES.map(t => {
                        const Icon = t.icon;
                        const isSelected = formData.event_type === t.value;
                        return (
                          <div
                            key={t.value}
                            onClick={() => setFormData(prev => ({ ...prev, event_type: t.value }))}
                            className={`ce-choice-card ${isSelected ? 'active' : ''}`}
                          >
                            <div className="ce-choice-header">
                              <Icon size={14} />
                              {t.label}
                            </div>
                            <span className="ce-choice-desc">{t.desc}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Visibility */}
                  <div className="ce-field">
                    <label className="ce-label">VISIBILITY</label>
                    <div className="ce-choice-grid-3">
                      {VISIBILITY_OPTIONS.map(v => {
                        const Icon = v.icon;
                        const isSelected = formData.visibility === v.value;
                        return (
                          <div
                            key={v.value}
                            onClick={() => setFormData(prev => ({ ...prev, visibility: v.value }))}
                            className={`ce-choice-card ${isSelected ? 'active' : ''}`}
                          >
                            <div className="ce-choice-header">
                              <Icon size={14} />
                              {v.label}
                            </div>
                            <span className="ce-choice-desc">{v.desc}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Attendance Type */}
                  <div className="ce-field">
                    <label className="ce-label">ATTENDANCE CHECK-IN TYPE</label>
                    <div className="ce-choice-grid-2">
                      <div
                        onClick={() => setFormData(prev => ({ ...prev, attendance_type: 'SINGLE' }))}
                        className={`ce-choice-card ${formData.attendance_type === 'SINGLE' ? 'active' : ''}`}
                      >
                        <div className="ce-choice-header">
                          <CheckCircle2 size={14} /> Single Session
                        </div>
                        <span className="ce-choice-desc">Single QR scan for the event duration</span>
                      </div>
                      <div
                        onClick={() => setFormData(prev => ({ ...prev, attendance_type: 'MULTI_SESSION' }))}
                        className={`ce-choice-card ${formData.attendance_type === 'MULTI_SESSION' ? 'active' : ''}`}
                      >
                        <div className="ce-choice-header">
                          <Layers size={14} /> Multi-Session
                        </div>
                        <span className="ce-choice-desc">Separate check-ins for multiple days or tracks</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 04. REGISTRATION & AUDIENCE */}
                <div className="ce-section">
                  <div className="ce-section-header">
                    <span className="ce-section-title">
                      <span className="ce-section-num">04 //</span> REGISTRATION &amp; AUDIENCE
                    </span>
                    <span className="ce-micro">PARTICIPANTS</span>
                  </div>

                  {/* Registration Type Selection */}
                  <div className="ce-field">
                    <label className="ce-label">REGISTRATION FORMAT</label>
                    <div className="ce-choice-grid-2">
                      <div
                        onClick={() => setFormData(prev => ({ ...prev, registration_type: 'INDIVIDUAL' }))}
                        className={`ce-choice-card ${formData.registration_type === 'INDIVIDUAL' ? 'active' : ''}`}
                      >
                        <div className="ce-choice-header">
                          <User size={14} /> Solo / Individual
                        </div>
                        <span className="ce-choice-desc">Students register individually</span>
                      </div>
                      <div
                        onClick={() => setFormData(prev => ({ ...prev, registration_type: 'TEAM' }))}
                        className={`ce-choice-card ${formData.registration_type === 'TEAM' ? 'active' : ''}`}
                      >
                        <div className="ce-choice-header">
                          <Users size={14} /> Team Squad
                        </div>
                        <span className="ce-choice-desc">Students register in squads/teams</span>
                      </div>
                    </div>
                  </div>

                  {/* Team Size Rules (When Team selected) */}
                  {formData.registration_type === 'TEAM' && (
                    <div style={{ padding: 18, background: 'rgba(0,0,0,0.6)', border: '2px dashed rgba(200, 255, 0, 0.35)', marginBottom: 20 }}>
                      <div className="ce-micro ce-micro-green" style={{ marginBottom: 12 }}>
                        SQUAD SIZE REQUIREMENTS
                      </div>
                      <div className="ce-form-row">
                        <div>
                          <label className="ce-label">MINIMUM TEAM MEMBERS *</label>
                          <div className="ce-stepper">
                            <button
                              type="button"
                              onClick={() => adjustTeamSize('minimum_team_size', -1)}
                              disabled={parseInt(formData.minimum_team_size, 10) <= 1}
                              className="ce-stepper-btn"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="ce-stepper-val">{formData.minimum_team_size}</span>
                            <button
                              type="button"
                              onClick={() => adjustTeamSize('minimum_team_size', 1)}
                              className="ce-stepper-btn"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="ce-label">MAXIMUM TEAM MEMBERS *</label>
                          <div className="ce-stepper">
                            <button
                              type="button"
                              onClick={() => adjustTeamSize('maximum_team_size', -1)}
                              disabled={parseInt(formData.maximum_team_size, 10) <= parseInt(formData.minimum_team_size, 10)}
                              className="ce-stepper-btn"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="ce-stepper-val">{formData.maximum_team_size}</span>
                            <button
                              type="button"
                              onClick={() => adjustTeamSize('maximum_team_size', 1)}
                              className="ce-stepper-btn"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Maximum Capacity */}
                  <div className="ce-field">
                    <label className="ce-label">
                      {formData.registration_type === 'TEAM' ? 'MAXIMUM REGISTERED TEAMS' : 'MAXIMUM PARTICIPANT CAPACITY'}
                    </label>
                    <input
                      type="number" min="1" name="max_capacity" value={formData.max_capacity}
                      onChange={handleChange} placeholder="Leave empty for unlimited capacity"
                      className="ce-input"
                    />
                  </div>

                  {/* Audience Targeting */}
                  <div className="ce-field">
                    <label className="ce-label">AUDIENCE ELIGIBILITY</label>
                    <div className="ce-choice-grid-2" style={{ marginBottom: 12 }}>
                      <div
                        onClick={() => setFormData(prev => ({ ...prev, audience: 'ALL_STUDENTS' }))}
                        className={`ce-choice-card ${formData.audience === 'ALL_STUDENTS' ? 'active' : ''}`}
                      >
                        <div className="ce-choice-header">
                          <Globe size={14} /> All Students
                        </div>
                        <span className="ce-choice-desc">Open to any enrolled student</span>
                      </div>
                      <div
                        onClick={() => setFormData(prev => ({ ...prev, audience: 'SPECIFIC_BATCHES' }))}
                        className={`ce-choice-card ${formData.audience === 'SPECIFIC_BATCHES' ? 'active' : ''}`}
                      >
                        <div className="ce-choice-header">
                          <Layers size={14} /> Specific Batches
                        </div>
                        <span className="ce-choice-desc">Restricted to selected academic cohorts</span>
                      </div>
                    </div>

                    {formData.audience === 'SPECIFIC_BATCHES' && (
                      <div style={{ marginTop: 12 }}>
                        <label className="ce-label">SELECT ELIGIBLE ACADEMIC BATCHES *</label>
                        <MultiSelect
                          options={batchesData?.map(b => ({ value: b.id, label: b.display_name })) || []}
                          selectedValues={formData.audience_batch_ids}
                          onChange={(values: string[]) => handleMultiSelectChange('audience_batch_ids', values)}
                          placeholder="Search and select cohorts..."
                        />
                      </div>
                    )}
                  </div>

                  {/* Collaborating Clubs */}
                  <div className="ce-field">
                    <label className="ce-label">COLLABORATING CLUBS (CO-HOSTS)</label>
                    <MultiSelect
                      options={collaboratingClubsOptions.map(c => ({ value: c.id, label: c.name }))}
                      selectedValues={formData.collaborating_club_ids}
                      onChange={(values: string[]) => handleMultiSelectChange('collaborating_club_ids', values)}
                      placeholder="Select collaborating clubs..."
                    />
                  </div>
                </div>

              </div>

              {/* ── Right Column: Live Sticky Student Preview ── */}
              <div
                style={{ display: mobileTab === 'PREVIEW' ? 'block' : 'none' }}
                className="md:!block ce-studio-preview-col"
              >
                <div className="ce-preview-box">
                  <div className="ce-preview-header">
                    <span className="ce-preview-badge-live">
                      <span className="ce-pulse-dot" /> LIVE DIRECTORY CARD PREVIEW
                    </span>
                    <span className="ce-micro">HOW STUDENTS SEE IT</span>
                  </div>

                  <div className="ce-preview-card-body">
                    <div className="ce-poster-card">
                      {/* Card Header */}
                      <div className="ce-poster-card-header">
                        <span className="ce-date-badge">
                          {formatPreviewDate(formData.startDate, '') || 'DATE TBA'}
                        </span>
                        <span className="ce-type-badge">
                          {formData.event_type || 'EVENT'}
                        </span>
                      </div>

                      {/* Title */}
                      <div className="ce-poster-title">
                        {formData.title.trim() || 'UNTITLED EVENT TITLE'}
                      </div>

                      {/* Image or Placeholder */}
                      {formData.banner_url ? (
                        <div className="ce-poster-img-frame">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={formData.banner_url}
                            alt="Poster preview"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="ce-poster-img-placeholder">
                          <span className="ce-poster-img-placeholder-text">
                            {formData.event_type?.slice(0, 4) || 'NST'}
                          </span>
                        </div>
                      )}

                      {/* Description */}
                      <p className="ce-poster-desc">
                        {formData.description.trim() || 'Add a description to communicate your event vision, speakers, and schedule to students...'}
                      </p>

                      {/* Footer */}
                      <div className="ce-poster-footer">
                        <span className="ce-location-text">
                          {formData.location_name.trim() || 'Campus Venue (TBA)'}
                        </span>
                        <span className="ce-explore-btn">REGISTER ↗</span>
                      </div>
                    </div>
                  </div>

                  {/* Readiness Progress Bar */}
                  <div className="ce-readiness-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="ce-micro" style={{ color: readinessCheck.isReady ? 'var(--acid-green)' : '#a0a4b8' }}>
                        {readinessCheck.isReady ? 'READY FOR LAUNCH' : 'FORM COMPLETION'}
                      </span>
                      <span className="ce-micro ce-micro-green">{readinessCheck.percentage}%</span>
                    </div>
                    <div className="ce-progress-track">
                      <div className="ce-progress-fill" style={{ width: `${readinessCheck.percentage}%` }} />
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {readinessCheck.checks.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                          <Check size={11} style={{ color: c.valid ? 'var(--acid-green)' : '#444' }} />
                          <span style={{ color: c.valid ? '#888' : '#555' }}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* ── Sticky Bottom Action Bar ── */}
            <div className="ce-sticky-bottom-bar">
              <div className="ce-bottom-bar-inner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="ce-micro" style={{ color: readinessCheck.isReady ? 'var(--acid-green)' : '#a0a4b8' }}>
                    {readinessCheck.isReady ? '● EVENT READY TO SUBMIT' : '○ COMPLETE REQUIRED DETAILS'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                    {(createEvent.isPending || submitApproval.isPending) && submitAction === 'SUBMIT'
                      ? 'SUBMITTING...'
                      : 'SUBMIT FOR APPROVAL ↗'}
                  </button>
                </div>
              </div>
            </div>

          </form>

        </div>
      </div>
    </>
  );
}
