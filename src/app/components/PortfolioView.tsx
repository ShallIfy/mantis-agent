'use client';

import { useEffect, useState } from 'react';
import { Shield, DollarSign, TrendingUp, AlertTriangle, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface SnapshotData {
  wallet: {
    address: string;
    totalValueUSD: number;
    balances: Array<{ symbol: string; formatted: string; valueUSD: number }>;
  };
  aave: {
    account: {
      totalCollateralUSD: number;
      totalDebtUSD: number;
      healthFactor: number | null;
    };
    positions: Array<{
      symbol: string;
      supplied: string;
      suppliedUSD: number;
      borrowed: string;
      borrowedUSD: number;
    }>;
  };
}

function formatUSD(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function HealthFactorGauge({ value }: { value: number | null }) {
  if (value === null || value === Infinity) {
    return (
      <div className="flex items-center gap-3">
        <span className="stat-value text-muted-foreground">{value === null ? 'N/A' : '∞'}</span>
      </div>
    );
  }

  // Map HF 0-3 to 0-100% position on gauge
  const pct = Math.min(Math.max((value / 3) * 100, 0), 100);
  const color = value > 1.5 ? 'text-primary' : value > 1.3 ? 'text-yellow-400' : 'text-destructive';

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className={cn('text-2xl font-bold tabular-nums tracking-tight', color)}>
          {value.toFixed(2)}
        </span>
        <Badge variant="outline" className={cn(
          'text-[0.6rem]',
          value > 1.5 && 'border-primary/20 bg-primary/8 text-primary',
          value <= 1.5 && value > 1.3 && 'border-yellow-500/20 bg-yellow-500/8 text-yellow-400',
          value <= 1.3 && 'border-destructive/20 bg-destructive/8 text-destructive',
        )}>
          {value > 1.5 ? 'Safe' : value > 1.3 ? 'Warning' : 'Danger'}
        </Badge>
      </div>
      <div className="hf-gauge">
        <div className="hf-gauge-marker" style={{ left: `calc(${pct}% - 2px)` }} />
      </div>
    </div>
  );
}

const TOKEN_COLORS: Record<string, string> = {
  MNT: '#00D26E',
  WETH: '#627eea',
  ETH: '#627eea',
  USDC: '#2775ca',
  USDT: '#50af95',
  'USDT0': '#50af95',
  wrsETH: '#00cfbe',
  mETH: '#9b59b6',
  WMNT: '#00D26E',
};

export default function PortfolioView() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const wallet = process.env.NEXT_PUBLIC_DEMO_WALLET || '0x0000000000000000000000000000000000000001';
      const res = await fetch(`/api/snapshot?wallet=${wallet}`);
      const json = await res.json();
      setData(json);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="mantis-card-premium mantis-glow">
        <div className="space-y-4">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-10 w-40" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-20 rounded-2xl" />
            <div className="skeleton h-20 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hf = data.aave.account.healthFactor;
  const activeBalances = data.wallet.balances.filter(b => b.valueUSD > 0.01);

  return (
    <div className="mantis-card-premium mantis-glow space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <span className="section-header">Portfolio</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono px-2.5 py-1 rounded-lg bg-muted/50">
          {data.wallet.address.slice(0, 6)}...{data.wallet.address.slice(-4)}
        </span>
      </div>

      {/* Hero Stat: Total Value */}
      <div>
        <div className="stat-label flex items-center gap-1 mb-2">
          <DollarSign className="w-3 h-3" /> Total Value
        </div>
        <div className="stat-value-xl">{formatUSD(data.wallet.totalValueUSD)}</div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="stat-label flex items-center gap-1 mb-2">
            <Shield className="w-3 h-3" /> Health Factor
          </div>
          <HealthFactorGauge value={hf} />
        </div>

        {data.aave.account.totalCollateralUSD > 0 ? (
          <div className="stat-card">
            <div className="stat-label mb-2">Positions</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Collateral</span>
                <span className="font-semibold text-primary">{formatUSD(data.aave.account.totalCollateralUSD)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Debt</span>
                <span className="font-semibold text-destructive">{formatUSD(data.aave.account.totalDebtUSD)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="stat-card flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-5 h-5 text-yellow-500/50 mb-1.5" />
            <span className="text-xs text-muted-foreground">No active DeFi positions</span>
          </div>
        )}
      </div>

      {/* Active Positions */}
      {data.aave.positions.length > 0 && (
        <>
          <Separator className="bg-border/50" />
          <div>
            <h3 className="section-header flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-3 h-3" /> Active Positions
            </h3>
            <div className="space-y-1">
              {data.aave.positions.map(p => (
                <div key={p.symbol} className="flex justify-between items-center text-sm data-row rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-black"
                      style={{ background: TOKEN_COLORS[p.symbol] || '#6b7c72' }}
                    >
                      {p.symbol.charAt(0)}
                    </div>
                    <span className="font-medium">{p.symbol}</span>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <span className="text-primary font-semibold tabular-nums">{formatUSD(p.suppliedUSD)}</span>
                    {p.borrowedUSD > 0 && (
                      <span className="text-destructive text-xs tabular-nums">-{formatUSD(p.borrowedUSD)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Wallet Balances */}
      {activeBalances.length > 0 && (
        <>
          <Separator className="bg-border/50" />
          <div>
            <h3 className="section-header mb-3">Wallet Balances</h3>
            <div className="space-y-0.5">
              {activeBalances.map(b => (
                <div key={b.symbol} className="flex justify-between items-center text-sm data-row rounded-lg px-3 py-1.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[0.55rem] font-bold text-black"
                      style={{ background: TOKEN_COLORS[b.symbol] || '#6b7c72' }}
                    >
                      {b.symbol.charAt(0)}
                    </div>
                    <span className="font-medium">{b.symbol}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums text-xs">
                    {parseFloat(b.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    <span className="text-muted-foreground/50 ml-1.5">({formatUSD(b.valueUSD)})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
