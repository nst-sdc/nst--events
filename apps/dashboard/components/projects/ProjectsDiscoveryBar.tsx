'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Sparkles, Flame, ThumbsUp, Clock, Filter } from 'lucide-react';
import { ProjectCategoryItem } from '../../lib/projects-api';

const CONTROLLED_CATEGORIES = [
  'All',
  'AI / Machine Learning',
  'Web Development',
  'Mobile Applications',
  'Developer Tools',
  'Open Source',
  'Data Science',
  'Cybersecurity',
  'Cloud / DevOps',
  'Robotics / Hardware',
  'Research',
  'UI / UX and Design',
  'Other',
];

const STATUS_OPTIONS = [
  { value: '', label: 'ALL STATUSES' },
  { value: 'LIVE', label: 'LIVE / USABLE' },
  { value: 'PROTOTYPE', label: 'PROTOTYPE' },
  { value: 'IN_PROGRESS', label: 'IN PROGRESS' },
  { value: 'IDEA', label: 'IDEA / CONCEPT' },
  { value: 'COMPLETED', label: 'COMPLETED' },
  { value: 'ARCHIVED', label: 'ARCHIVED' },
];

interface ProjectsDiscoveryBarProps {
  currentView: string;
  currentCategory?: string;
  currentTag?: string;
  currentStatus?: string;
  currentSearch?: string;
  currentTimeRange?: string;
  categories: ProjectCategoryItem[];
}

export function ProjectsDiscoveryBar({
  currentView,
  currentCategory,
  currentTag,
  currentStatus,
  currentSearch,
  currentTimeRange,
  categories,
}: ProjectsDiscoveryBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState(currentSearch || '');

  const updateFilters = (newParams: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // Reset to page 1 on filter changes

    for (const [key, value] of Object.entries(newParams)) {
      if (value === null || value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    startTransition(() => {
      router.push(`/projects?${params.toString()}`, { scroll: false });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchTerm.trim() || null });
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    updateFilters({ search: null });
  };

  const viewTabs = [
    { id: 'explore', label: 'Explore', icon: Sparkles },
    { id: 'trending', label: 'Trending', icon: Flame },
    { id: 'most_liked', label: 'Most Liked', icon: ThumbsUp },
    { id: 'recent', label: 'Recently Added', icon: Clock },
  ];

  return (
    <div style={{ marginBottom: '40px' }} className="space-y-6">
      {/* Controls Row: View Tabs + Search */}
      <div className="me-controls-row">
        {/* Navigation Tabs */}
        <div className="me-tabs-group">
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const active = currentView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => updateFilters({ view: tab.id })}
                className={`me-tab-btn ${active ? 'active' : ''}`}
                type="button"
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} style={{ position: 'relative', minWidth: '280px', flex: '1', maxWidth: '420px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a0a4b8' }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects, tags, tech..."
            style={{
              width: '100%',
              padding: '10px 36px 10px 38px',
              background: '#0d0e12',
              border: '2px solid rgba(245,245,242,0.25)',
              color: '#F5F5F2',
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              borderRadius: 0,
              outline: 'none',
            }}
            className="focus:border-[#0057FF] transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#a0a4b8',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          )}
        </form>
      </div>

      {/* Most Liked Time-Range Filter */}
      {currentView === 'most_liked' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="me-micro me-micro-blue">TIME RANGE //</span>
          {(['all', 'month', 'week'] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateFilters({ timeRange: t })}
              className={`me-tab-btn ${ (currentTimeRange || 'all') === t ? 'active' : '' }`}
              style={{ padding: '6px 14px', fontSize: '10px' }}
              type="button"
            >
              {t === 'all' ? 'All Time' : t === 'month' ? 'This Month' : 'This Week'}
            </button>
          ))}
        </div>
      )}

      {/* Category Pills & Development Status Dropdown */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        {/* Category Pills Scroll Container */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
          {CONTROLLED_CATEGORIES.map((cat) => {
            const isAll = cat === 'All';
            const isSelected = isAll ? !currentCategory : currentCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => updateFilters({ category: isAll ? null : cat })}
                style={{
                  background: isSelected ? 'var(--bg-paper-white, #F5F5F2)' : 'transparent',
                  color: isSelected ? '#000000' : '#a0a4b8',
                  border: isSelected ? '2px solid #F5F5F2' : '2px solid rgba(245,245,242,0.25)',
                  padding: '8px 16px',
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  borderRadius: 0,
                  transition: 'all 0.15s ease',
                }}
                className="hover:border-white hover:text-white"
                type="button"
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Development Status Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <Filter size={14} style={{ color: '#a0a4b8' }} />
          <select
            value={currentStatus || ''}
            onChange={(e) => updateFilters({ status: e.target.value || null })}
            style={{
              background: '#0d0e12',
              border: '2px solid rgba(245,245,242,0.25)',
              color: '#F5F5F2',
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              padding: '8px 14px',
              borderRadius: 0,
              outline: 'none',
              cursor: 'pointer',
            }}
            className="focus:border-[#0057FF] transition-colors"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: '#050505', color: '#F5F5F2' }}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
