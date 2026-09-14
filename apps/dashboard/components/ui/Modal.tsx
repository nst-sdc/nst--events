'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-6 transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-[#090a0f] w-full max-w-lg border-2 sm:border-3 border-[#F5F5F2] flex flex-col max-h-[90vh] shadow-[10px_10px_0px_#0057FF] animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:zoom-in-95 duration-200 relative overflow-hidden text-[#F5F5F2]"
      >
        {/* Top accent gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0057FF] via-[#C8FF00] to-[#0057FF] shrink-0" />

        <div className="flex items-center justify-between p-6 border-b-2 border-white/15 bg-[#0e1017] shrink-0">
          <h2 
            className="text-2xl font-black text-[#F5F5F2] tracking-tight uppercase" 
            style={{ fontFamily: "'Syne', 'Outfit', sans-serif" }}
          >
            {title}
          </h2>
          <button 
            onClick={onClose}
            className="border-2 border-white/20 bg-white/5 hover:bg-[#FF3B30] hover:border-[#FF3B30] text-[#a0a4b8] hover:text-white p-1.5 transition-colors shadow-[2px_2px_0px_#000]"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto bg-[#07080b]">
          {children}
        </div>
      </div>
    </div>
  );
}
