'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone,
  QrCode,
  ExternalLink,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface EventRegistrationHandoffProps {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  registrationStatus: 'UPCOMING' | 'NOT_STARTED' | 'OPEN' | 'CLOSING_SOON' | 'CLOSED';
  registrationMode?: 'REQUIRED' | 'NOT_REQUIRED';
  registrationType?: string;
  isRestricted?: boolean;
}

export function EventRegistrationHandoff({
  eventId,
  eventSlug,
  eventTitle,
  registrationStatus,
  registrationMode,
  registrationType,
  isRestricted = false,
}: EventRegistrationHandoffProps) {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [isAttemptingOpen, setIsAttemptingOpen] = useState<boolean>(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isIos) {
      setIsMobile(true);
      setPlatform('ios');
    } else if (isAndroid) {
      setIsMobile(true);
      setPlatform('android');
    } else {
      setIsMobile(false);
      setPlatform('desktop');
    }
  }, []);

  const deepLink = `nstevents://register?slug=${encodeURIComponent(eventSlug)}&eventId=${encodeURIComponent(eventId)}`;
  const storeLink =
    platform === 'ios'
      ? 'https://apps.apple.com/app/nst-events/id000000000'
      : `https://play.google.com/store/apps/details?id=org.nstsdc.events&referrer=slug%3D${encodeURIComponent(eventSlug)}%26eventId%3D${encodeURIComponent(eventId)}`;

  const [hasPromptedInstall, setHasPromptedInstall] = useState<boolean>(false);

  const handleMobileAppLaunch = () => {
    setIsAttemptingOpen(true);
    const start = Date.now();

    // 1. Attempt deep link trigger
    window.location.href = deepLink;

    // 2. Set fallback timeout for store redirect if app not installed
    setTimeout(() => {
      setIsAttemptingOpen(false);
      if (!document.hidden && Date.now() - start < 3000) {
        setHasPromptedInstall(true);
        window.location.href = storeLink;
      }
    }, 2000);
  };

  if (registrationMode === 'NOT_REQUIRED') {
    return (
      <div className="rounded-xl border border-black/10 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 p-6 text-center">
        <span className="inline-block px-3 py-1 rounded text-xs font-mono font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 mb-3">
          NO REGISTRATION REQUIRED
        </span>
        <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-300">Open Event &mdash; Walk-ins Welcome</h4>
        <p className="text-xs text-zinc-600 dark:text-zinc-500 mt-1">This is an open informational event. You do not need to register in advance.</p>
      </div>
    );
  }

  if (registrationStatus === 'CLOSED') {
    return (
      <div className="rounded-xl border border-black/10 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 p-6 text-center">
        <span className="inline-block px-3 py-1 rounded text-xs font-mono font-bold tracking-wider uppercase bg-zinc-200 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-500 border border-zinc-300 dark:border-zinc-800 mb-3">
          REGISTRATION CLOSED
        </span>
        <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-300">Registration is no longer accepting submissions</h4>
        <p className="text-xs text-zinc-600 dark:text-zinc-500 mt-1">This event has reached its registration deadline.</p>
      </div>
    );
  }

  if (registrationStatus === 'NOT_STARTED' || registrationStatus === 'UPCOMING') {
    return (
      <div className="rounded-xl border border-black/10 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 p-6 text-center">
        <span className="inline-block px-3 py-1 rounded text-xs font-mono font-bold tracking-wider uppercase bg-[#0057FF]/10 text-[#0057FF] border border-[#0057FF]/30 mb-3">
          REGISTRATION NOT STARTED
        </span>
        <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-300">Registration Opens Soon</h4>
        <p className="text-xs text-zinc-600 dark:text-zinc-500 mt-1">Check back once the registration window officially commences.</p>
      </div>
    );
  }

  const isClosingSoon = registrationStatus === 'CLOSING_SOON';

  return (
    <div className="rounded-2xl border-2 border-black/20 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 sm:p-8 relative overflow-hidden shadow-[8px_8px_0px_#0057FF]">
      {/* Subtle background glow */}
      <div
        className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
          isClosingSoon ? 'bg-[#FF9500]/10' : 'bg-[#0057FF]/10 dark:bg-[#C8FF00]/10'
        }`}
      />

      <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
        <div>
          {isClosingSoon ? (
            <div className="flex items-center space-x-2 text-xs font-mono text-[#FF9500] font-bold tracking-widest uppercase mb-2">
              <AlertTriangle className="w-4 h-4 text-[#FF9500]" />
              <span>REGISTRATION CLOSING SOON</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-xs font-mono text-[#0057FF] dark:text-[#C8FF00] font-bold tracking-widest uppercase mb-2">
              <Sparkles className="w-4 h-4" />
              <span>OFFICIAL REGISTRATION</span>
            </div>
          )}
          <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-950 dark:text-[#F5F5F2]">
            SECURE YOUR PASS
          </h3>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-lg">
            Institutional account (@adypu.edu.in or @newtonschool.co) required. Complete registration and claim attendance passes in the NST Events App.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          {isMobile ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleMobileAppLaunch}
                disabled={isAttemptingOpen}
                className="px-6 py-3.5 bg-[#0057FF] dark:bg-[#C8FF00] hover:bg-[#0047E0] dark:hover:bg-[#b8eb00] text-white dark:text-black font-mono font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>{isAttemptingOpen ? 'OPENING APP...' : 'REGISTER IN APP'}</span>
              </button>
              {hasPromptedInstall && (
                <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-black/10 dark:border-zinc-800 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 text-left max-w-xs">
                  <span className="font-bold text-[#0057FF] dark:text-[#C8FF00]">Step 2:</span> Once installation finishes from the store, return here and tap <span className="text-zinc-950 dark:text-[#F5F5F2] font-semibold">REGISTER IN APP</span> to restore your selected event pass.
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowQrModal(true)}
                className="px-6 py-3.5 bg-[#0057FF] dark:bg-[#C8FF00] hover:bg-[#0047E0] dark:hover:bg-[#b8eb00] text-white dark:text-black font-mono font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2"
              >
                <QrCode className="w-4 h-4" />
                <span>SCAN TO REGISTER</span>
              </button>
              <Link
                href={`/student/events/${eventId}`}
                className="px-5 py-3.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-2 border-black/15 dark:border-zinc-700 text-zinc-900 dark:text-[#F5F5F2] font-mono font-bold text-xs tracking-wider uppercase rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <span>CONTINUE ON WEB</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Desktop QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d0e12] border-2 border-black/20 dark:border-zinc-700 max-w-md w-full rounded-2xl p-6 sm:p-8 relative shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-zinc-800">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-[#0057FF] dark:text-[#C8FF00]" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-300">
                  SCAN WITH PHONE CAMERA
                </span>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-zinc-500 hover:text-black dark:hover:text-white font-mono text-sm"
              >
                [ESC / CLOSE]
              </button>
            </div>

            <div className="my-6 flex flex-col items-center">
              <div className="p-4 bg-white rounded-xl shadow-inner border border-zinc-200 dark:border-transparent">
                <QRCodeSVG value={deepLink} size={200} level="H" includeMargin />
              </div>
              <p className="mt-4 text-center text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                Opens <strong>{eventTitle}</strong> directly in the NST Events App for one-tap registration.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-black/10 dark:border-zinc-800 text-center">
              <Link
                href={`/student/events/${eventId}`}
                className="w-full py-2.5 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-300 hover:text-black dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 border border-black/15 dark:border-zinc-700 rounded-lg transition-colors"
              >
                Or Continue Using Web Browser &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
