'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { TrendingUp, Loader2, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import TokenIcon from './TokenIcon';
import ProtocolIcon from './ProtocolIcon';
import { useWallet } from '@/lib/wallet/provider';

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
      <TableCell colSpan={5} className="py-10 text-center">
        <Loader2 className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </TableCell>
    </TableRow>
  );
}

function ScrollableTabs({ tabConfig, loading, counts }: {
  tabConfig: { value: string; label: string; count: number; logo: string | null }[];
  loading: boolean;
  counts: Record<string, number>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -120 : 120, behavior: 'smooth' });
  };

  return (
    <div className="flex items-center gap-1 mb-3 sm:mb-5">
      {/* Left arrow — mobile only */}
      <button
        onClick={() => scroll('left')}
        className={cn(
          'w-6 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all sm:hidden',
          canScrollLeft
            ? 'bg-white/[0.04] border border-white/[0.06] text-white/50 active:bg-white/[0.08]'
            : 'text-white/[0.06] pointer-events-none',
        )}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <TabsList
        ref={scrollRef}
        className="flex flex-1 min-w-0 bg-muted/30 border border-border/50 p-1 rounded-xl justify-start overflow-x-auto scrollbar-none"
      >
        {tabConfig.map(tab => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="text-xs rounded-lg data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all whitespace-nowrap flex-shrink-0"
          >
            {tab.logo ? (
              <img src={tab.logo} alt={tab.label} className="w-4 h-4 mr-1.5 object-contain" />
            ) : (
              <Layers className="w-3.5 h-3.5 mr-1.5" />
            )}
            {tab.label}
            {!loading && tab.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[0.6rem] leading-none">
                {tab.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Right arrow — mobile only */}
      <button
        onClick={() => scroll('right')}
        className={cn(
          'w-6 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all sm:hidden',
          canScrollRight
            ? 'bg-white/[0.04] border border-white/[0.06] text-white/50 active:bg-white/[0.08]'
            : 'text-white/[0.06] pointer-events-none',
        )}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function YieldTable() {
  const { address: connectedAddress } = useWallet();
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [bybitProducts, setBybitProducts] = useState<BybitProduct[]>([]);
  const [cianVaults, setCianVaults] = useState<CianVault[]>([]);
  const [loading, setLoading] = useState(true);

  // Yield data is protocol-level, not wallet-specific — dummy address for API requirement only
  const walletAddr = connectedAddress || '0x0000000000000000000000000000000000000001';

  useEffect(() => {
    fetch(`/api/snapshot?wallet=${walletAddr}`)
      .then(r => r.json())
      .then(data => {
        setReserves(data.aave?.reserves || []);
        setPools(data.yields?.topByAPY || []);
        setBybitProducts(data.bybit?.products || []);
        setCianVaults(data.cian?.vaults || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [walletAddr]);

  const counts = {
    aave: reserves.filter(r => r.supplyAPY > 0 || parseFloat(r.totalSupply) > 0).length,
    bybit: bybitProducts.length,
    cian: cianVaults.length,
    ecosystem: pools.length,
  };

  const sortedReserves = reserves
    .filter(r => r.supplyAPY > 0 || parseFloat(r.totalSupply) > 0)
    .sort((a, b) => b.supplyAPY - a.supplyAPY);

  const tabConfig = [
    { value: 'aave', label: 'Aave V3', count: counts.aave, logo: '/logos/aave.svg' },
    { value: 'bybit', label: 'Bybit', count: counts.bybit, logo: '/logos/bybit.png' },
    { value: 'cian', label: 'CIAN', count: counts.cian, logo: '/logos/cian.png' },
    { value: 'ecosystem', label: 'All', count: counts.ecosystem, logo: null },
  ];

  return (
    <div className="mantis-card-premium h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 sm:mb-5">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <span className="section-header">Yield Opportunities</span>
      </div>

      <Tabs defaultValue="aave" className="flex-1 flex flex-col min-h-0 items-stretch">
        <ScrollableTabs tabConfig={tabConfig} loading={loading} counts={counts} />

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Aave Tab */}
          <TabsContent value="aave" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Token</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Supply APY</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right hidden sm:table-cell">Borrow APY</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right hidden md:table-cell">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReserves.map((r, i) => (
                  <TableRow key={r.symbol} className={cn(
                    'data-row border-border/20 transition-colors',
                    i === 0 && 'yield-top-row',
                  )}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={r.symbol} size="sm" />
                        <span className="font-semibold">{r.symbol}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-right"><APYCell value={r.supplyAPY} isTop={i === 0} /></TableCell>
                    <TableCell className="text-sm text-right text-destructive/70 tabular-nums hidden sm:table-cell">{r.borrowAPY.toFixed(2)}%</TableCell>
                    <TableCell className="hidden md:table-cell"><UtilBar value={r.utilizationRate} /></TableCell>
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
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Receive</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bybitProducts.map((p, i) => (
                  <TableRow key={p.productId} className={cn(
                    'data-row border-border/20',
                    i === 0 && 'yield-top-row',
                  )}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={p.coin} size="sm" />
                        <span className="font-semibold">{p.coin}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-right"><APYCell value={p.estimateApr} isTop={i === 0} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary text-[0.6rem]">{p.duration}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                      {p.swapCoin ? (
                        <div className="flex items-center gap-1.5">
                          <TokenIcon symbol={p.swapCoin} size="sm" />
                          <span>{p.swapCoin}</span>
                        </div>
                      ) : '—'}
                    </TableCell>
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
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right hidden sm:table-cell">Net APY</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">TVL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cianVaults.map((v, i) => (
                  <TableRow key={v.poolAddress} className={cn(
                    'data-row border-border/20',
                    i === 0 && 'yield-top-row',
                  )}>
                    <TableCell className="text-xs font-semibold">{v.poolName}</TableCell>
                    <TableCell className="text-sm text-right"><APYCell value={v.apy} isTop={i === 0} /></TableCell>
                    <TableCell className="text-sm text-right text-yellow-400/80 tabular-nums hidden sm:table-cell">{v.netApy !== null ? `${v.netApy.toFixed(2)}%` : '—'}</TableCell>
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
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right hidden sm:table-cell">TVL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pools.slice(0, 12).map((p, i) => (
                  <TableRow key={i} className={cn(
                    'data-row border-border/20',
                    i === 0 && 'yield-top-row',
                  )}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <ProtocolIcon slug={p.project} />
                        <span className="text-muted-foreground">{p.project}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={p.symbol.split('-')[0]} size="sm" />
                        <span className="font-semibold">{p.symbol}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-right"><APYCell value={p.apy} isTop={i === 0} /></TableCell>
                    <TableCell className="py-3 px-3 text-sm text-right text-muted-foreground hidden sm:table-cell">{formatTVL(p.tvlUsd)}</TableCell>
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
