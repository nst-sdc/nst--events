'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, ShieldAlert, FileQuestion } from 'lucide-react';
import { getWebAuthStore } from '@/lib/auth-store';
import { refreshToken } from '@/lib/api';
import { projectsApi, ProjectDetail } from '@/lib/projects-api';
import { StudentAppShell } from '@/components/layout/StudentAppShell';
import { ClubAdminProvider } from '@/components/layout/ClubAdminProvider';
import { ProjectForm } from '@/components/projects/ProjectForm';

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const slug = (params?.slug as string) || '';

  const authStore = getWebAuthStore();
  const [token, setToken] = useState<string | null>(authStore.accessToken);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  // Authenticate user
  useEffect(() => {
    const checkAuth = async () => {
      let currentToken = authStore.accessToken;
      if (!currentToken) {
        try {
          const res = await refreshToken();
          if (res.status === 'SUCCESS' && res.token) {
            authStore.setAccessToken(res.token);
            currentToken = res.token;
            setToken(res.token);
          }
        } catch {
          // Token refresh failed
        }
      } else {
        setToken(currentToken);
      }

      if (!currentToken) {
        router.push(`/login?return_to=/projects/${encodeURIComponent(slug)}/edit`);
        return;
      }

      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router, authStore, slug]);

  // Load project details
  useEffect(() => {
    let ignore = false;
    if (!isCheckingAuth && token && slug) {
      projectsApi
        .getPublicBySlug(slug, token)
        .then((data) => {
          if (!ignore) {
            if (!data) {
              setFetchError('Project not found or may have been deleted.');
            } else if (!data.is_owner) {
              setIsUnauthorized(true);
            } else {
              setProject(data);
            }
            setIsLoadingProject(false);
          }
        })
        .catch((err) => {
          if (!ignore) {
            setFetchError(err instanceof Error ? err.message : 'Failed to load project details.');
            setIsLoadingProject(false);
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [isCheckingAuth, token, slug]);

  if (isCheckingAuth || isLoadingProject) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono text-xs text-zinc-400">
        <div className="animate-pulse flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0057FF]" />
          <span>{isCheckingAuth ? 'Verifying student authentication...' : 'Loading project details...'}</span>
        </div>
      </div>
    );
  }

  // Not Found / Deleted State
  if (fetchError || !project) {
    return (
      <ClubAdminProvider>
        <StudentAppShell>
          <div className="min-h-screen bg-[#050505] text-[#F5F5F2] flex items-center justify-center px-6">
            <div className="max-w-md w-full p-8 rounded-xl bg-zinc-950 border border-zinc-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <FileQuestion className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white font-mono uppercase">Project Not Found</h2>
              <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                {fetchError || 'The project you are trying to edit does not exist, or has been permanently removed.'}
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Link
                  href="/my/projects"
                  className="px-4 py-2 rounded-lg bg-[#0057FF] hover:bg-blue-600 text-white font-mono text-xs uppercase font-bold transition-colors"
                >
                  Back to My Projects
                </Link>
              </div>
            </div>
          </div>
        </StudentAppShell>
      </ClubAdminProvider>
    );
  }

  // Unauthorized Access State (Student trying to edit someone else's project)
  if (isUnauthorized) {
    return (
      <ClubAdminProvider>
        <StudentAppShell>
          <div className="min-h-screen bg-[#050505] text-[#F5F5F2] flex items-center justify-center px-6">
            <div className="max-w-md w-full p-8 rounded-xl bg-zinc-950 border border-rose-900/50 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white font-mono uppercase">Access Denied</h2>
              <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                You do not have permission to edit this project. Only the project owner can make modifications.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Link
                  href={`/projects/${encodeURIComponent(slug)}`}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono text-xs uppercase font-bold transition-colors"
                >
                  View Project
                </Link>
                <Link
                  href="/my/projects"
                  className="px-4 py-2 rounded-lg bg-[#0057FF] hover:bg-blue-600 text-white font-mono text-xs uppercase font-bold transition-colors"
                >
                  My Projects
                </Link>
              </div>
            </div>
          </div>
        </StudentAppShell>
      </ClubAdminProvider>
    );
  }

  return (
    <ClubAdminProvider>
      <StudentAppShell>
        <div className="min-h-screen bg-[#050505] text-[#F5F5F2] font-sans relative selection:bg-[#0057FF] selection:text-white scroll-smooth">
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
                href={`/projects/${project.slug}`}
                className="flex items-center space-x-2 text-[#a0a4b8] hover:text-[#0057FF] font-['JetBrains_Mono',monospace] text-xs uppercase tracking-wider transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>BACK TO PROJECT</span>
              </Link>
              <div className="flex items-center gap-4">
                <span className="font-['JetBrains_Mono',monospace] text-xs font-bold text-[#0057FF] uppercase tracking-wider">
                  EDIT PROJECT
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
                <span>PROJECT MANAGEMENT</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Edit {project.title}
              </h1>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Update project details, showcase links, tech stack, and documentation. Changes to published projects are reflected immediately.
              </p>
            </div>

            <ProjectForm
              mode="edit"
              initialData={project}
              onSuccess={(updated) => {
                router.push(`/projects/${updated.slug}`);
              }}
            />
          </main>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
