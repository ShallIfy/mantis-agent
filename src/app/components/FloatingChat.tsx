'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import Image from 'next/image';
import ChatWindow from './ChatWindow';

export default function FloatingChat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Chat Panel ── */}
      <div className={cn(
        'fixed z-50 flex flex-col overflow-hidden',
        'bg-[#080f0b]/[0.97] backdrop-blur-2xl',
        'border border-white/[0.06]',
        'shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7),0_0_1px_rgba(255,255,255,0.06),0_0_60px_rgba(0,210,110,0.05)]',
        'bottom-14 right-5 w-[400px] h-[640px] rounded-[20px]',
        'max-sm:w-[calc(100vw-1.5rem)] max-sm:h-[calc(100vh-5rem)] max-sm:right-3',
        open
          ? 'animate-in slide-in-from-bottom-4 fade-in duration-300'
          : 'hidden',
      )}>
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 h-[52px] border-b border-white/[0.04] bg-white/[0.015] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col gap-0">
              <span className="text-[13px] font-semibold text-white/90 leading-none">MANTIS</span>
              <span className="text-[10px] text-white/25 leading-none mt-0.5">CeDeFi Agent</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-150"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="relative">
              <Image src="/mantis-logo.png" alt="MANTIS" width={26} height={26} className="rounded-lg" />
              <span className="absolute -bottom-0.5 -right-0.5 w-[7px] h-[7px] rounded-full bg-emerald-400 ring-[1.5px] ring-[#080f0b]" />
            </div>
          </div>
        </div>

        {/* Chat Body */}
        <div className="flex-1 min-h-0">
          <ChatWindow floatingMode />
        </div>
      </div>

      {/* ── Taskbar Button (bottom-right, all screens) ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-0 right-5 z-50 flex items-center gap-2.5 px-4 h-[42px] rounded-t-xl transition-all duration-200 ease-out',
          'border border-b-0',
          'max-sm:right-3 max-sm:px-3 max-sm:h-[38px]',
          open
            ? 'bg-[#080f0b]/[0.97] border-white/[0.08] shadow-[0_-4px_24px_rgba(0,0,0,0.4),0_0_40px_rgba(0,210,110,0.06)]'
            : 'bg-[#0a1210]/90 border-white/[0.05] shadow-[0_-2px_12px_rgba(0,0,0,0.3)] hover:bg-[#0d1a15]/95 hover:border-white/[0.08] hover:shadow-[0_-4px_20px_rgba(0,0,0,0.4),0_0_30px_rgba(0,210,110,0.04)]',
        )}
      >
        <div className="relative flex-shrink-0">
          <Image src="/mantis-logo.png" alt="MANTIS" width={20} height={20} className={cn('rounded-md transition-opacity duration-200', open ? 'opacity-90' : 'opacity-60')} />
          <span className={cn('absolute -bottom-0.5 -right-0.5 w-[6px] h-[6px] rounded-full ring-[1.5px] transition-colors duration-200', open ? 'bg-emerald-400 ring-[#080f0b]' : 'bg-emerald-400/60 ring-[#0a1210]')} />
        </div>
        <span className={cn('text-[12px] font-medium tracking-wide transition-colors duration-200', open ? 'text-white/80' : 'text-white/40')}>
          Spawn Agent
        </span>
        {open && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-emerald-400/40" />}
      </button>
    </>
  );
}
