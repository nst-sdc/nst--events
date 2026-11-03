'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  maxWidth?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'CONFIRM',
  cancelText = 'CANCEL',
  isDestructive = true,
  isLoading = false,
  maxWidth = 'max-w-md',
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      // Auto-focus confirm or cancel button for keyboard navigation accessibility
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current && !isLoading) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-opacity animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        className={`bg-white dark:bg-[#090a0f] w-full ${maxWidth} border-2 sm:border-3 border-black dark:border-[#F5F5F2] flex flex-col shadow-[8px_8px_0px_#0057FF] animate-in zoom-in-95 duration-200 relative overflow-hidden text-zinc-950 dark:text-[#F5F5F2]`}
      >
        {/* Top accent bar */}
        <div
          className={`h-1.5 w-full shrink-0 ${
            isDestructive
              ? 'bg-gradient-to-r from-[#FF3B30] via-[#FF9500] to-[#FF3B30]'
              : 'bg-gradient-to-r from-[#0057FF] via-[#00E5FF] to-[#0057FF]'
          }`}
        />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b-2 border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-[#0e1017]">
          <div className="flex items-center gap-2.5">
            {isDestructive && (
              <AlertTriangle className="w-5 h-5 text-[#FF3B30] shrink-0" aria-hidden="true" />
            )}
            <h2
              id="confirm-dialog-title"
              className="text-lg font-black text-zinc-950 dark:text-[#F5F5F2] tracking-tight uppercase"
              style={{ fontFamily: "'Syne', 'Outfit', sans-serif" }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="border-2 border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 hover:bg-[#FF3B30] hover:border-[#FF3B30] text-zinc-600 dark:text-[#a0a4b8] hover:text-white p-1.5 transition-colors shadow-[2px_2px_0px_#000] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF] focus-visible:ring-offset-2"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Message */}
        <div className="p-5 bg-white dark:bg-[#07080b]">
          <div
            id="confirm-dialog-message"
            className="text-xs sm:text-sm font-mono text-zinc-600 dark:text-[#a0a4b8] leading-relaxed"
          >
            {message}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t-2 border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-[#0e1017] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border-2 border-black/20 dark:border-white/20 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-800 dark:text-white font-mono text-xs uppercase tracking-wider transition-colors shadow-[2px_2px_0px_#000] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF] disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 border-2 font-mono text-xs uppercase tracking-wider transition-all shadow-[2px_2px_0px_#000] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF] disabled:opacity-50 ${
              isDestructive
                ? 'border-[#FF3B30] bg-[#FF3B30] text-white hover:bg-[#D32F2F]'
                : 'border-[#0057FF] bg-[#0057FF] text-white hover:bg-[#0046FA]'
            }`}
          >
            {isLoading ? 'PROCESSING...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
