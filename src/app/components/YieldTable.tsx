'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Reserve { symbol: string; supplyAPY: number; borrowAPY: number; utilizationRate: number; totalSupply: string; }
interface Pool { project: string; symbol: string; apy: number; tvlUsd: number; }
interface BybitProduct { productId: string; coin: string; estimateApr: number; duration: string; swapCoin: string; minStakeAmount: string; }
interface CianVault { poolName: string; poolAddress: string; apy: number; netApy: number | null; tvlUsd: number; feePerformance: number | null; }

function formatTVL(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function APYCell({ value, isTop }: { value: number; isTop?: boolean }) {
  const color = value >= 5 ? 'text-primary font-bold' : value >= 2 ? 'text-emerald-400/90' : 'text-muted-foreground';
  return (
    <span className={cn('tabular-nums', color, isTop && value >= 5 && 'apy-glow')}>
      {value.toFixed(2)}%
    </span>
  );
}

function UtilBar({ value }: { value: number }) {
  const clamped = Math.min(value, 100);
  const barColor = clamped >= 85 ? 'bg-destructive/60' : clamped >= 60 ? 'bg-yellow-500/60' : 'bg-primary/50';
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-muted-foreground tabular-nums text-xs w-8 text-right">{value.toFixed(0)}%</span>
    </div>
  );
}

function EmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={4} className="py-10 text-center">
        <Loader2 className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </TableCell>
    </TableRow>
  );
}

export default function YieldTable() {
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [bybitProducts, setBybitProducts] = useState<BybitProduct[]>([]);
  const [cianVaults, setCianVaults] = useState<CianVault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const wallet = process.env.NEXT_PUBLIC_DEMO_WALLET || '0x0000000000000000000000000000000000000001';
    fetch(`/api/snapshot?wallet=${wallet}`)
      .then(r => r.json())
      .then(data => {
        setReserves(data.aave?.reserves || []);
        setPools(data.yields?.topByAPY || []);
        setBybitProducts(data.bybit?.products || []);
        setCianVaults(data.cian?.vaults || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const counts = {
    aave: reserves.filter(r => r.supplyAPY > 0 || parseFloat(r.totalSupply) > 0).length,
    bybit: bybitProducts.length,
    cian: cianVaults.length,
    ecosystem: pools.length,
  };

  const sortedReserves = reserves
    .filter(r => r.supplyAPY > 0 || parseFloat(r.totalSupply) > 0)
    .sort((a, b) => b.supplyAPY - a.supplyAPY);

  return (
    <div className="mantis-card-premium space-y-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <span className="section-header">Yield Opportunities</span>
      </div>

      <Tabs defaultValue="aave">
        <TabsList className="bg-muted/30 border border-border/50 p-1 mb-5 rounded-xl">
          {[
            { value: 'aave', label: 'Aave V3', count: counts.aave },
            { value: 'bybit', label: 'Bybit', count: counts.bybit },
            { value: 'cian', label: 'CIAN', count: counts.cian },
            { value: 'ecosystem', label: 'All', count: counts.ecosystem },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs rounded-lg data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all"
            >
              {tab.label}
              {!loading && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[0.6rem] leading-none">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="overflow-x-auto -mx-1.5">
          {/* Aave Tab */}
          <TabsContent value="aave" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Token</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Supply APY</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Borrow APY</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReserves.map((r, i) => (
                  <TableRow key={r.symbol} className={cn(
                    'data-row border-border/20 transition-colors',
                    i === 0 && r.supplyAPY >= 5 && 'border-l-2 border-l-primary/40',
                  )}>
                    <TableCell className="py-3 px-3 text-sm font-semibold">{r.symbol}</TableCell>
                    <TableCell className="py-3 px-3 text-sm text-right"><APYCell value={r.supplyAPY} isTop={i === 0} /></TableCell>
                    <TableCell className="py-3 px-3 text-sm text-right text-destructive/70 tabular-nums">{r.borrowAPY.toFixed(2)}%</TableCell>
                    <TableCell className="py-3 px-3"><UtilBar value={r.utilizationRate} /></TableCell>
                  </TableRow>
                ))}
                {sortedReserves.length === 0 && <EmptyState />}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Bybit Tab */}
          <TabsContent value="bybit" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Coin</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">APR</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Receive</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bybitProducts.map((p, i) => (
                  <TableRow key={p.productId} className={cn(
                    'data-row border-border/20',
                    i === 0 && 'border-l-2 border-l-primary/40',
                  )}>
                    <TableCell className="py-3 px-3 text-sm font-semibold">{p.coin}</TableCell>
                    <TableCell className="py-3 px-3 text-sm text-right"><APYCell value={p.estimateApr} isTop={i === 0} /></TableCell>
                    <TableCell className="py-3 px-3">
                      <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary text-[0.6rem]">{p.duration}</Badge>
                    </TableCell>
                    <TableCell className="py-3 px-3 text-sm text-muted-foreground">{p.swapCoin || '—'}</TableCell>
                  </TableRow>
                ))}
                {bybitProducts.length === 0 && <EmptyState />}
              </TableBody>
            </Table>
          </TabsContent>

          {/* CIAN Tab */}
          <TabsContent value="cian" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vault</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">APY</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Net APY</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">TVL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cianVaults.map((v, i) => (
                  <TableRow key={v.poolAddress} className={cn(
                    'data-row border-border/20',
                    i === 0 && 'border-l-2 border-l-primary/40',
                  )}>
                    <TableCell className="py-3 px-3 text-xs font-semibold">{v.poolName}</TableCell>
                    <TableCell className="py-3 px-3 text-sm text-right"><APYCell value={v.apy} isTop={i === 0} /></TableCell>
                    <TableCell className="py-3 px-3 text-sm text-right text-yellow-400/80 tabular-nums">{v.netApy !== null ? `${v.netApy.toFixed(2)}%` : '—'}</TableCell>
                    <TableCell className="py-3 px-3 text-sm text-right text-muted-foreground">{formatTVL(v.tvlUsd)}</TableCell>
                  </TableRow>
                ))}
                {cianVaults.length === 0 && <EmptyState />}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Ecosystem Tab */}
          <TabsContent value="ecosystem" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Protocol</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Token</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">APY</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">TVL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pools.slice(0, 12).map((p, i) => (
                  <TableRow key={i} className={cn(
                    'data-row border-border/20',
                    i === 0 && 'border-l-2 border-l-primary/40',
                  )}>
                    <TableCell className="py-3 px-3 text-sm text-muted-foreground">{p.project}</TableCell>
                    <TableCell className="py-3 px-3 text-sm font-semibold">{p.symbol}</TableCell>
                    <TableCell className="py-3 px-3 text-sm text-right"><APYCell value={p.apy} isTop={i === 0} /></TableCell>
                    <TableCell className="py-3 px-3 text-sm text-right text-muted-foreground">{formatTVL(p.tvlUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
