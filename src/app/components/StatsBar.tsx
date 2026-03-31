'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Shield, TrendingUp, BarChart3, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWallet } from '@/lib/wallet/provider';
import Link from 'next/link';

interface StatsData {
  totalValueUSD: number;
  healthFactor: number | null;
  bestAPY: number | null;
  netPNL: number;
}

function formatUSD(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function StatsBar() {
  const { address: connectedAddress } = useWallet();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const isConnected = !!connectedAddress;
  // Dummy address only for API call to fetch general data (block, gas, sources) — never displayed
  const walletAddr = connectedAddress || '0x0000000000000000000000000000000000000001';

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/snapshot?wallet=${walletAddr}`);
      const json = await res.json();

      // Best APY across all sources
      const aaveTop = (json.aave?.reserves || []).reduce((max: number, r: { supplyAPY: number }) => Math.max(max, r.supplyAPY || 0), 0);
      const bybitTop = (json.bybit?.products || []).reduce((max: number, p: { estimateApr: number }) => Math.max(max, p.estimateApr || 0), 0);
      const cianTop = (json.cian?.vaults || []).reduce((max: number, v: { apy: number }) => Math.max(max, v.apy || 0), 0);
      const bestAPY = Math.max(aaveTop, bybitTop, cianTop);

      // Net PNL = collateral - debt
      const collateral = json.aave?.account?.totalCollateralUSD || 0;
      const debt = json.aave?.account?.totalDebtUSD || 0;

      setData({
        totalValueUSD: json.wallet?.totalValueUSD || 0,
        healthFactor: json.aave?.account?.healthFactor ?? null,
        bestAPY: bestAPY > 0 ? bestAPY : null,
        netPNL: collateral - debt,
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [walletAddr]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6 animate-in">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-3 w-16 mb-2" />
            <div className="skeleton h-6 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const hf = data.healthFactor;
  const hfColor = hf === null || hf === Infinity
    ? 'text-muted-foreground'
    : hf > 1.5 ? 'text-primary' : hf > 1.3 ? 'text-yellow-400' : 'text-destructive';
  const hfDisplay = hf === null ? 'N/A' : hf === Infinity ? '∞' : hf.toFixed(2);

  const apyDisplay = data.bestAPY !== null ? `${data.bestAPY.toFixed(2)}%` : '—';
  const pnlDisplay = isConnected ? formatUSD(data.netPNL) : '—';
  const pnlPositive = data.netPNL >= 0;

  const stats = [
    {
      label: 'Total Value',
      value: isConnected ? formatUSD(data.totalValueUSD) : '—',
      icon: DollarSign,
      primary: isConnected,
      valueClass: isConnected ? 'text-foreground' : 'text-muted-foreground',
      connectHint: !isConnected,
    },
    {
      label: 'Health Factor',
      value: isConnected ? hfDisplay : '—',
      icon: Shield,
      valueClass: isConnected ? hfColor : 'text-muted-foreground',
      connectHint: !isConnected,
    },
    {
      label: 'Best APY',
      value: apyDisplay,
      icon: TrendingUp,
      valueClass: data.bestAPY !== null && data.bestAPY >= 5 ? 'text-primary' : 'text-foreground',
    },
    {
      label: 'Net PNL',
      value: isConnected ? (pnlPositive ? `+${pnlDisplay}` : pnlDisplay) : '—',
      icon: BarChart3,
      valueClass: isConnected ? (pnlPositive ? 'text-primary' : 'text-destructive') : 'text-muted-foreground',
      connectHint: !isConnected,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6 animate-in">
      {stats.map((s) => (
        <div key={s.label} className={cn('stat-card', s.primary && 'stat-card-primary')}>
          <div className="stat-label flex items-center gap-1 mb-1.5">
            <s.icon className="w-3 h-3" />
            {s.label}
          </div>
          {s.connectHint ? (
            <Link href="/wallet" className="text-xs text-primary/60 hover:text-primary font-medium flex items-center gap-1 mt-1 transition-colors">
              <Wallet className="w-3 h-3" />
              Connect
            </Link>
          ) : (
            <div className={cn('text-lg font-bold tabular-nums tracking-tight flex items-center', s.valueClass)}>
              {s.value}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
