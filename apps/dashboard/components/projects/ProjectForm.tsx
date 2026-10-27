'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Link as LinkIcon,
  Code2,
  AlertCircle,
  ExternalLink,
  GitBranch,
  Video,
  BookOpen,
  CheckCircle2,
  Eye,
  Save,
  Plus,
  X,
} from 'lucide-react';
import { projectsApi, ProjectDetail, ProjectLinkItem } from '@/lib/projects-api';
import { getWebAuthStore } from '@/lib/auth-store';
import { MarkdownEditor } from './MarkdownEditor';

export const CONTROLLED_CATEGORIES = [
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

export const PROJECT_TYPES = [
  { value: 'PERSONAL', label: 'Personal Project' },
  { value: 'COURSEWORK', label: 'Permitted Coursework' },
  { value: 'HACKATHON', label: 'Hackathon Project' },
  { value: 'OPEN_SOURCE', label: 'Open Source' },
  { value: 'RESEARCH', label: 'Academic / Technical Research' },
  { value: 'HARDWARE', label: 'Hardware Prototype' },
  { value: 'DESIGN', label: 'Design & UI/UX' },
  { value: 'CASE_STUDY', label: 'Technical Case Study' },
];

export const STATUSES = [
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PROTOTYPE', label: 'Prototype' },
  { value: 'LIVE', label: 'Live / Usable' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'IDEA', label: 'Idea / Concept' },
  { value: 'ARCHIVED', label: 'Archived' },
];

interface ProjectFormProps {
  mode: 'create' | 'edit';
  initialData?: ProjectDetail;
  onSuccess?: (project: ProjectDetail) => void;
}

export function ProjectForm({ mode, initialData, onSuccess }: ProjectFormProps) {
  const router = useRouter();
  const authStore = getWebAuthStore();

  const isEdit = mode === 'edit';

  // Extract initial link values
  const initDemoLink = initialData?.links?.find((l) => l.type === 'DEMO')?.url || '';
  const initRepoLink = initialData?.links?.find((l) => l.type === 'REPOSITORY')?.url || '';
  const initVideoLink = initialData?.links?.find((l) => l.type === 'VIDEO')?.url || '';
  const initDocLink = initialData?.links?.find((l) => l.type === 'DOCUMENTATION')?.url || '';

  // Core Form State
  const [title, setTitle] = useState(initialData?.title || '');
  const [tagline, setTagline] = useState(initialData?.tagline || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState(initialData?.category || CONTROLLED_CATEGORIES[0]);
  const [coverImageUrl, setCoverImageUrl] = useState(initialData?.cover_image_url || '');
  const [galleryImageUrls, setGalleryImageUrls] = useState<string[]>(initialData?.gallery_image_urls || []);
  const [screenshotInput, setScreenshotInput] = useState('');
  const [projectType, setProjectType] = useState(initialData?.project_type || 'PERSONAL');
  const [developmentStatus, setDevelopmentStatus] = useState(initialData?.development_status || 'IN_PROGRESS');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [customSlug, setCustomSlug] = useState(initialData?.slug || '');

  const handleAddScreenshot = () => {
    const trimmed = screenshotInput.trim();
    if (!trimmed) return;
    if (!validateUrl(trimmed)) {
      setError('Screenshot URL must start with http:// or https://');
      return;
    }
    if (galleryImageUrls.includes(trimmed)) {
      setError('This screenshot URL has already been added.');
      return;
    }
    if (galleryImageUrls.length >= 6) {
      setError('You can add up to 6 screenshots.');
      return;
    }
    setGalleryImageUrls([...galleryImageUrls, trimmed]);
    setScreenshotInput('');
    setError(null);
  };

  const handleRemoveScreenshot = (idx: number) => {
    setGalleryImageUrls(galleryImageUrls.filter((_, i) => i !== idx));
  };

  // Deep Technical Dive
  const [problemStatement, setProblemStatement] = useState(initialData?.problem_statement || '');
  const [solution, setSolution] = useState(initialData?.solution || '');
  const [implementationDetails, setImplementationDetails] = useState(initialData?.implementation_details || '');
  const [personalContribution, setPersonalContribution] = useState(initialData?.personal_contribution || '');
  const [whatsNext, setWhatsNext] = useState(initialData?.whats_next || '');

  // Showcase Artifacts
  const [demoUrl, setDemoUrl] = useState(initDemoLink);
  const [repoUrl, setRepoUrl] = useState(initRepoLink);
  const [videoUrl, setVideoUrl] = useState(initVideoLink);
  const [docUrl, setDocUrl] = useState(initDocLink);

  // Publication & Confirmation
  const [rightsConfirmed, setRightsConfirmed] = useState(initialData?.visibility === 'PUBLISHED');

  // Async Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val) && tags.length < 12) {
        setTags([...tags, val]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const buildLinksPayload = (): ProjectLinkItem[] => {
    const links: ProjectLinkItem[] = [];
    if (demoUrl.trim()) {
      links.push({ type: 'DEMO', url: demoUrl.trim(), label: 'Live Demo', order: 0 });
    }
    if (repoUrl.trim()) {
      links.push({ type: 'REPOSITORY', url: repoUrl.trim(), label: 'Source Code', order: 1 });
    }
    if (videoUrl.trim()) {
      links.push({ type: 'VIDEO', url: videoUrl.trim(), label: 'Video Showcase', order: 2 });
    }
    if (docUrl.trim()) {
      links.push({ type: 'DOCUMENTATION', url: docUrl.trim(), label: 'Documentation', order: 3 });
    }
    return links;
  };

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToSection = (sectionId: string) => {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const validateUrl = (url: string) => {
    if (!url) return true;
    return /^https?:\/\//i.test(url.trim());
  };

  const handleSubmit = async (publishNow?: boolean) => {
    if (!authStore.accessToken) {
      setError('You must sign in with your verified institutional student account (@adypu.edu.in or @newtonschool.co) to save project changes.');
      scrollToTop();
      return;
    }

    if (!title.trim() || !tagline.trim() || !description.trim()) {
      setError('Please fill in the project title, tagline, and description.');
      scrollToTop();
      return;
    }

    if (title.trim().length < 3) {
      setError('Project title must be at least 3 characters.');
      scrollToTop();
      return;
    }

    if (tagline.trim().length < 5) {
      setError('Tagline must be at least 5 characters.');
      scrollToTop();
      return;
    }

    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters.');
      scrollToTop();
      return;
    }

    if (!coverImageUrl.trim() || !validateUrl(coverImageUrl)) {
      setError('A valid cover image URL starting with http:// or https:// is required.');
      scrollToTop();
      return;
    }

    if (demoUrl && !validateUrl(demoUrl)) {
      setError('Live Demo URL must start with http:// or https://');
      scrollToTop();
      return;
    }
    if (repoUrl && !validateUrl(repoUrl)) {
      setError('Source Code Repository URL must start with http:// or https://');
      scrollToTop();
      return;
    }
    if (videoUrl && !validateUrl(videoUrl)) {
      setError('Video Showcase URL must start with http:// or https://');
      scrollToTop();
      return;
    }
    if (docUrl && !validateUrl(docUrl)) {
      setError('Documentation URL must start with http:// or https://');
      scrollToTop();
      return;
    }

    for (const imgUrl of galleryImageUrls) {
      if (!validateUrl(imgUrl)) {
        setError('All screenshot URLs must start with http:// or https://');
        scrollToTop();
        return;
      }
    }

    const links = buildLinksPayload();

    // Determine target visibility
    const isTargetingPublish = publishNow !== undefined ? publishNow : initialData?.visibility === 'PUBLISHED';

    if (isTargetingPublish) {
      if (!rightsConfirmed) {
        setError('You must confirm that you have the rights to publish this project.');
        scrollToTop();
        return;
      }
      if (links.length === 0) {
        setError('At least one public showcase artifact (Demo, GitHub, Video, Documentation) is required before publishing.');
        scrollToTop();
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const payload: any = {
      title: title.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      category,
      coverImageUrl: coverImageUrl.trim(),
      galleryImageUrls: galleryImageUrls.filter((u) => u.trim().length > 0),
      projectType,
      developmentStatus,
      tags,
      problemStatement: problemStatement.trim() || undefined,
      solution: solution.trim() || undefined,
      implementationDetails: implementationDetails.trim() || undefined,
      personalContribution: personalContribution.trim() || undefined,
      whatsNext: whatsNext.trim() || undefined,
      links,
      customSlug: customSlug.trim() || undefined,
      rightsConfirmed,
    };

    if (publishNow !== undefined) {
      payload.publishNow = publishNow;
    }

    try {
      let savedProject: ProjectDetail;
      if (isEdit && initialData) {
        savedProject = await projectsApi.update(initialData.id, payload);
        setSuccessMsg('Project updated successfully!');
      } else {
        savedProject = await projectsApi.create(payload);
        setSuccessMsg('Project created successfully!');
      }

      if (onSuccess) {
        onSuccess(savedProject);
      } else {
        setTimeout(() => {
          if (savedProject.visibility === 'PUBLISHED' || publishNow) {
            router.push(`/projects/${savedProject.slug}`);
          } else {
            router.push('/my/projects');
          }
        }, 600);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save project. Please check your inputs and try again.');
      setIsSubmitting(false);
      scrollToTop();
    }
  };

  return (
    <div className="space-y-8">
      {/* Current Visibility Badge if in Edit mode */}
      {isEdit && initialData && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider border ${
                initialData.visibility === 'PUBLISHED'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : initialData.visibility === 'DRAFT'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              STATUS: {initialData.visibility}
            </span>
            <span className="text-xs font-mono text-zinc-400">
              /projects/{initialData.slug}
            </span>
          </div>
          <Link
            href={`/projects/${initialData.slug}`}
            target="_blank"
            className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>VIEW LIVE</span>
          </Link>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs font-mono leading-relaxed">
            <span className="font-bold">Validation Error:</span> {error}
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMsg && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs font-mono leading-relaxed font-bold">
            {successMsg}
          </div>
        </div>
      )}

      {/* Sticky Section Quick Navigation Bar */}
      <nav
        aria-label="Form section navigation"
        className="sticky top-16 z-20 -mx-2 px-2 sm:mx-0 sm:px-0 py-2.5 bg-zinc-950/95 backdrop-blur-md border border-zinc-800/80 rounded-xl mb-6 shadow-xl shadow-black/60"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-mono py-0.5">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider pl-1.5 pr-1 shrink-0">
            JUMP TO:
          </span>
          <button
            type="button"
            onClick={() => scrollToSection('section-essentials')}
            className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-all border border-zinc-800 hover:border-zinc-700"
          >
            1. Essentials
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-breakdown')}
            className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-all border border-zinc-800 hover:border-zinc-700"
          >
            2. Tech Depth
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-tech-stack')}
            className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-all border border-zinc-800 hover:border-zinc-700"
          >
            3. Tech Stack
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-showcase')}
            className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-all border border-zinc-800 hover:border-zinc-700"
          >
            4. Artifacts
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-slug')}
            className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-all border border-zinc-800 hover:border-zinc-700"
          >
            5. Slug
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('section-publish')}
            className="px-2.5 py-1 rounded-md bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 shrink-0 transition-all border border-blue-500/30 font-bold"
          >
            6. Publish
          </button>
        </div>
      </nav>

      {/* Step 1: Core Essentials */}
      <section
        id="section-essentials"
        className="scroll-mt-28 p-6 sm:p-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm space-y-6"
      >
        <div className="border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#0057FF]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>1. CORE ESSENTIALS</span>
          </div>
          <h2 className="text-lg font-black uppercase text-white mt-1">Project Identity & Basics</h2>
          <p className="text-xs text-zinc-400 mt-0.5">High-impact summary visible in exploration cards and search listings.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-zinc-300 mb-1.5 font-bold">
              Project Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Campus Transit Tracker"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans"
              maxLength={120}
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-zinc-300 mb-1.5 font-bold">
              One-Sentence Elevator Pitch / Tagline *
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g., Real-time GPS transit tracking and occupancy forecasting for campus shuttles."
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans"
              maxLength={160}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-300 mb-1.5 font-bold">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all font-sans cursor-pointer"
              >
                {CONTROLLED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-zinc-950 text-white">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-300 mb-1.5 font-bold">
                Project Type *
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all font-sans cursor-pointer"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-zinc-950 text-white">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-300 mb-1.5 font-bold">
                Development Status *
              </label>
              <select
                value={developmentStatus}
                onChange={(e) => setDevelopmentStatus(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all font-sans cursor-pointer"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value} className="bg-zinc-950 text-white">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-300 mb-1.5 font-bold">
                Cover Image URL *
              </label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans"
              />
            </div>
          </div>

          {/* Gallery / Product Screenshots */}
          <div className="pt-2 pb-1 border-t border-zinc-900/80">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-mono uppercase text-zinc-300 font-bold">
                Product Screenshots & Visual Demos (Optional, Up to 6)
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                {galleryImageUrls.length}/6 added
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              Add direct image URLs to showcase UI flows, architecture diagrams, or live app screens. Displayed in an interactive carousel and lightbox on your project case study.
            </p>

            <div className="flex gap-2">
              <input
                type="url"
                value={screenshotInput}
                onChange={(e) => setScreenshotInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddScreenshot();
                  }
                }}
                placeholder="https://cdn.mysite.com/ui-preview.png or cloud storage URL"
                disabled={galleryImageUrls.length >= 6}
                aria-label="Screenshot URL input"
                className="flex-1 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-xs outline-none transition-all placeholder:text-zinc-600 font-mono disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddScreenshot}
                disabled={galleryImageUrls.length >= 6 || !screenshotInput.trim()}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-xs font-mono font-bold text-white transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Image</span>
              </button>
            </div>

            {galleryImageUrls.length > 0 && (
              <div className="mt-3 space-y-2">
                {galleryImageUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-xs text-zinc-300 font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <ImageIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{url}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveScreenshot(idx)}
                      className="p-1 hover:text-rose-400 text-zinc-500 transition-colors shrink-0"
                      aria-label={`Remove screenshot ${idx + 1}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <MarkdownEditor
              value={description}
              onChange={(val) => setDescription(val)}
              placeholder="Describe the motivation, capabilities, architecture, and significance of this project..."
              label="Comprehensive Overview / Description"
              required
              minHeight="320px"
              id="project-form-description"
            />
          </div>
        </div>
      </section>

      {/* Step 2: Deep Technical Breakdown */}
      <section
        id="section-breakdown"
        className="scroll-mt-28 p-6 sm:p-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm space-y-6"
      >
        <div className="border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
            <Layers className="w-3.5 h-3.5" />
            <span>2. DEEP TECHNICAL BREAKDOWN</span>
          </div>
          <h2 className="text-lg font-black uppercase text-white mt-1">Engineering Depth & Impact</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Structured details highlighted on your project dossier for recruiters and mentors.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-zinc-300 mb-1 font-bold">
              Problem Statement
            </label>
            <textarea
              rows={2}
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              placeholder="What friction, constraint, or inefficiency does this project address?"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-zinc-300 mb-1 font-bold">
              Proposed Solution & System Architecture
            </label>
            <textarea
              rows={2}
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="How does your design and software model solve the stated problem?"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-zinc-300 mb-1 font-bold">
              Implementation Details & Algorithms
            </label>
            <textarea
              rows={3}
              value={implementationDetails}
              onChange={(e) => setImplementationDetails(e.target.value)}
              placeholder="Key design choices, database schema models, concurrency mechanisms, or API protocols..."
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-300 mb-1 font-bold">
                Personal Contribution
              </label>
              <textarea
                rows={2}
                value={personalContribution}
                onChange={(e) => setPersonalContribution(e.target.value)}
                placeholder="What specific modules did you lead or author?"
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-300 mb-1 font-bold">
                What&apos;s Next / Roadmap
              </label>
              <textarea
                rows={2}
                value={whatsNext}
                onChange={(e) => setWhatsNext(e.target.value)}
                placeholder="Future optimizations, planned features, scaling targets..."
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans resize-y"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Step 3: Technologies & Tags */}
      <section
        id="section-tech-stack"
        className="scroll-mt-28 p-6 sm:p-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm space-y-6"
      >
        <div className="border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            <Code2 className="w-3.5 h-3.5" />
            <span>3. TECH STACK & TAGS</span>
          </div>
          <h2 className="text-lg font-black uppercase text-white mt-1">Skills & Keywords</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Add technologies used (e.g. Next.js, PyTorch, Rust). Press Enter or Comma to add.</p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="Type technology and press Enter (e.g. WebSockets, Redis)"
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans"
          />

          <div className="flex flex-wrap gap-2 pt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-semibold bg-zinc-900 border border-zinc-800 text-zinc-200"
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-zinc-500 hover:text-rose-400 ml-1 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Step 4: Showcase Links & Proof of Work */}
      <section
        id="section-showcase"
        className="scroll-mt-28 p-6 sm:p-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm space-y-6"
      >
        <div className="border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
            <LinkIcon className="w-3.5 h-3.5" />
            <span>4. SHOWCASE ARTIFACTS</span>
          </div>
          <h2 className="text-lg font-black uppercase text-white mt-1">Proof of Work & Demonstration</h2>
          <p className="text-xs text-zinc-400 mt-0.5">At least one public link is required to publish this project.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-zinc-300 mb-1.5 font-bold">
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span>Live Interactive Demo</span>
            </label>
            <input
              type="url"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://myproject.live"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-zinc-300 mb-1.5 font-bold">
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
              <span>Source Code (GitHub / GitLab)</span>
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/project"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-zinc-300 mb-1.5 font-bold">
              <Video className="w-3.5 h-3.5 text-rose-400" />
              <span>Video Demonstration (YouTube / Loom)</span>
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-zinc-300 mb-1.5 font-bold">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Documentation / Paper</span>
            </label>
            <input
              type="url"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://docs.myproject.io"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#0057FF] text-white text-sm outline-none transition-all placeholder:text-zinc-600 font-sans"
            />
          </div>
        </div>
      </section>

      {/* Step 5: Custom URL Slug */}
      <section
        id="section-slug"
        className="scroll-mt-28 p-6 sm:p-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm space-y-4"
      >
        <div className="border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-purple-400">
            <LinkIcon className="w-3.5 h-3.5" />
            <span>5. PERMANENT CANONICAL URL</span>
          </div>
          <h2 className="text-lg font-black uppercase text-white mt-1">Project Slug</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Custom URL identifier. {isEdit ? 'Changing the slug automatically establishes permanent 301 redirects from your prior handle.' : 'Leave blank to generate automatically from title.'}
          </p>
        </div>

        <div>
          <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 focus-within:border-[#0057FF] overflow-hidden px-3">
            <span className="text-xs font-mono text-zinc-500 select-none">/projects/</span>
            <input
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="campus-transit-tracker"
              className="w-full py-2.5 px-1 bg-transparent text-white text-sm outline-none font-mono placeholder:text-zinc-600"
            />
          </div>
        </div>
      </section>

      {/* Step 6: Confirmation & Actions */}
      <section
        id="section-publish"
        className="scroll-mt-28 p-6 sm:p-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm space-y-6"
      >
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(e) => setRightsConfirmed(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#0057FF] focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-xs text-zinc-300 leading-relaxed font-sans">
            I confirm that I am the author or an authorized contributor to this project, and that this submission contains no academic dishonesty or unauthorized intellectual property.
          </span>
        </label>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-900">
          <Link
            href={isEdit && initialData ? `/projects/${initialData.slug}` : '/my/projects'}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors text-center"
          >
            Cancel
          </Link>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* If in edit mode and currently published, button to save changes and keep published */}
            {isEdit ? (
              <>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </button>

                {initialData?.visibility !== 'PUBLISHED' && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit(true)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Publishing...' : 'Save & Publish'}</span>
                  </button>
                )}
              </>
            ) : (
              /* Create Mode */
              <>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-white transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Draft'}
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-[#0057FF] hover:bg-[#0047D4] text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Publishing...' : 'Publish Project'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
