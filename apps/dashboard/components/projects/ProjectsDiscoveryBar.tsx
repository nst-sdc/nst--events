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
        <div className="me-tabs-group w-full md:w-auto">
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
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-auto md:min-w-[280px] md:max-w-[420px] flex-1 min-w-0">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-[#a0a4b8]"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects, tags, tech..."
            className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-[#0d0e12] border-2 border-black/20 dark:border-white/25 text-zinc-950 dark:text-[#F5F5F2] font-mono text-[11px] font-bold uppercase tracking-wider rounded-none outline-none focus:border-[#0057FF] transition-colors placeholder:text-zinc-500 dark:placeholder:text-[#a0a4b8] min-h-[42px] touch-manipulation"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 text-zinc-500 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white cursor-pointer p-0"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </form>
      </div>

      {/* Most Liked Time-Range Filter */}
      {currentView === 'most_liked' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="me-micro me-micro-blue">TIME RANGE //</span>
          {(['all', 'month', 'week'] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateFilters({ timeRange: t })}
              className={`me-tab-btn ${(currentTimeRange || 'all') === t ? 'active' : ''}`}
              style={{ padding: '6px 14px', fontSize: '10px' }}
              type="button"
            >
              {t === 'all' ? 'All Time' : t === 'month' ? 'This Month' : 'This Week'}
            </button>
          ))}
        </div>
      )}

      {/* Category Pills & Development Status Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
        {/* Category Pills Scroll Container */}
        <div
          className="flex gap-2 overflow-x-auto overscroll-x-contain touch-pan-x pb-1 no-scrollbar w-full min-w-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {CONTROLLED_CATEGORIES.map((cat) => {
            const isAll = cat === 'All';
            const isSelected = isAll ? !currentCategory : currentCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => updateFilters({ category: isAll ? null : cat })}
                className={`transition-all duration-150 uppercase tracking-wider font-mono text-[11px] font-bold px-4 py-2 border-2 cursor-pointer whitespace-nowrap rounded-none shrink-0 min-h-[40px] touch-manipulation ${
                  isSelected
                    ? 'bg-black text-white border-black dark:bg-[#F5F5F2] dark:text-black dark:border-[#F5F5F2] shadow-[3px_3px_0px_#0057FF]'
                    : 'bg-transparent text-zinc-600 dark:text-[#a0a4b8] border-black/20 dark:border-white/25 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white'
                }`}
                type="button"
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Development Status Filter Dropdown */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
          <Filter size={14} className="text-zinc-500 dark:text-[#a0a4b8] shrink-0" />
          <select
            aria-label="Filter by development status"
            value={currentStatus || ''}
            onChange={(e) => updateFilters({ status: e.target.value || null })}
            className="bg-white dark:bg-[#0d0e12] border-2 border-black/20 dark:border-white/25 text-zinc-950 dark:text-[#F5F5F2] font-mono text-[11px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-none outline-none cursor-pointer focus:border-[#0057FF] transition-colors min-h-[40px] touch-manipulation"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#050505] text-zinc-950 dark:text-[#F5F5F2]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
