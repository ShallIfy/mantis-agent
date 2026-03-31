'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Wallet, LayoutDashboard, Network, Fingerprint, Database } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border/50 bg-[var(--mantis-dark)]/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8">
            <Image src="/mantis-logo.png" alt="MANTIS" width={32} height={32} className="rounded-lg" />
            <div className="absolute inset-0 rounded-lg bg-primary/0 group-hover:bg-primary/10 transition-colors" />
          </div>
          <span className="brand-wordmark">MANTIS</span>
          <span className="brand-badge">BETA</span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          {[
            { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { href: '/mcp', icon: Network, label: 'MCP' },
            { href: '/sources', icon: Database, label: 'Sources' },
            { href: '/identity', icon: Fingerprint, label: 'Identity' },
            { href: '/wallet', icon: Wallet, label: 'Wallet' },
          ].map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative px-2.5 sm:px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 sm:gap-2 transition-all',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-primary to-primary/50" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
