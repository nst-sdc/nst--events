'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { getWebAuthStore } from '@/lib/auth-store';
import { refreshToken } from '@/lib/api';
import { StudentAppShell } from '@/components/layout/StudentAppShell';
import { ClubAdminProvider } from '@/components/layout/ClubAdminProvider';
import { ProjectForm } from '@/components/projects/ProjectForm';

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

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#050505] flex items-center justify-center font-mono text-xs text-zinc-600 dark:text-zinc-400">
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
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#050505] text-zinc-950 dark:text-[#F5F5F2] font-sans relative selection:bg-[#0057FF] selection:text-white scroll-smooth">
          {/* Background Dot Texture */}
          <div
            className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] text-zinc-950 dark:text-white"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Form Container */}
          <main className="relative z-10 max-w-4xl mx-auto px-6 py-10">
            {/* Sub-Navigation Breadcrumb */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#F5F5F2]/20 pb-4 mb-8">
              <Link
                href="/projects"
                className="flex items-center space-x-2 text-zinc-600 dark:text-[#a0a4b8] hover:text-[#0057FF] font-['JetBrains_Mono',monospace] text-xs uppercase tracking-wider transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>ALL PROJECTS</span>
              </Link>
              <div className="flex items-center gap-4">
                <span className="font-['JetBrains_Mono',monospace] text-xs font-bold text-[#0057FF] uppercase tracking-wider">
                  NEW SHOWCASE
                </span>
                <span className="text-zinc-300 dark:text-zinc-600">/</span>
                <Link
                  href="/my/projects"
                  className="font-['JetBrains_Mono',monospace] text-xs font-bold text-zinc-600 dark:text-[#a0a4b8] hover:text-zinc-950 dark:hover:text-white uppercase tracking-wider transition-colors"
                >
                  MY PROJECTS
                </Link>
              </div>
            </div>

            <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800/80 pb-6">
              <div className="flex items-center space-x-2 text-xs font-mono text-[#0057FF] tracking-widest uppercase mb-3">
                <Sparkles className="w-4 h-4" />
                <span>SHOWCASE SUBMISSION</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
                Submit a Project
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Share your work with the world. Submit to the verified NST project directory. You can save a draft at any time and publish when ready.
              </p>
            </div>

            <ProjectForm mode="create" />
          </main>
        </div>
      </StudentAppShell>
    </ClubAdminProvider>
  );
}
