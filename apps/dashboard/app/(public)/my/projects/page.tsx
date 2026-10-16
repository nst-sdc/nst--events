'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  FolderHeart,
  Heart,
  Eye,
  Trash2,
  Users,
  Link2,
  ExternalLink,
  X,
  ArrowLeft,
} from 'lucide-react';
import { projectsApi, MyProjectsResponse, ProjectDetail } from '@/lib/projects-api';
import { getWebAuthStore } from '@/lib/auth-store';
import { refreshToken } from '@/lib/api';
import { NstLogoMark } from '@/components/brand/NstLogo';
import { StudentAppShell } from '@/components/layout/StudentAppShell';
import { ClubAdminProvider } from '@/components/layout/ClubAdminProvider';

export default function MyProjectsDashboardPage() {
  const router = useRouter();
  const authStore = getWebAuthStore();

  const [data, setData] = useState<MyProjectsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'published' | 'draft' | 'unpublished' | 'contributing'>('all');

  // Modal States
  const [slugModalProject, setSlugModalProject] = useState<ProjectDetail | null>(null);
  const [newSlug, setNewSlug] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);

  const [inviteModalProject, setInviteModalProject] = useState<ProjectDetail | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const [deleteModalProject, setDeleteModalProject] = useState<ProjectDetail | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await projectsApi.getMyProjects();
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (!authStore.accessToken) {
        try {
          const res = await refreshToken();
          if (res.status === 'SUCCESS') {
            authStore.setAccessToken(res.token);
            loadData();
            return;
          }
        } catch {
          // Token refresh failed
        }
        router.push('/login?return_to=/my/projects');
        return;
      }
      loadData();
    };

    bootstrap();
  }, []);

  const handleTogglePublish = async (project: ProjectDetail) => {
    try {
      if (project.visibility === 'PUBLISHED') {
        await projectsApi.unpublish(project.id);
      } else {
        await projectsApi.publish(project.id, true);
      }
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleChangeSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slugModalProject) return;
    setSlugError(null);

    try {
      await projectsApi.changeSlug(slugModalProject.id, newSlug);
      setSlugModalProject(null);
      setNewSlug('');
      await loadData();
    } catch (err: unknown) {
      setSlugError(err instanceof Error ? err.message : 'Failed to update slug');
    }
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteModalProject) return;
    setInviteMsg(null);

    try {
      await projectsApi.inviteContributor(inviteModalProject.id, inviteEmail, inviteRole);
      setInviteMsg('Collaborator invitation sent successfully.');
      setInviteEmail('');
      setInviteRole('');
      setTimeout(() => {
        setInviteModalProject(null);
        setInviteMsg(null);
        loadData();
      }, 1500);
    } catch (err: unknown) {
      setInviteMsg(`Error: ${err instanceof Error ? err.message : 'Failed to send invitation'}`);
    }
  };

  const handleRespondInvitation = async (contributorId: string, status: 'ACCEPTED' | 'DECLINED') => {
    try {
      await projectsApi.respondContributor(contributorId, status);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to respond to invitation');
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteModalProject) return;
    try {
      await projectsApi.delete(deleteModalProject.id);
      setDeleteModalProject(null);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const ownedProjects: MyProjectsResponse['owned'] = data?.owned || [];
  const contributingProjects: MyProjectsResponse['contributing'] = data?.contributing || [];

  const filteredOwned = ownedProjects.filter((p: MyProjectsResponse['owned'][number]) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'published') return p.visibility === 'PUBLISHED';
    if (activeTab === 'draft') return p.visibility === 'DRAFT';
    if (activeTab === 'unpublished') return p.visibility === 'UNPUBLISHED';
    return false;
  });

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-[#0057FF] selection:text-white">
          {/* Background Dot Texture */}
          <div 
            className="pointer-events-none fixed inset-0 opacity-[0.03]" 
            style={{ 
              backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)', 
              backgroundSize: '24px 24px' 
            }} 
          />

          {/* Main Container */}
          <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
                  CREATOR DASHBOARD
                </span>
                <span className="text-zinc-600">/</span>
                <Link
                  href="/projects/submit"
                  className="font-['JetBrains_Mono',monospace] text-xs font-bold text-[#a0a4b8] hover:text-white uppercase tracking-wider transition-colors"
                >
                  SUBMIT A PROJECT
                </Link>
              </div>
            </div>
        {/* Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
              <FolderHeart className="w-3.5 h-3.5" />
              <span>Student Creator Dashboard</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              My Projects
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5">
              Manage your showcase submissions, track audience engagement, and coordinate peer contributors.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300 font-mono">
            {error}
          </div>
        )}

        {/* Metrics Grid */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-sm">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Total Projects</div>
              <div className="font-mono text-2xl font-bold text-white mt-1">
                {data.stats.total}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-sm">
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">Published</div>
              <div className="font-mono text-2xl font-bold text-emerald-400 mt-1">
                {data.stats.published}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-sm">
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400">Drafts</div>
              <div className="font-mono text-2xl font-bold text-amber-400 mt-1">
                {data.stats.drafts}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-sm">
              <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">Likes Received</div>
              <div className="font-mono text-2xl font-bold text-rose-400 mt-1 flex items-center gap-1.5">
                <Heart className="w-5 h-5 fill-current" />
                <span>{data.stats.totalLikes}</span>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-sm col-span-2 sm:col-span-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Showcase Views</div>
              <div className="font-mono text-2xl font-bold text-cyan-400 mt-1 flex items-center gap-1.5">
                <Eye className="w-5 h-5" />
                <span>{data.stats.totalViews}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg mb-6 overflow-x-auto no-scrollbar">
          {(['all', 'published', 'draft', 'unpublished', 'contributing'] as const).map((tab) => {
            const count = tab === 'all'
              ? ownedProjects.length
              : tab === 'published'
              ? ownedProjects.filter((p: MyProjectsResponse['owned'][number]) => p.visibility === 'PUBLISHED').length
              : tab === 'draft'
              ? ownedProjects.filter((p: MyProjectsResponse['owned'][number]) => p.visibility === 'DRAFT').length
              : tab === 'unpublished'
              ? ownedProjects.filter((p: MyProjectsResponse['owned'][number]) => p.visibility === 'UNPUBLISHED').length
              : contributingProjects.length;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-zinc-100 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {tab === 'all'
                  ? `All (${count})`
                  : tab === 'published'
                  ? `Published (${count})`
                  : tab === 'draft'
                  ? `Drafts (${count})`
                  : tab === 'unpublished'
                  ? `Unpublished (${count})`
                  : `Collaborations (${count})`}
              </button>
            );
          })}
        </div>

        {/* Projects List */}
        {isLoading ? (
          <div className="py-20 text-center text-zinc-500 font-mono text-xs">
            Loading your projects...
          </div>
        ) : activeTab === 'contributing' ? (
          /* Contributing Tab */
          contributingProjects.length > 0 ? (
            <div className="space-y-4">
              {contributingProjects.map((item: MyProjectsResponse['contributing'][number]) => (
                <div
                  key={item.id}
                  className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {item.role}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                          item.status === 'ACCEPTED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">
                      {item.project?.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{item.project?.tagline}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleRespondInvitation(item.id, 'ACCEPTED')}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespondInvitation(item.id, 'DECLINED')}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {item.project?.slug && (
                      <Link
                        href={`/projects/${item.project.slug}`}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white transition-colors"
                      >
                        View Project
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-zinc-400 text-xs font-mono">
              You have not been added as a collaborator to any other student projects yet.
            </div>
          )
        ) : filteredOwned.length > 0 ? (
          /* Owned Projects List */
          <div className="space-y-4">
            {filteredOwned.map((project: MyProjectsResponse['owned'][number]) => (
              <div
                key={project.id}
                className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900/40 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Project Info */}
                <div className="flex items-start gap-4 min-w-0">
                  {project.cover_image_url ? (
                    <div className="w-24 h-16 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden flex-shrink-0">
                      <img
                        src={project.cover_image_url}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                          project.visibility === 'PUBLISHED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : project.visibility === 'DRAFT'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {project.visibility}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {project.category}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        /projects/{project.slug}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white truncate">
                      {project.title}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5 max-w-xl">
                      {project.tagline}
                    </p>

                    <div className="flex items-center gap-4 mt-2 text-xs font-mono text-zinc-400">
                      <span className="flex items-center gap-1 text-rose-400">
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        <span>{project.like_count} likes</span>
                      </span>
                      <span className="flex items-center gap-1 text-cyan-400">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{project.view_count} views</span>
                      </span>
                      {project.contributors && project.contributors.length > 0 && (
                        <span className="flex items-center gap-1 text-zinc-300">
                          <Users className="w-3.5 h-3.5" />
                          <span>{project.contributors.length} collaborators</span>
                        </span>
                      )}
                    </div>

                    {project.latest_moderation && (
                      <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
                        <span className="font-bold">Moderator Notice ({project.latest_moderation.action}):</span>{' '}
                        {project.latest_moderation.reason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-800/60">
                  {/* View Live / Preview */}
                  <Link
                    href={`/projects/${project.slug}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View</span>
                  </Link>

                  {/* Publish / Unpublish Toggle */}
                  <button
                    onClick={() => handleTogglePublish(project)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors border ${
                      project.visibility === 'PUBLISHED'
                        ? 'bg-zinc-900 hover:bg-zinc-800 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                    }`}
                  >
                    {project.visibility === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                  </button>

                  {/* Change Slug */}
                  <button
                    onClick={() => {
                      setSlugModalProject(project);
                      setNewSlug(project.slug);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                    title="Change Project URL Slug"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Slug</span>
                  </button>

                  {/* Invite Collaborator */}
                  <button
                    onClick={() => {
                      setInviteModalProject(project);
                      setInviteEmail('');
                      setInviteRole('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                    title="Invite Collaborator"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Invite</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDeleteModalProject(project)}
                    className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40">
            <h3 className="text-base font-bold text-white">
              No projects found in this tab
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              You haven&apos;t created any projects matching this filter yet.
            </p>
            <Link
              href="/projects/submit"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider bg-[#0057FF] hover:bg-[#0047D4] text-white shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Your First Project</span>
            </Link>
          </div>
        )}

        {/* Change Slug Modal */}
        {slugModalProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-2xl shadow-2xl relative">
              <button
                onClick={() => setSlugModalProject(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-lg font-extrabold tracking-tight text-white mb-2">
                Change Project Slug
              </h3>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Updating your slug will preserve historical redirects from your old URL directly to the new URL without redirect loops.
              </p>

              {slugError && (
                <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-300">
                  {slugError}
                </div>
              )}

              <form onSubmit={handleChangeSlug} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                    New Slug * (lowercase, numbers, and hyphens)
                  </label>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="my-new-project-slug"
                    required
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setSlugModalProject(null)}
                    className="px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase bg-[#0057FF] hover:bg-[#0047D4] text-white shadow-sm transition-all"
                  >
                    Update Slug
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invite Collaborator Modal */}
        {inviteModalProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-2xl shadow-2xl relative">
              <button
                onClick={() => setInviteModalProject(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-lg font-extrabold tracking-tight text-white mb-2">
                Invite Collaborator
              </h3>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Invite a peer with their institutional email (@adypu.edu.in or @newtonschool.co). They will appear publicly on the project once they accept.
              </p>

              {inviteMsg && (
                <div className="p-3 mb-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs font-mono text-blue-300">
                  {inviteMsg}
                </div>
              )}

              <form onSubmit={handleInviteCollaborator} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                    Institutional Email *
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="peer.name@adypu.edu.in"
                    required
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                    Role Description *
                  </label>
                  <input
                    type="text"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    placeholder="e.g. Frontend Developer, ML Researcher"
                    required
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setInviteModalProject(null)}
                    className="px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase bg-[#0057FF] hover:bg-[#0047D4] text-white shadow-sm transition-all"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-2xl shadow-2xl relative">
              <h3 className="text-base font-extrabold tracking-tight text-white mb-2">
                Delete Project?
              </h3>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">{deleteModalProject.title}</strong>? This will soft-delete the project and remove it from public discovery.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteModalProject(null)}
                  className="px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  className="px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
          </main>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
