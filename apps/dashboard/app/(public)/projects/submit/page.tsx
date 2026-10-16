'use client';
import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { projectsApi, ProjectLinkItem } from '@/lib/projects-api';
import { getWebAuthStore } from '@/lib/auth-store';
import { refreshToken } from '@/lib/api';
import { StudentAppShell } from '@/components/layout/StudentAppShell';
import { ClubAdminProvider } from '@/components/layout/ClubAdminProvider';

const CATEGORIES = [
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

const PROJECT_TYPES = [
  { value: 'PERSONAL', label: 'Personal Project' },
  { value: 'COURSEWORK', label: 'Permitted Coursework' },
  { value: 'HACKATHON', label: 'Hackathon Project' },
  { value: 'OPEN_SOURCE', label: 'Open Source' },
  { value: 'RESEARCH', label: 'Academic / Technical Research' },
  { value: 'HARDWARE', label: 'Hardware Prototype' },
  { value: 'DESIGN', label: 'Design & UI/UX' },
  { value: 'CASE_STUDY', label: 'Technical Case Study' },
];

const STATUSES = [
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PROTOTYPE', label: 'Prototype' },
  { value: 'LIVE', label: 'Live / Usable' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'IDEA', label: 'Idea / Concept' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default function SubmitProjectPage() {
  const router = useRouter();
  const authStore = getWebAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(!authStore.accessToken);

  useEffect(() => {
    const checkAuth = async () => {
      if (!authStore.accessToken) {
        try {
          const res = await refreshToken();
          if (res.status === 'SUCCESS') {
            authStore.setAccessToken(res.token);
            setIsCheckingAuth(false);
            return;
          }
        } catch {
          // Token refresh failed
        }
        router.push('/login?return_to=/projects/submit');
        return;
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router, authStore]);

  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [projectType, setProjectType] = useState('PERSONAL');
  const [developmentStatus, setDevelopmentStatus] = useState('IN_PROGRESS');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customSlug, setCustomSlug] = useState('');

  // Structured Information
  const [problemStatement, setProblemStatement] = useState('');
  const [solution, setSolution] = useState('');
  const [implementationDetails, setImplementationDetails] = useState('');
  const [personalContribution, setPersonalContribution] = useState('');
  const [whatsNext, setWhatsNext] = useState('');

  // Showcase Links
  const [demoUrl, setDemoUrl] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [docUrl, setDocUrl] = useState('');

  // Rights Confirmation
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (publishNow: boolean) => {
    if (!authStore.accessToken) {
      setError('You must sign in with your verified institutional student account (@adypu.edu.in or @newtonschool.co) to submit a project.');
      return;
    }

    if (!title.trim() || !tagline.trim() || !description.trim()) {
      setError('Please fill in the project title, tagline, and description.');
      return;
    }

    if (!coverImageUrl.trim()) {
      setError('A valid cover image URL is required.');
      return;
    }

    const links = buildLinksPayload();

    if (publishNow) {
      if (!rightsConfirmed) {
        setError('You must confirm that you have the right to publish this project.');
        return;
      }
      if (links.length === 0) {
        setError('At least one public showcase artifact (Demo, GitHub, Video, Documentation) is required before publishing.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      title: title.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      category,
      coverImageUrl: coverImageUrl.trim(),
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
      publishNow,
      rightsConfirmed,
    };

    try {
      const res = await projectsApi.create(payload);
      if (publishNow) {
        router.push(`/projects/${res.slug}`);
      } else {
        router.push('/my/projects');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit project. Please verify inputs.');
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono text-xs text-zinc-400">
        <div className="animate-pulse flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0057FF]" />
          <span>Verifying student authentication...</span>
        </div>
      </div>
    );
  }

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        <div className="min-h-screen bg-[#050505] text-[#F5F5F2] font-sans relative selection:bg-[#0057FF] selection:text-white">
          {/* Background Dot Texture */}
          <div
            className="fixed inset-0 pointer-events-none z-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(rgba(245, 245, 242, 0.15) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Form Container */}
          <main className="relative z-10 max-w-4xl mx-auto px-6 py-10">
            {/* Sub-Navigation Breadcrumb */}
            <div className="flex items-center justify-between border-b border-[#F5F5F2]/20 pb-4 mb-8">
              <Link
                href="/projects"
                className="flex items-center space-x-2 text-[#a0a4b8] hover:text-[#0057FF] font-['JetBrains_Mono',monospace] text-xs uppercase tracking-wider transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ALL PROJECTS</span>
              </Link>
              <div className="flex items-center gap-4">
                <span className="font-['JetBrains_Mono',monospace] text-xs font-bold text-[#0057FF] uppercase tracking-wider">
                  NEW SHOWCASE
                </span>
                <span className="text-zinc-600">/</span>
                <Link
                  href="/my/projects"
                  className="font-['JetBrains_Mono',monospace] text-xs font-bold text-[#a0a4b8] hover:text-white uppercase tracking-wider transition-colors"
                >
                  MY PROJECTS
                </Link>
              </div>
            </div>
        <div className="mb-8 border-b border-zinc-800/80 pb-6">
          <div className="flex items-center space-x-2 text-xs font-mono text-[#0057FF] tracking-widest uppercase mb-3">
            <Sparkles className="w-4 h-4" />
            <span>SHOWCASE SUBMISSION</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Submit a Project
          </h1>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            Share your work with the world. Submit to the verified NST project directory. You can save a draft at any time and publish when ready.
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
          {/* Section 1: Basics */}
          <section className="p-6 sm:p-8 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-5">
            <div className="border-b border-zinc-800/80 pb-3 flex items-center gap-2 text-white font-bold text-base tracking-tight uppercase">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>1. Basic Information</span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                Project Name *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. CampusTransit GPS Tracker"
                maxLength={120}
                required
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                Short Tagline * (One crisp sentence, max 160 chars)
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Real-time campus bus tracking with sub-second WebSocket telemetry."
                maxLength={160}
                required
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  Primary Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-[#0057FF] transition-colors"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  Custom URL Slug (optional)
                </label>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="e.g. campus-transit-tracker"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                Description / Overview *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Give a thorough overview of what this project does and why you built it..."
                required
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors leading-relaxed"
              />
            </div>
          </section>

          {/* Section 2: Visual Presentation */}
          <section className="p-6 sm:p-8 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-5">
            <div className="border-b border-zinc-800/80 pb-3 flex items-center gap-2 text-white font-bold text-base tracking-tight uppercase">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              <span>2. Presentation & Media</span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                Cover Image URL * (Direct https image link)
              </label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                required
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors"
              />
            </div>

            {/* Live Cover Preview */}
            {coverImageUrl && (
              <div className="mt-3">
                <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-1.5">
                  Preview:
                </span>
                <div className="relative aspect-[16/9] max-w-sm overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800">
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Section 3: Showcase Artifacts / Links */}
          <section className="p-6 sm:p-8 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-5">
            <div className="border-b border-zinc-800/80 pb-3 flex items-center justify-between text-white font-bold text-base tracking-tight uppercase">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-emerald-400" />
                <span>3. Showcase Artifacts</span>
              </div>
              <span className="text-xs font-mono text-zinc-400 font-normal">
                At least 1 required to publish
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Live Demo URL</span>
                </label>
                <input
                  type="url"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  placeholder="https://myproject.live"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-white" />
                  <span>Repository (GitHub / GitLab)</span>
                </label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  <Video className="w-3.5 h-3.5 text-rose-400" />
                  <span>Video Walkthrough (YouTube / Loom)</span>
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                  <span>Documentation URL</span>
                </label>
                <input
                  type="url"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://docs.myproject.org"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Technologies & Context */}
          <section className="p-6 sm:p-8 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-5">
            <div className="border-b border-zinc-800/80 pb-3 flex items-center gap-2 text-white font-bold text-base tracking-tight uppercase">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span>4. Technical Details & Story</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  Project Type
                </label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-[#0057FF] transition-colors"
                >
                  {PROJECT_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  Development Status
                </label>
                <select
                  value={developmentStatus}
                  onChange={(e) => setDevelopmentStatus(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-[#0057FF] transition-colors"
                >
                  {STATUSES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags Input */}
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                Technology & Topic Tags (Type and press Enter or comma)
              </label>
              <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800 min-h-[42px]">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-zinc-500 hover:text-white"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                {tags.length < 12 && (
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder={tags.length === 0 ? 'e.g. Next.js, PyTorch, Docker' : 'Add tag...'}
                    className="flex-1 bg-transparent border-none text-xs text-white placeholder-zinc-500 focus:outline-none min-w-[120px]"
                  />
                )}
              </div>
            </div>

            {/* Structured problem & solution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  Problem Statement (optional)
                </label>
                <textarea
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  rows={3}
                  placeholder="What specific issue or friction does this solve?"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                  The Solution (optional)
                </label>
                <textarea
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  rows={3}
                  placeholder="How does your project uniquely solve this?"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors leading-relaxed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
                Technical Implementation & Key Architectural Decisions (optional)
              </label>
              <textarea
                value={implementationDetails}
                onChange={(e) => setImplementationDetails(e.target.value)}
                rows={4}
                placeholder="Database choices, protocols, challenges overcome, algorithms used..."
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#0057FF] transition-colors leading-relaxed"
              />
            </div>
          </section>

          {/* Section 5: Rights Confirmation & Consent */}
          <section className="p-6 sm:p-8 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-[#0057FF] focus:ring-0"
              />
              <span className="text-xs text-zinc-300 leading-relaxed font-sans">
                <strong className="text-white">Publishing Rights Confirmation:</strong> I confirm that I hold the ownership rights to publish this project and its associated artifacts. Publishing grants NST Projects permission to showcase and display this work publicly. I retain full ownership of my project.
              </span>
            </label>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-zinc-800/80">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(false)}
              className="w-full sm:w-auto px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save As Draft'}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(true)}
              className="w-full sm:w-auto px-8 py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-[#0057FF] hover:bg-blue-600 text-white transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Publishing...' : 'Publish to Showcase'}
            </button>
          </div>
        </form>
          </main>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
