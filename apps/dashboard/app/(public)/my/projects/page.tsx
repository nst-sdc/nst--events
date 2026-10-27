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
  Pencil,
  X,
  ArrowLeft,
  UserPlus,
  CheckCircle2,
  Clock,
  AlertCircle,
  LogOut,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  projectsApi,
  MyProjectsResponse,
  ProjectDetail,
  ProjectContributorItem,
} from '@/lib/projects-api';
import { getWebAuthStore } from '@/lib/auth-store';
import { refreshToken } from '@/lib/api';
import { NstLogoMark } from '@/components/brand/NstLogo';
import { StudentAppShell } from '@/components/layout/StudentAppShell';
import { ClubAdminProvider } from '@/components/layout/ClubAdminProvider';
import { MarkdownRenderer } from '@/components/projects/MarkdownRenderer';

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

  // Collaborator Management Modal States
  const [manageTeamProject, setManageTeamProject] = useState<ProjectDetail | null>(null);
  const [teamContributors, setTeamContributors] = useState<ProjectContributorItem[]>([]);
  const [isLoadingContributors, setIsLoadingContributors] = useState(false);
  const [contributorsError, setContributorsError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [revokingContributorId, setRevokingContributorId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [previewMarkdownProject, setPreviewMarkdownProject] = useState<ProjectDetail | null>(null);
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

  const fetchContributors = async (projectId: string) => {
    setIsLoadingContributors(true);
    setContributorsError(null);
    try {
      const list = await projectsApi.listContributors(projectId);
      setTeamContributors(list);
    } catch (err: unknown) {
      setContributorsError(err instanceof Error ? err.message : 'Failed to load collaborators');
    } finally {
      setIsLoadingContributors(false);
    }
  };

  const closeManageTeamModal = () => {
    setManageTeamProject(null);
    setTeamContributors([]);
    setContributorsError(null);
    setInviteError(null);
    setInviteSuccess(null);
  };

  // Sync contributors whenever manageTeamProject modal is opened
  useEffect(() => {
    let ignore = false;
    if (manageTeamProject) {
      projectsApi
        .listContributors(manageTeamProject.id)
        .then((list) => {
          if (!ignore) {
            setTeamContributors(list);
            setIsLoadingContributors(false);
          }
        })
        .catch((err: unknown) => {
          if (!ignore) {
            setContributorsError(err instanceof Error ? err.message : 'Failed to load collaborators');
            setIsLoadingContributors(false);
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [manageTeamProject]);

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
    if (!manageTeamProject || isSendingInvite) return;
    setInviteError(null);
    setInviteSuccess(null);

    const email = inviteEmail.trim().toLowerCase();
    const role = inviteRole.trim();

    if (!email.endsWith('@adypu.edu.in') && !email.endsWith('@newtonschool.co')) {
      setInviteError('Please provide a valid institutional email (@adypu.edu.in or @newtonschool.co)');
      return;
    }

    if (role.length < 2 || role.length > 60) {
      setInviteError('Role description must be between 2 and 60 characters');
      return;
    }

    setIsSendingInvite(true);
    try {
      await projectsApi.inviteContributor(manageTeamProject.id, email, role);
      setInviteSuccess(`Invitation sent for ${email} as "${role}". The recipient can accept it from their dashboard.`);
      setInviteEmail('');
      setInviteRole('');
      // Authoritative refresh of contributors and dashboard projects
      await fetchContributors(manageTeamProject.id);
      loadData();
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleRevokeContributor = async (contributorId: string) => {
    if (!manageTeamProject || revokingContributorId) return;
    setRevokingContributorId(contributorId);
    try {
      await projectsApi.removeContributor(manageTeamProject.id, contributorId);
      await fetchContributors(manageTeamProject.id);
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove collaborator');
    } finally {
      setRevokingContributorId(null);
    }
  };

  const handleRespondInvitation = async (contributorId: string, status: 'ACCEPTED' | 'DECLINED') => {
    if (respondingId) return;
    setRespondingId(contributorId);
    try {
      await projectsApi.respondContributor(contributorId, status);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to respond to invitation');
    } finally {
      setRespondingId(null);
    }
  };

  const handleLeaveProject = async (projectId: string, contributorId: string) => {
    if (respondingId) return;
    if (!confirm('Are you sure you want to leave this project collaboration?')) return;
    setRespondingId(contributorId);
    try {
      await projectsApi.removeContributor(projectId, contributorId);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to leave project');
    } finally {
      setRespondingId(null);
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
                <span className="text-zinc-600">/</span>
                <Link
                  href="/my/profile"
                  className="font-['JetBrains_Mono',monospace] text-xs font-bold text-[#a0a4b8] hover:text-white uppercase tracking-wider transition-colors"
                >
                  MY PORTFOLIO
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
        {data?.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-sm">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Total Projects</div>
              <div className="font-mono text-2xl font-bold text-white mt-1">
                {data.stats.total ?? 0}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-sm">
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">Published</div>
              <div className="font-mono text-2xl font-bold text-emerald-400 mt-1">
                {data.stats.published ?? 0}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-sm">
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400">Drafts</div>
              <div className="font-mono text-2xl font-bold text-amber-400 mt-1">
                {data.stats.drafts ?? 0}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-sm">
              <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">Likes Received</div>
              <div className="font-mono text-2xl font-bold text-rose-400 mt-1 flex items-center gap-1.5">
                <Heart className="w-5 h-5 fill-current" />
                <span>{data.stats.totalLikes ?? 0}</span>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-sm col-span-2 sm:col-span-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Showcase Views</div>
              <div className="font-mono text-2xl font-bold text-cyan-400 mt-1 flex items-center gap-1.5">
                <Eye className="w-5 h-5" />
                <span>{data.stats.totalViews ?? 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Pending Collaborator Invitations Alert Banner */}
        {contributingProjects.filter((p) => p.status === 'PENDING').length > 0 && (
          <div className="mb-6 p-4 sm:p-5 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>
                      You have {contributingProjects.filter((p) => p.status === 'PENDING').length} pending collaborator invitation{contributingProjects.filter((p) => p.status === 'PENDING').length > 1 ? 's' : ''}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Action Required
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-300 mt-1">
                    Peers have invited you to collaborate on showcase projects. Review and respond to your invitations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('contributing')}
                  className="px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase bg-amber-500 hover:bg-amber-400 text-black transition-colors"
                >
                  View Invitations ({contributingProjects.filter((p) => p.status === 'PENDING').length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg mb-6 overflow-x-auto no-scrollbar">
          {(['all', 'published', 'draft', 'unpublished', 'contributing'] as const).map((tab) => {
            const pendingCount = contributingProjects.filter((p) => p.status === 'PENDING').length;
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
                className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab
                    ? 'bg-zinc-100 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>
                  {tab === 'all'
                    ? `All (${count})`
                    : tab === 'published'
                    ? `Published (${count})`
                    : tab === 'draft'
                    ? `Drafts (${count})`
                    : tab === 'unpublished'
                    ? `Unpublished (${count})`
                    : `Collaborations (${count})`}
                </span>
                {tab === 'contributing' && pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-black">
                    {pendingCount} PENDING
                  </span>
                )}
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
              {contributingProjects.map((item: MyProjectsResponse['contributing'][number], idx: number) => {
                const contributorRecordId = item.id || item.contributor_id || '';
                const isCurrentResponding = respondingId === contributorRecordId;

                return (
                  <div
                    key={contributorRecordId || `${item.project?.id || 'contrib'}-${idx}`}
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
                              : item.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.project?.owner_name && (
                          <span className="text-[11px] font-mono text-zinc-500">
                            by {item.project.owner_name}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-white">
                        {item.project?.title}
                      </h3>
                      {item.project?.tagline && (
                        <p className="text-xs text-zinc-400 mt-0.5">{item.project.tagline}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'PENDING' && (
                        <>
                          <button
                            disabled={isCurrentResponding}
                            onClick={() => handleRespondInvitation(contributorRecordId, 'ACCEPTED')}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5"
                          >
                            {isCurrentResponding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>Accept</span>
                          </button>
                          <button
                            disabled={isCurrentResponding}
                            onClick={() => handleRespondInvitation(contributorRecordId, 'DECLINED')}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 border border-zinc-700 transition-colors"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {item.status === 'ACCEPTED' && (
                        <button
                          disabled={isCurrentResponding}
                          onClick={() => handleLeaveProject(item.project.id, contributorRecordId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all flex items-center gap-1"
                          title="Leave this collaboration"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Leave</span>
                        </button>
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
                );
              })}
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
                    <div className="w-24 h-16 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0">
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
                <div className="flex flex-wrap items-center gap-2 lg:shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-800/60">
                  {/* View Live */}
                  <Link
                    href={`/projects/${project.slug}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View</span>
                  </Link>

                  {/* Markdown Quick Preview */}
                  <button
                    type="button"
                    onClick={() => setPreviewMarkdownProject(project)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
                    title="Quick Preview Markdown document"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Preview</span>
                  </button>

                  {/* Edit Project */}
                  <Link
                    href={`/projects/${project.slug}/edit`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase font-semibold bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 transition-colors"
                    title="Edit Project"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
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

                  {/* Collaborators Management */}
                  <button
                    onClick={() => {
                      setManageTeamProject(project);
                      setIsLoadingContributors(true);
                      setInviteEmail('');
                      setInviteRole('');
                      setInviteError(null);
                      setInviteSuccess(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                    title="Manage Project Collaborators"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Collaborators</span>
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

        {/* Manage Collaborators & Invitations Modal */}
        {manageTeamProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 p-6 sm:p-8 rounded-2xl shadow-2xl relative my-8">
              <button
                onClick={closeManageTeamModal}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Users className="w-4 h-4" />
                </span>
                <h3 className="text-lg font-extrabold tracking-tight text-white">
                  Project Collaborators
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                Manage peer contributors for <strong className="text-white">{manageTeamProject.title}</strong>. Accepted collaborators are displayed publicly on your showcase.
              </p>

              {/* Section 1: Active Collaborators & Pending Invites */}
              <div className="mb-6">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 mb-3 flex items-center justify-between">
                  <span>Team Members & Invitations</span>
                  {teamContributors.length > 0 && (
                    <span className="text-[10px] text-zinc-500 lowercase font-normal">
                      ({teamContributors.length} total)
                    </span>
                  )}
                </h4>

                {isLoadingContributors ? (
                  <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-center text-xs font-mono text-zinc-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading collaborators...</span>
                  </div>
                ) : contributorsError ? (
                  <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs font-mono text-red-300 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>Failed to load collaborators: {contributorsError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchContributors(manageTeamProject.id)}
                      className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-white text-[10px] font-bold uppercase transition-colors shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                ) : teamContributors.length > 0 ? (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {teamContributors.map((c) => {
                      const isRevoking = revokingContributorId === c.id;
                      return (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-white truncate">
                                {c.name || c.email || c.invited_email}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                                  c.status === 'ACCEPTED'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : c.status === 'PENDING'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                }`}
                              >
                                {c.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono truncate">
                              {c.role} {c.email ? `• ${c.email}` : c.invited_email ? `• ${c.invited_email}` : ''}
                            </div>
                          </div>

                          <button
                            disabled={isRevoking}
                            onClick={() => handleRevokeContributor(c.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all flex items-center gap-1 shrink-0"
                            title={c.status === 'PENDING' ? 'Cancel Invitation' : 'Revoke Collaborator'}
                          >
                            {isRevoking ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span className="text-[10px] font-mono">
                              {c.status === 'PENDING' ? 'Cancel' : 'Revoke'}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-zinc-800/80 bg-zinc-900/20 text-center text-xs text-zinc-500 font-mono">
                    No collaborators invited yet. Use the form below to add peers.
                  </div>
                )}
              </div>

              {/* Section 2: Invite Collaborator Form */}
              <div className="pt-5 border-t border-zinc-800">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 mb-3 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Invite a Peer Collaborator</span>
                </h4>

                {inviteError && (
                  <div className="p-3 mb-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{inviteError}</span>
                  </div>
                )}

                {inviteSuccess && (
                  <div className="p-3 mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{inviteSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleInviteCollaborator} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                      Institutional Email *
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="peer.name@adypu.edu.in or @newtonschool.co"
                      required
                      disabled={isSendingInvite}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
                    />
                    <p className="text-[10px] text-zinc-500 font-mono mt-1">
                      Permitted domains: @adypu.edu.in and @newtonschool.co
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                      Role Description * (e.g. Frontend Engineer, ML Researcher)
                    </label>
                    <input
                      type="text"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      placeholder="e.g. Lead Designer & Prototyper"
                      required
                      disabled={isSendingInvite}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeManageTeamModal}
                      className="px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                    >
                      Done
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingInvite || !inviteEmail || !inviteRole}
                      className="px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase bg-[#0057FF] hover:bg-[#0047D4] disabled:opacity-50 text-white shadow-sm transition-all flex items-center gap-1.5"
                    >
                      {isSendingInvite ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <span>Send Invitation</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Markdown Document Preview Modal */}
        {previewMarkdownProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
                <div className="min-w-0 pr-4">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                    PROJECT MARKDOWN PREVIEW
                  </span>
                  <h3 className="text-lg font-bold text-white truncate">
                    {previewMarkdownProject.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewMarkdownProject(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 sm:p-8 overflow-y-auto max-h-[calc(90vh-130px)]">
                <div className="mb-4 pb-3 border-b border-zinc-900 flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-400">
                    Rendered with NST GitHub-Flavored Markdown Engine
                  </span>
                  <span className="px-2.5 py-1 text-xs font-mono rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                    {previewMarkdownProject.category}
                  </span>
                </div>
                <MarkdownRenderer content={previewMarkdownProject.description} />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-900/40">
                <span className="text-xs font-mono text-zinc-500">
                  /projects/{previewMarkdownProject.slug}
                </span>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/projects/${previewMarkdownProject.slug}/edit`}
                    className="px-4 py-1.5 rounded-lg text-xs font-mono font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Edit in Markdown Editor
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPreviewMarkdownProject(null)}
                    className="px-4 py-1.5 rounded-lg text-xs font-mono font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
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
