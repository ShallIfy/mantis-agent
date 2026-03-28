'use client';

import Link from 'next/link';
import { Bug, MessageSquare, LayoutDashboard } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--card-border)] bg-[var(--mantis-dark)]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Bug className="w-6 h-6 text-mantis" />
          <span className="text-lg font-bold tracking-wider">MANTIS</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
              pathname === '/dashboard'
                ? 'bg-[var(--card-bg)] text-mantis'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/chat"
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
              pathname === '/chat'
                ? 'bg-[var(--card-bg)] text-mantis'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </Link>
        </nav>
      </div>
    </header>
  );
}
