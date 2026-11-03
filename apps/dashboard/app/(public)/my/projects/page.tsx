'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
import { StudentAppShell } from '@/components/layout/StudentAppShell';
import { ClubAdminProvider } from '@/components/layout/ClubAdminProvider';
import { MarkdownRenderer } from '@/components/projects/MarkdownRenderer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const myProjectsStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,700;1,400&family=Outfit:wght@400;700;900&family=Syne:wght@700;800;900&display=swap');

  :root {
    --bg-black: #050505;
    --bg-paper-white: #F5F5F2;
    --bg-dark-card: #0d0e12;
    --electric-blue: #0057FF;
    --acid-green: #C8FF00;
    --warm-red: #FF3B30;
    --warm-amber: #FF9500;
    --font-display: 'Syne', 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  .my-projects-page {
    width: 100%;
    min-height: 100vh;
    background-color: var(--bg-black);
    color: var(--bg-paper-white);
    font-family: var(--font-body);
    position: relative;
    overflow-x: hidden;
  }

  html.light .my-projects-page, .light .my-projects-page {
    background-color: #fbfbfb;
    color: #131313;
  }

  .my-projects-dot-grid {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.25;
    background-image: radial-gradient(rgba(245, 245, 242, 0.12) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  html.light .my-projects-dot-grid, .light .my-projects-dot-grid {
    opacity: 0.15;
    background-image: radial-gradient(rgba(0, 0, 0, 0.12) 1px, transparent 1px);
  }

  .my-projects-watermark {
    position: absolute;
    top: 40px;
    right: 20px;
    font-family: var(--font-display);
    font-size: clamp(80px, 14vw, 180px);
    font-weight: 900;
    color: rgba(245, 245, 242, 0.02);
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    line-height: 0.8;
    z-index: 0;
  }

  html.light .my-projects-watermark, .light .my-projects-watermark {
    color: rgba(0, 0, 0, 0.03);
  }

  .neo-stat-card {
    background: #0d0e12;
    border: 2px solid rgba(245, 245, 242, 0.15);
    padding: 16px 20px;
    box-shadow: 4px 4px 0px rgba(0, 87, 255, 0.25);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .neo-stat-card:hover {
    border-color: var(--electric-blue);
    box-shadow: 6px 6px 0px var(--electric-blue);
    transform: translate3d(-1px, -1px, 0);
  }

  html.light .neo-stat-card, .light .neo-stat-card {
    background: #ffffff;
    border: 2px solid #000000;
    box-shadow: 4px 4px 0px #000000;
  }

  html.light .neo-stat-card:hover, .light .neo-stat-card:hover {
    box-shadow: 6px 6px 0px #000000;
  }

  .neo-project-item {
    background: #0d0e12;
    border: 2px solid rgba(245, 245, 242, 0.15);
    padding: 24px;
    transition: all 0.2s ease;
  }

  .neo-project-item:hover {
    border-color: var(--electric-blue);
    box-shadow: 6px 6px 0px var(--electric-blue);
    transform: translate3d(-2px, -2px, 0);
  }

  html.light .neo-project-item, .light .neo-project-item {
    background: #ffffff;
    border: 2px solid #000000;
    box-shadow: 4px 4px 0px #000000;
  }

  html.light .neo-project-item:hover, .light .neo-project-item:hover {
    box-shadow: 8px 8px 0px #000000;
  }

  .neo-tab-button {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 8px 16px;
    background: transparent;
    border: 2px solid rgba(245, 245, 242, 0.25);
    color: var(--bg-paper-white);
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }

  .neo-tab-button:hover {
    border-color: var(--bg-paper-white);
  }

  .neo-tab-button.active {
    background: var(--electric-blue);
    border-color: var(--electric-blue);
    color: #ffffff;
    box-shadow: 4px 4px 0px rgba(0, 87, 255, 0.4);
  }

  html.light .neo-tab-button, .light .neo-tab-button {
    border: 2px solid #000000;
    color: #000000;
  }

  html.light .neo-tab-button.active, .light .neo-tab-button.active {
    background: #000000;
    border-color: #000000;
    color: #ffffff;
    box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.4);
  }

  .neo-action-btn {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 6px 12px;
    background: transparent;
    border: 2px solid rgba(245, 245, 242, 0.25);
    color: var(--bg-paper-white);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .neo-action-btn:hover {
    border-color: var(--electric-blue);
    background: var(--electric-blue);
    color: #ffffff;
  }

  html.light .neo-action-btn, .light .neo-action-btn {
    border: 2px solid #000000;
    color: #000000;
  }

  html.light .neo-action-btn:hover, .light .neo-action-btn:hover {
    background: #000000;
    color: #ffffff;
  }
`;

export default function MyProjectsDashboardPage() {
  const router = useRouter();
  const authStore = getWebAuthStore();

  const [data, setData] = useState<MyProjectsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'published' | 'draft' | 'unpublished' | 'contributing'>('all');
  const [leaveConfirmTarget, setLeaveConfirmTarget] = useState<{ projectId: string; contributorId: string } | null>(null);

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

  const loadData = useCallback(async () => {
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
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleLeaveProject = (projectId: string, contributorId: string) => {
    if (respondingId) return;
    setLeaveConfirmTarget({ projectId, contributorId });
  };

  const confirmLeaveProject = async () => {
    if (!leaveConfirmTarget || respondingId) return;
    const { projectId, contributorId } = leaveConfirmTarget;
    setLeaveConfirmTarget(null);
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
        <style dangerouslySetInnerHTML={{ __html: myProjectsStyles }} />
        <div className="my-projects-page relative selection:bg-[#0057FF] selection:text-white">
          {/* Background Dot Texture */}
          <div className="my-projects-dot-grid" />

          {/* Watermark */}
          <div className="my-projects-watermark">
            PROJECTS
          </div>

          {/* Main Container */}
          <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            {/* Sub-Navigation Breadcrumb */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black/15 dark:border-white/15 pb-4 mb-8">
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 text-zinc-600 dark:text-[#a0a4b8] hover:text-[#0057FF] dark:hover:text-[#7bd0ff] font-['JetBrains_Mono',monospace] text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>[← ALL PROJECTS]</span>
              </Link>
              <div className="flex items-center gap-3 font-['JetBrains_Mono',monospace] text-xs font-bold uppercase tracking-wider">
                <span className="text-[#0057FF] dark:text-[#7bd0ff]">
                  {'//'} CREATOR DASHBOARD
                </span>
                <span className="text-zinc-400 dark:text-zinc-600">/</span>
                <Link
                  href="/projects/submit"
                  className="text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white transition-colors"
                >
                  [SUBMIT PROJECT +]
                </Link>
                <span className="text-zinc-400 dark:text-zinc-600">/</span>
                <Link
                  href="/my/profile"
                  className="text-zinc-600 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white transition-colors"
                >
                  [MY PORTFOLIO]
                </Link>
              </div>
            </div>

            {/* Title Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-[#0057FF] dark:text-[#7bd0ff] mb-2">
                  <FolderHeart className="w-4 h-4" />
                  <span>{'//'} STUDENT CREATOR WORKSPACE</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-black dark:text-[#F5F5F2] font-['Syne',sans-serif]">
                  My Projects
                </h1>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 font-sans">
                  Manage your showcase submissions, track audience engagement, and coordinate peer contributors.
                </p>
              </div>

              <Link
                href="/projects/submit"
                className="neo-tab-button active self-start sm:self-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>[CREATE NEW PROJECT]</span>
              </Link>
            </div>

            {error && (
              <div className="p-4 mb-6 border-2 border-red-500/40 bg-red-500/10 text-xs font-['JetBrains_Mono',monospace] font-bold text-red-600 dark:text-red-300">
                {'//'} ERROR: {error}
              </div>
            )}

            {/* Metrics Grid */}
            {data?.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-10">
                <div className="neo-stat-card">
                  <div className="text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    TOTAL PROJECTS
                  </div>
                  <div className="font-['JetBrains_Mono',monospace] text-2xl font-black text-black dark:text-white mt-1">
                    {data.stats.total ?? 0}
                  </div>
                </div>

                <div className="neo-stat-card">
                  <div className="text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-emerald-600 dark:text-[#C8FF00]">
                    PUBLISHED
                  </div>
                  <div className="font-['JetBrains_Mono',monospace] text-2xl font-black text-emerald-600 dark:text-[#C8FF00] mt-1">
                    {data.stats.published ?? 0}
                  </div>
                </div>

                <div className="neo-stat-card">
                  <div className="text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-amber-500">
                    DRAFTS
                  </div>
                  <div className="font-['JetBrains_Mono',monospace] text-2xl font-black text-amber-500 mt-1">
                    {data.stats.drafts ?? 0}
                  </div>
                </div>

                <div className="neo-stat-card">
                  <div className="text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-rose-500">
                    LIKES RECEIVED
                  </div>
                  <div className="font-['JetBrains_Mono',monospace] text-2xl font-black text-rose-500 mt-1 flex items-center gap-1.5">
                    <Heart className="w-5 h-5 fill-current" />
                    <span>{data.stats.totalLikes ?? 0}</span>
                  </div>
                </div>

                <div className="neo-stat-card col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-cyan-500">
                    SHOWCASE VIEWS
                  </div>
                  <div className="font-['JetBrains_Mono',monospace] text-2xl font-black text-cyan-500 mt-1 flex items-center gap-1.5">
                    <Eye className="w-5 h-5" />
                    <span>{data.stats.totalViews ?? 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Collaborator Invitations Alert Banner */}
            {contributingProjects.filter((p) => p.status === 'PENDING').length > 0 && (
              <div className="mb-8 p-5 border-2 border-amber-500/50 bg-amber-500/10 shadow-[4px_4px_0px_rgba(255,149,0,0.2)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500 text-black shrink-0 font-bold">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-black dark:text-white flex items-center gap-2 font-['Syne',sans-serif] uppercase">
                        <span>
                          You have {contributingProjects.filter((p) => p.status === 'PENDING').length} pending collaborator invitation{contributingProjects.filter((p) => p.status === 'PENDING').length > 1 ? 's' : ''}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-['JetBrains_Mono',monospace] font-black uppercase bg-amber-500 text-black">
                          [ACTION REQUIRED]
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 font-sans">
                        Peers have invited you to collaborate on showcase projects. Review and respond to your invitations.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('contributing')}
                      className="px-4 py-2 text-xs font-['JetBrains_Mono',monospace] font-bold uppercase bg-amber-500 hover:bg-amber-400 text-black border-2 border-black shadow-[2px_2px_0px_#000000] transition-colors"
                    >
                      [VIEW INVITATIONS ({contributingProjects.filter((p) => p.status === 'PENDING').length})]
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
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
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`neo-tab-button ${activeTab === tab ? 'active' : ''}`}
                  >
                    <span>
                      {tab === 'all'
                        ? `ALL (${count})`
                        : tab === 'published'
                        ? `PUBLISHED (${count})`
                        : tab === 'draft'
                        ? `DRAFTS (${count})`
                        : tab === 'unpublished'
                        ? `UNPUBLISHED (${count})`
                        : `COLLABORATIONS (${count})`}
                    </span>
                    {tab === 'contributing' && pendingCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500 text-black border border-black">
                        {pendingCount} PENDING
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Projects List */}
            {isLoading ? (
              <div className="py-20 text-center text-zinc-500 font-['JetBrains_Mono',monospace] text-xs font-bold">
                {'//'} SYNCHRONIZING CREATOR REPOSITORY... Loading your projects...
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
                        className="neo-project-item flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="px-2 py-0.5 text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase bg-[#0057FF]/10 text-[#0057FF] dark:text-[#7bd0ff] border border-[#0057FF]/30">
                              [ROLE // {item.role}]
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase border ${
                                item.status === 'ACCEPTED'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-[#C8FF00] border-emerald-500/30'
                                  : item.status === 'PENDING'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                  : 'bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border-black/10 dark:border-white/10'
                              }`}
                            >
                              [{item.status}]
                            </span>
                            {item.project?.owner_name && (
                              <span className="text-[11px] font-['JetBrains_Mono',monospace] text-zinc-500">
                                OWNER // {item.project.owner_name}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-black dark:text-white font-['Syne',sans-serif] uppercase">
                            {item.project?.title}
                          </h3>
                          {item.project?.tagline && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 font-sans">
                              {item.project.tagline}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                disabled={isCurrentResponding}
                                onClick={() => handleRespondInvitation(contributorRecordId, 'ACCEPTED')}
                                className="neo-action-btn bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500"
                              >
                                {isCurrentResponding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                <span>[ACCEPT]</span>
                              </button>
                              <button
                                type="button"
                                disabled={isCurrentResponding}
                                onClick={() => handleRespondInvitation(contributorRecordId, 'DECLINED')}
                                className="neo-action-btn border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600"
                              >
                                [DECLINE]
                              </button>
                            </>
                          )}
                          {item.status === 'ACCEPTED' && (
                            <button
                              type="button"
                              disabled={isCurrentResponding}
                              onClick={() => handleLeaveProject(item.project.id, contributorRecordId)}
                              className="neo-action-btn text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-600 hover:text-white"
                              title="Leave this collaboration"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>[LEAVE]</span>
                            </button>
                          )}
                          {item.project?.slug && (
                            <Link
                              href={`/projects/${item.project.slug}`}
                              className="neo-action-btn"
                            >
                              <span>[VIEW PROJECT ↗]</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center border-2 border-dashed border-black/20 dark:border-white/20 bg-black/[0.02] dark:bg-white/[0.02] text-zinc-500 font-['JetBrains_Mono',monospace] text-xs font-bold">
                  {'//'} DIRECTORY EMPTY: NO EXTERNAL COLLABORATIONS RECORDED
                </div>
              )
            ) : filteredOwned.length > 0 ? (
              /* Owned Projects List */
              <div className="space-y-4">
                {filteredOwned.map((project: MyProjectsResponse['owned'][number]) => (
                  <div
                    key={project.id}
                    className="neo-project-item flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                  >
                    {/* Project Info */}
                    <div className="flex items-start gap-4 min-w-0">
                      {project.cover_image_url ? (
                        <div className="w-24 h-16 border-2 border-black dark:border-white/20 bg-black overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
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
                            className={`px-2 py-0.5 text-[10px] font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider border ${
                              project.visibility === 'PUBLISHED'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-[#C8FF00] border-emerald-500/30'
                                : project.visibility === 'DRAFT'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                : 'bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border-black/10 dark:border-white/10'
                            }`}
                          >
                            [{project.visibility}]
                          </span>
                          <span className="text-[11px] font-['JetBrains_Mono',monospace] font-bold text-zinc-500">
                            [{project.category}]
                          </span>
                          <span className="text-[11px] font-['JetBrains_Mono',monospace] text-zinc-400 dark:text-zinc-500">
                            /projects/{project.slug}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-black dark:text-white truncate font-['Syne',sans-serif] uppercase">
                          {project.title}
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1 mt-0.5 max-w-xl font-sans">
                          {project.tagline}
                        </p>

                        <div className="flex items-center gap-4 mt-2 text-xs font-['JetBrains_Mono',monospace] text-zinc-500 dark:text-zinc-400">
                          <span className="flex items-center gap-1 text-rose-500">
                            <Heart className="w-3.5 h-3.5 fill-current" />
                            <span>{project.like_count} likes</span>
                          </span>
                          <span className="flex items-center gap-1 text-cyan-500">
                            <Eye className="w-3.5 h-3.5" />
                            <span>{project.view_count} views</span>
                          </span>
                          {project.contributors && project.contributors.length > 0 && (
                            <span className="flex items-center gap-1 text-[#0057FF] dark:text-[#7bd0ff]">
                              <Users className="w-3.5 h-3.5" />
                              <span>{project.contributors.length} collaborators</span>
                            </span>
                          )}
                        </div>

                        {project.latest_moderation && (
                          <div className="mt-2.5 p-2.5 border-2 border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-['JetBrains_Mono',monospace]">
                            <span className="font-bold">{'//'} MODERATION NOTICE ({project.latest_moderation.action}):</span>{' '}
                            {project.latest_moderation.reason}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 lg:shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-black/10 dark:border-white/10">
                      {/* View Live */}
                      <Link
                        href={`/projects/${project.slug}`}
                        className="neo-action-btn"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>[VIEW]</span>
                      </Link>

                      {/* Markdown Quick Preview */}
                      <button
                        type="button"
                        onClick={() => setPreviewMarkdownProject(project)}
                        className="neo-action-btn"
                        title="Quick Preview Markdown document"
                      >
                        <FileText className="w-3.5 h-3.5 text-cyan-500" />
                        <span>[PREVIEW]</span>
                      </button>

                      {/* Edit Project */}
                      <Link
                        href={`/projects/${project.slug}/edit`}
                        className="neo-action-btn text-[#0057FF] dark:text-[#7bd0ff] border-[#0057FF]/40 hover:bg-[#0057FF] hover:text-white"
                        title="Edit Project"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>[EDIT]</span>
                      </Link>

                      {/* Publish / Unpublish Toggle */}
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(project)}
                        className={`neo-action-btn ${
                          project.visibility === 'PUBLISHED'
                            ? 'text-amber-500 border-amber-500/40 hover:bg-amber-500 hover:text-black'
                            : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500'
                        }`}
                      >
                        {project.visibility === 'PUBLISHED' ? '[UNPUBLISH]' : '[PUBLISH]'}
                      </button>

                      {/* Change Slug */}
                      <button
                        type="button"
                        onClick={() => {
                          setSlugModalProject(project);
                          setNewSlug(project.slug);
                        }}
                        className="neo-action-btn"
                        title="Change Project URL Slug"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>[SLUG]</span>
                      </button>

                      {/* Collaborators Management */}
                      <button
                        type="button"
                        onClick={() => {
                          setManageTeamProject(project);
                          setIsLoadingContributors(true);
                          setInviteEmail('');
                          setInviteRole('');
                          setInviteError(null);
                          setInviteSuccess(null);
                        }}
                        className="neo-action-btn"
                        title="Manage Project Collaborators"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>[TEAM]</span>
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => setDeleteModalProject(project)}
                        className="neo-action-btn text-rose-500 border-rose-500/40 hover:bg-rose-600 hover:text-white"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center border-2 border-dashed border-black/20 dark:border-white/20 bg-black/[0.02] dark:bg-white/[0.02]">
                <h3 className="text-base font-bold text-black dark:text-white font-['Syne',sans-serif] uppercase">
                  No projects found in this view
                </h3>
                <p className="mt-1 text-xs text-zinc-500 font-sans">
                  You have not published any projects matching this filter criteria.
                </p>
                <Link
                  href="/projects/submit"
                  className="mt-4 neo-tab-button active inline-flex"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>[CREATE YOUR FIRST PROJECT]</span>
                </Link>
              </div>
            )}

            {/* Change Slug Modal */}
            {slugModalProject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="w-full max-w-md bg-white dark:bg-[#0d0e12] border-2 border-black dark:border-white/30 p-6 sm:p-8 shadow-[10px_10px_0px_#0057FF] relative text-black dark:text-white">
                  <button
                    type="button"
                    onClick={() => setSlugModalProject(null)}
                    className="absolute top-4 right-4 p-1.5 border border-black dark:border-white/30 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <h3 className="text-lg font-black tracking-tight uppercase font-['Syne',sans-serif] mb-2">
                    Modify Project Slug
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed font-sans">
                    Updating your slug will preserve historical redirects from your old URL directly to the new URL without redirect loops.
                  </p>

                  {slugError && (
                    <div className="p-3 mb-4 border-2 border-red-500/40 bg-red-500/10 text-xs font-['JetBrains_Mono',monospace] text-red-600 dark:text-red-300">
                      {'//'} {slugError}
                    </div>
                  )}

                  <form onSubmit={handleChangeSlug} className="space-y-4">
                    <div>
                      <label className="block text-xs font-['JetBrains_Mono',monospace] uppercase tracking-wider text-zinc-500 mb-1.5 font-bold">
                        NEW SLUG * (LOWERCASE, NUMBERS, HYPHENS)
                      </label>
                      <input
                        type="text"
                        value={newSlug}
                        onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        placeholder="my-new-project-slug"
                        required
                        className="w-full border-2 border-black dark:border-white/30 bg-black/5 dark:bg-white/5 px-3.5 py-2.5 text-xs font-['JetBrains_Mono',monospace] text-black dark:text-white focus:outline-none focus:border-[#0057FF]"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black/10 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setSlugModalProject(null)}
                        className="neo-action-btn"
                      >
                        [CANCEL]
                      </button>
                      <button
                        type="submit"
                        className="neo-action-btn bg-[#0057FF] text-white border-[#0057FF]"
                      >
                        [UPDATE SLUG]
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Manage Collaborators & Invitations Modal */}
            {manageTeamProject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
                <div className="w-full max-w-lg bg-white dark:bg-[#0d0e12] border-2 border-black dark:border-white/30 p-6 sm:p-8 shadow-[10px_10px_0px_#0057FF] relative my-8 text-black dark:text-white">
                  <button
                    type="button"
                    onClick={closeManageTeamModal}
                    className="absolute top-4 right-4 p-1.5 border border-black dark:border-white/30 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 mb-1">
                    <span className="p-1.5 bg-[#0057FF]/10 text-[#0057FF] dark:text-[#7bd0ff] border border-[#0057FF]/30">
                      <Users className="w-4 h-4" />
                    </span>
                    <h3 className="text-lg font-black tracking-tight uppercase font-['Syne',sans-serif]">
                      Project Collaborators
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed font-sans">
                    Manage peer contributors for <strong className="text-black dark:text-white">{manageTeamProject.title}</strong>. Accepted collaborators are displayed publicly on your showcase.
                  </p>

                  {/* Section 1: Active Collaborators & Pending Invites */}
                  <div className="mb-6">
                    <h4 className="text-xs font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-black dark:text-white mb-3 flex items-center justify-between">
                      <span>Team Members &amp; Invitations</span>
                      {teamContributors.length > 0 && (
                        <span className="text-[10px] text-zinc-400 font-normal">
                          ({teamContributors.length} TOTAL)
                        </span>
                      )}
                    </h4>

                    {isLoadingContributors ? (
                      <div className="p-4 border-2 border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-center text-xs font-['JetBrains_Mono',monospace] text-zinc-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>[FETCHING COLLABORATOR ROSTER...]</span>
                      </div>
                    ) : contributorsError ? (
                      <div className="p-4 border-2 border-red-500/40 bg-red-500/10 text-xs font-['JetBrains_Mono',monospace] text-red-600 dark:text-red-300 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                          <span>Failed to load collaborators: {contributorsError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => fetchContributors(manageTeamProject.id)}
                          className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-white text-[10px] font-bold uppercase transition-colors shrink-0"
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
                              className="p-3 border-2 border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-bold text-black dark:text-white truncate">
                                    {c.name || c.email || c.invited_email}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 text-[9px] font-['JetBrains_Mono',monospace] font-bold uppercase border ${
                                      c.status === 'ACCEPTED'
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-[#C8FF00] border-emerald-500/30'
                                        : c.status === 'PENDING'
                                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                        : 'bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border-black/10 dark:border-white/10'
                                    }`}
                                  >
                                    [{c.status}]
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-500 font-['JetBrains_Mono',monospace] truncate">
                                  {c.role} {c.email ? `• ${c.email}` : c.invited_email ? `• ${c.invited_email}` : ''}
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={isRevoking}
                                onClick={() => handleRevokeContributor(c.id)}
                                className="neo-action-btn text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-600 hover:text-white"
                                title={c.status === 'PENDING' ? 'Cancel Invitation' : 'Revoke Collaborator'}
                              >
                                {isRevoking ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                                <span>{c.status === 'PENDING' ? 'Cancel' : 'Revoke'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 border-2 border-dashed border-black/20 dark:border-white/20 bg-black/[0.02] dark:bg-white/[0.02] text-center text-xs text-zinc-500 font-['JetBrains_Mono',monospace]">
                        {'//'} NO COLLABORATORS INVITED YET. USE FORM BELOW.
                      </div>
                    )}
                  </div>

                  {/* Section 2: Invite Collaborator Form */}
                  <div className="pt-5 border-t-2 border-black/10 dark:border-white/10">
                    <h4 className="text-xs font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-black dark:text-white mb-3 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-[#0057FF] dark:text-[#7bd0ff]" />
                      <span>Invite a Peer Collaborator</span>
                    </h4>

                    {inviteError && (
                      <div className="p-3 mb-3 border-2 border-red-500/40 bg-red-500/10 text-xs font-['JetBrains_Mono',monospace] text-red-600 dark:text-red-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{inviteError}</span>
                      </div>
                    )}

                    {inviteSuccess && (
                      <div className="p-3 mb-3 border-2 border-emerald-500/40 bg-emerald-500/10 text-xs font-['JetBrains_Mono',monospace] text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{inviteSuccess}</span>
                      </div>
                    )}

                    <form onSubmit={handleInviteCollaborator} className="space-y-3.5">
                      <div>
                        <label className="block text-[11px] font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                          INSTITUTIONAL EMAIL *
                        </label>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="peer.name@adypu.edu.in or @newtonschool.co"
                          required
                          disabled={isSendingInvite}
                          className="w-full border-2 border-black dark:border-white/30 bg-black/5 dark:bg-white/5 px-3.5 py-2 text-xs font-['JetBrains_Mono',monospace] text-black dark:text-white focus:outline-none focus:border-[#0057FF]"
                        />
                        <p className="text-[10px] text-zinc-500 font-['JetBrains_Mono',monospace] mt-1">
                          PERMITTED DOMAINS: @adypu.edu.in AND @newtonschool.co
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-['JetBrains_Mono',monospace] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                          ROLE DESCRIPTION * (E.G. FRONTEND ENGINEER, ML RESEARCHER)
                        </label>
                        <input
                          type="text"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          placeholder="e.g. Lead Designer & Prototyper"
                          required
                          disabled={isSendingInvite}
                          className="w-full border-2 border-black dark:border-white/30 bg-black/5 dark:bg-white/5 px-3.5 py-2 text-xs font-['JetBrains_Mono',monospace] text-black dark:text-white focus:outline-none focus:border-[#0057FF]"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={closeManageTeamModal}
                          className="neo-action-btn"
                        >
                          [DONE]
                        </button>
                        <button
                          type="submit"
                          disabled={isSendingInvite || !inviteEmail || !inviteRole}
                          className="neo-action-btn bg-[#0057FF] text-white border-[#0057FF] disabled:opacity-50"
                        >
                          {isSendingInvite ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>SENDING...</span>
                            </>
                          ) : (
                            <span>[SEND INVITATION]</span>
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
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0d0e12] border-2 border-black dark:border-white/30 shadow-[10px_10px_0px_#0057FF] overflow-hidden text-black dark:text-white">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5">
                    <div className="min-w-0 pr-4">
                      <span className="text-[10px] font-['JetBrains_Mono',monospace] text-cyan-600 dark:text-cyan-400 uppercase tracking-wider font-bold">
                        {'//'} PROJECT SPECIFICATION PREVIEW
                      </span>
                      <h3 className="text-lg font-bold text-black dark:text-white truncate font-['Syne',sans-serif] uppercase">
                        {previewMarkdownProject.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewMarkdownProject(null)}
                      className="p-1.5 border border-black dark:border-white/30 text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                      aria-label="Close preview"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 sm:p-8 overflow-y-auto max-h-[calc(90vh-130px)]">
                    <div className="mb-4 pb-3 border-b-2 border-black/10 dark:border-white/10 flex items-center justify-between">
                      <span className="text-xs font-['JetBrains_Mono',monospace] text-zinc-500">
                        Rendered with NST GitHub-Flavored Markdown Engine
                      </span>
                      <span className="px-2.5 py-1 text-xs font-['JetBrains_Mono',monospace] font-bold bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20">
                        [{previewMarkdownProject.category}]
                      </span>
                    </div>
                    <MarkdownRenderer content={previewMarkdownProject.description} />
                  </div>

                  {/* Modal Footer */}
                  <div className="flex items-center justify-between px-6 py-3.5 border-t-2 border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5">
                    <span className="text-xs font-['JetBrains_Mono',monospace] text-zinc-500">
                      /projects/{previewMarkdownProject.slug}
                    </span>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/projects/${previewMarkdownProject.slug}/edit`}
                        className="neo-action-btn bg-[#0057FF] text-white border-[#0057FF]"
                      >
                        [EDIT IN MARKDOWN EDITOR]
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPreviewMarkdownProject(null)}
                        className="neo-action-btn"
                      >
                        [CLOSE]
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalProject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="w-full max-w-sm bg-white dark:bg-[#0d0e12] border-2 border-black dark:border-white/30 p-6 sm:p-8 shadow-[8px_8px_0px_#FF3B30] relative text-black dark:text-white">
                  <h3 className="text-base font-black tracking-tight uppercase font-['Syne',sans-serif] mb-2 text-red-600">
                    {'//'} DELETE PROJECT?
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed font-sans">
                    Are you sure you want to delete <strong className="text-black dark:text-white">{deleteModalProject.title}</strong>? This will soft-delete the project and remove it from public discovery.
                  </p>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setDeleteModalProject(null)}
                      className="neo-action-btn"
                    >
                      [CANCEL]
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteProject}
                      className="neo-action-btn bg-rose-600 border-rose-700 text-white hover:bg-rose-700"
                    >
                      [CONFIRM DELETE]
                    </button>
                  </div>
                </div>
              </div>
            )}

            <ConfirmDialog
              isOpen={!!leaveConfirmTarget}
              onClose={() => setLeaveConfirmTarget(null)}
              onConfirm={confirmLeaveProject}
              title="Leave Project"
              message="Are you sure you want to leave this project collaboration? You will no longer be listed as a collaborator."
              confirmText="LEAVE PROJECT"
              isDestructive={true}
              isLoading={!!respondingId}
            />
          </main>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
