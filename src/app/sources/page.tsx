'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/app/components/Header';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import {
  RefreshCw, TrendingUp, Coins, Vault, Network, Globe,
  Wallet, Clock, AlertTriangle, X, ChevronRight, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import TokenIcon from '@/app/components/TokenIcon';
import ProtocolIcon from '@/app/components/ProtocolIcon';
import { useWallet } from '@/lib/wallet/provider';

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

interface SourceHealth {
  online: boolean;
  count: number;
  label: string;
}

interface SnapshotHealth {
  aave: SourceHealth;
  bybit: SourceHealth;
  cian: SourceHealth;
  mcp: SourceHealth;
  defillama: SourceHealth;
  wallet: SourceHealth;
  collectionTimeMs: number;
  errors: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawSnapshot = Record<string, any>;

// ═══════════════════════════════════════════════
// SOURCE CONFIG
// ═══════════════════════════════════════════════

const SOURCES = [
  {
    key: 'aave', name: 'Aave V3', icon: TrendingUp,
    logo: '/logos/aave.svg',
    type: 'On-chain', color: '#3b82f6',
    url: 'https://app.aave.com/?marketName=proto_mantle_v3',
    description: 'Lending & borrowing rates from PoolDataProvider smart contract',
  },
  {
    key: 'bybit', name: 'Bybit Earn', icon: Coins,
    logo: '/logos/bybit.png',
    type: 'REST API', color: '#f59e0b',
    url: 'https://www.bybit.com/earn/defi/mining',
    description: 'OnChain earn products and APR data via Bybit API',
  },
  {
    key: 'cian', name: 'CIAN Protocol', icon: Vault,
    logo: '/logos/cian.png',
    type: 'On-chain + REST', color: '#10b981',
    url: 'https://dapp.cian.app/mantle',
    description: 'ERC4626 vault data combining REST API and on-chain reads',
  },
  {
    key: 'mcp', name: 'MCP Scaffold', icon: Network,
    logo: '/logos/mantle.png',
    type: 'MCP stdio', color: '#a855f7',
    url: 'https://github.com/mantle-xyz/mantle-agent-scaffold',
    description: 'Mantle Agent Scaffold via Model Context Protocol subprocess',
  },
  {
    key: 'defillama', name: 'DefiLlama', icon: Globe,
    logo: '/logos/defillama.png',
    type: 'REST API', color: '#6366f1',
    url: 'https://defillama.com/chain/Mantle',
    description: 'Aggregated yield pools across all Mantle protocols',
  },
  {
    key: 'wallet', name: 'Wallet Balances', icon: Wallet,
    logo: '',
    type: 'On-chain', color: '#00D26E',
    url: 'https://mantlescan.xyz',
    description: 'Native MNT and ERC-20 token balances on Mantle',
  },
] as const;

type SourceKey = typeof SOURCES[number]['key'];

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function APYCell({ value, isTop }: { value: number; isTop?: boolean }) {
  if (value == null || isNaN(value)) return <span className="text-muted-foreground">—</span>;
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

function formatTVL(n: number): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

function getDetailRows(key: string, data: RawSnapshot): RawSnapshot[] {
  switch (key) {
    case 'aave': return data?.aave?.reserves || [];
    case 'bybit': return data?.bybit?.products || [];
    case 'cian': return data?.cian?.vaults || [];
    case 'mcp': return data?.mcp?.lendingMarkets || [];
    case 'defillama': return data?.yields?.mantlePools || [];
    case 'wallet': return data?.wallet?.balances || [];
    default: return [];
  }
}

// ═══════════════════════════════════════════════
// PARSE SNAPSHOT → HEALTH
// ═══════════════════════════════════════════════

function parseHealth(data: RawSnapshot): SnapshotHealth {
  const aaveReserves = data?.aave?.reserves || [];
  const bybitProducts = data?.bybit?.products || [];
  const cianVaults = data?.cian?.vaults || [];
  const mcpMarkets = data?.mcp?.lendingMarkets || [];
  const mcpChain = data?.mcp?.chainStatus;
  const pools = data?.yields?.mantlePools || [];
  const balances = data?.wallet?.balances || [];
  const meta = data?.metadata || {};

  return {
    aave: { online: aaveReserves.length > 0, count: aaveReserves.length, label: 'reserves' },
    bybit: { online: bybitProducts.length > 0, count: bybitProducts.length, label: 'products' },
    cian: { online: cianVaults.length > 0, count: cianVaults.length, label: 'vaults' },
    mcp: { online: mcpMarkets.length > 0 || mcpChain !== null, count: mcpMarkets.length, label: 'markets' },
    defillama: { online: pools.length > 0, count: pools.length, label: 'pools' },
    wallet: { online: balances.length > 0, count: balances.length, label: 'balances' },
    collectionTimeMs: meta.collectionTimeMs || 0,
    errors: meta.errors || [],
  };
}

// ═══════════════════════════════════════════════
// PER-SOURCE TABLE RENDERERS
// ═══════════════════════════════════════════════

const TH_CLASS = 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground';

function AaveDetail({ rows }: { rows: RawSnapshot[] }) {
  const sorted = [...rows].sort((a, b) => b.supplyAPY - a.supplyAPY);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/30 hover:bg-transparent">
          <TableHead className={TH_CLASS}>Token</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right')}>Supply APY</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right hidden sm:table-cell')}>Borrow APY</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right hidden sm:table-cell')}>Utilization</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r, i) => (
          <TableRow key={r.symbol} className={cn('data-row border-border/20', i === 0 && 'yield-top-row')}>
            <TableCell className="text-sm">
              <div className="flex items-center gap-2">
                <TokenIcon symbol={r.symbol} size="sm" />
                <span className="font-semibold">{r.symbol}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-right"><APYCell value={r.supplyAPY} isTop={i === 0} /></TableCell>
            <TableCell className="text-sm text-right text-destructive/70 tabular-nums hidden sm:table-cell">{r.borrowAPY?.toFixed(2)}%</TableCell>
            <TableCell className="hidden sm:table-cell"><UtilBar value={r.utilizationRate} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BybitDetail({ rows }: { rows: RawSnapshot[] }) {
  const sorted = [...rows].sort((a, b) => b.estimateApr - a.estimateApr);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/30 hover:bg-transparent">
          <TableHead className={TH_CLASS}>Coin</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right')}>APR</TableHead>
          <TableHead className={TH_CLASS}>Type</TableHead>
          <TableHead className={cn(TH_CLASS, 'hidden sm:table-cell')}>Receive</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r, i) => (
          <TableRow key={r.productId} className={cn('data-row border-border/20', i === 0 && 'yield-top-row')}>
            <TableCell className="text-sm">
              <div className="flex items-center gap-2">
                <TokenIcon symbol={r.coin} size="sm" />
                <span className="font-semibold">{r.coin}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-right"><APYCell value={r.estimateApr} isTop={i === 0} /></TableCell>
            <TableCell>
              <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary text-[0.6rem]">
                {r.term === 0 ? 'Flexible' : `${r.term}d Fixed`}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
              {r.swapCoin ? (
                <div className="flex items-center gap-1.5">
                  <TokenIcon symbol={r.swapCoin} size="sm" />
                  <span>{r.swapCoin}</span>
                </div>
              ) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CianDetail({ rows }: { rows: RawSnapshot[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/30 hover:bg-transparent">
          <TableHead className={TH_CLASS}>Vault</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right')}>APY</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right hidden sm:table-cell')}>Net APY</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right')}>TVL</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={r.poolAddress} className={cn('data-row border-border/20', i === 0 && 'yield-top-row')}>
            <TableCell className="text-sm">
              <div className="flex items-center gap-2">
                <TokenIcon symbol={r.poolName} size="sm" />
                <span className="font-semibold">{r.poolName}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-right"><APYCell value={r.apy} isTop={i === 0} /></TableCell>
            <TableCell className="text-sm text-right text-yellow-400/80 tabular-nums hidden sm:table-cell">
              {r.netApy != null ? `${r.netApy.toFixed(2)}%` : '—'}
            </TableCell>
            <TableCell className="text-sm text-right text-muted-foreground">{formatTVL(r.tvlUsd)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function McpDetail({ rows }: { rows: RawSnapshot[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/30 hover:bg-transparent">
          <TableHead className={TH_CLASS}>Protocol</TableHead>
          <TableHead className={TH_CLASS}>Asset</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right')}>Supply APY</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right hidden sm:table-cell')}>Borrow APY</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i} className="data-row border-border/20">
            <TableCell className="text-sm text-muted-foreground">{r.protocol}</TableCell>
            <TableCell className="text-sm">
              <div className="flex items-center gap-2">
                <TokenIcon symbol={r.asset} size="sm" />
                <span className="font-semibold">{r.asset}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-right"><APYCell value={r.supply_apy} /></TableCell>
            <TableCell className="text-sm text-right text-destructive/70 tabular-nums hidden sm:table-cell">
              {r.borrow_apy_variable != null ? `${r.borrow_apy_variable.toFixed(2)}%` : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DefillamaDetail({ rows }: { rows: RawSnapshot[] }) {
  const sorted = [...rows].sort((a, b) => b.apy - a.apy);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/30 hover:bg-transparent">
          <TableHead className={TH_CLASS}>Protocol</TableHead>
          <TableHead className={TH_CLASS}>Pool</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right')}>APY</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right hidden sm:table-cell')}>TVL</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r, i) => (
          <TableRow key={i} className={cn('data-row border-border/20', i === 0 && 'yield-top-row')}>
            <TableCell className="text-sm">
              <div className="flex items-center gap-2">
                <ProtocolIcon slug={r.project} />
                <span className="text-muted-foreground">{r.project}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm">
              <div className="flex items-center gap-2">
                <TokenIcon symbol={r.symbol?.split('-')?.[0] || r.symbol} size="sm" />
                <span className="font-semibold">{r.symbol}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-right"><APYCell value={r.apy} isTop={i === 0} /></TableCell>
            <TableCell className="text-sm text-right text-muted-foreground hidden sm:table-cell">{formatTVL(r.tvlUsd)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function WalletDetail({ rows }: { rows: RawSnapshot[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/30 hover:bg-transparent">
          <TableHead className={TH_CLASS}>Token</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right')}>Balance</TableHead>
          <TableHead className={cn(TH_CLASS, 'text-right')}>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i} className="data-row border-border/20">
            <TableCell className="text-sm">
              <div className="flex items-center gap-2">
                <TokenIcon symbol={r.symbol} size="sm" />
                <span className="font-semibold">{r.symbol}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-right tabular-nums">{r.formatted}</TableCell>
            <TableCell className="text-sm text-right text-muted-foreground tabular-nums">{formatTVL(r.valueUSD)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ═══════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════

function DetailModal({ sourceKey, source, data, onClose }: {
  sourceKey: string;
  source: typeof SOURCES[number];
  data: RawSnapshot;
  onClose: () => void;
}) {
  const rows = getDetailRows(sourceKey, data);
  const Icon = source.icon;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col mantis-card-premium animate-in !p-0 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top glow bar */}
        <div
          className="absolute top-0 left-4 right-4 h-[1px]"
          style={{ background: `linear-gradient(90deg, transparent, ${source.color}50, transparent)` }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-4">
          <div className="flex items-center gap-3">
            {source.logo ? (
              <img src={source.logo} alt={source.name} className="w-8 h-8 object-contain" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${source.color}12`, border: `1px solid ${source.color}20` }}
              >
                <Icon className="w-4 h-4" style={{ color: `${source.color}cc` }} />
              </div>
            )}
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">{source.name}</h2>
              <span className="text-[11px] text-muted-foreground">{source.type}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 tabular-nums border-border">
              {rows.length} {rows.length === 1 ? 'item' : 'items'}
            </Badge>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-primary/70 hover:text-primary hover:bg-primary/[0.06] transition-colors"
            >
              Visit
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 sm:mx-6 h-[1px] bg-border/50" />

        {/* Table body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-6 py-3 sm:py-4">
          {sourceKey === 'aave' && <AaveDetail rows={rows} />}
          {sourceKey === 'bybit' && <BybitDetail rows={rows} />}
          {sourceKey === 'cian' && <CianDetail rows={rows} />}
          {sourceKey === 'mcp' && <McpDetail rows={rows} />}
          {sourceKey === 'defillama' && <DefillamaDetail rows={rows} />}
          {sourceKey === 'wallet' && <WalletDetail rows={rows} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// STATUS RING
// ═══════════════════════════════════════════════

function StatusRing({ online, total }: { online: number; total: number }) {
  const pct = (online / total) * 100;
  const allGood = online === total;
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - (circumference * pct) / 100;

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
        <circle
          cx="50" cy="50" r="42" fill="none"
          stroke={allGood ? '#00D26E' : '#eab308'}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: allGood ? 'drop-shadow(0 0 6px rgba(0, 210, 110, 0.4))' : 'drop-shadow(0 0 6px rgba(234, 179, 8, 0.3))',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold tabular-nums', allGood ? 'text-primary' : 'text-yellow-400')}>
          {online}/{total}
        </span>
        <span className="text-[9px] font-medium text-white/25 uppercase tracking-widest mt-0.5">Online</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SOURCE CARD
// ═══════════════════════════════════════════════

function SourceCard({ source, status, index, onClick }: {
  source: typeof SOURCES[number];
  status: SourceHealth;
  index: number;
  onClick: () => void;
}) {
  const Icon = source.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'mantis-card-premium animate-in cursor-pointer group',
        'hover:scale-[1.02] hover:border-white/[0.08] active:scale-[0.99]',
        'transition-all duration-200',
        `stagger-${Math.min(index + 1, 5)}`,
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {source.logo ? (
            <img src={source.logo} alt={source.name} className="w-10 h-10 object-contain flex-shrink-0" />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${source.color}12`, border: `1px solid ${source.color}20` }}
            >
              <Icon className="w-5 h-5" style={{ color: `${source.color}cc` }} />
            </div>
          )}
          <div>
            <h3 className="text-[14px] font-semibold text-white/90 tracking-tight">{source.name}</h3>
            <Badge variant="outline" className="text-[9px] mt-1 px-1.5 py-0"
              style={{
                borderColor: `${source.color}25`,
                background: `${source.color}08`,
                color: `${source.color}aa`,
              }}
            >
              {source.type}
            </Badge>
          </div>
        </div>

        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full',
          status.online ? 'bg-primary/[0.06]' : 'bg-destructive/[0.06]',
        )}>
          <div className={cn(
            'w-1.5 h-1.5 rounded-full',
            status.online ? 'bg-primary animate-pulse' : 'bg-destructive',
          )} />
          <span className={cn(
            'text-[10px] font-medium',
            status.online ? 'text-primary/70' : 'text-destructive/70',
          )}>
            {status.online ? 'Live' : 'Down'}
          </span>
        </div>
      </div>

      <p className="text-[12px] text-white/30 leading-relaxed mb-4">{source.description}</p>

      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
        <div className="flex items-baseline gap-2">
          <span className="text-[20px] font-bold tabular-nums" style={{ color: status.online ? `${source.color}bb` : 'rgba(255,255,255,0.15)' }}>
            {status.count}
          </span>
          <span className="text-[12px] text-white/25">{status.label}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white/30 group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="mantis-card-premium animate-in" style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="skeleton w-10 h-10 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="skeleton h-3.5 w-24 rounded" />
              <div className="skeleton h-2.5 w-16 rounded" />
            </div>
          </div>
          <div className="skeleton h-2.5 w-full rounded mb-2" />
          <div className="skeleton h-2.5 w-3/4 rounded mb-4" />
          <div className="flex items-center gap-2 pt-3 border-t border-white/[0.04]">
            <div className="skeleton h-5 w-8 rounded" />
            <div className="skeleton h-2.5 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════

export default function SourcesPage() {
  const { address: connectedAddress } = useWallet();
  const [health, setHealth] = useState<SnapshotHealth | null>(null);
  const [rawSnapshot, setRawSnapshot] = useState<RawSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  // Source health data is protocol-level — dummy address for API requirement only
  const walletAddr = connectedAddress || '0x0000000000000000000000000000000000000001';

  const fetchHealth = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/snapshot?wallet=${walletAddr}`);
      const data = await res.json();
      setHealth(parseHealth(data));
      setRawSnapshot(data);
      setLastUpdated(new Date());
    } catch {
      // fail silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchHealth(); }, [walletAddr]);

  const handleCloseModal = useCallback(() => setSelectedSource(null), []);

  const onlineCount = health
    ? SOURCES.filter(s => (health[s.key as SourceKey] as SourceHealth).online).length
    : 0;

  const selectedSourceConfig = selectedSource
    ? SOURCES.find(s => s.key === selectedSource)
    : null;

  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-8">

        {/* ── Hero Section ── */}
        <div className="hero-card mb-4 sm:mb-8 animate-in">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-8">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white/92 mb-1.5">
                Data Sources
              </h1>
              <p className="text-[12px] sm:text-[13px] text-white/30 mb-4 sm:mb-6">
                Real-time health monitoring for all data collectors powering the agent
              </p>

              <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-white/20" />
                  <span className="text-[12px] text-white/40">
                    Collection: <span className="text-white/70 font-semibold tabular-nums">{health?.collectionTimeMs || '—'}ms</span>
                  </span>
                </div>
                {health && health.errors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400/50" />
                    <span className="text-[12px] text-amber-400/50">
                      {health.errors.length} error{health.errors.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {lastUpdated && (
                  <span className="text-[11px] text-white/15 font-mono">
                    Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
              {health && <StatusRing online={onlineCount} total={6} />}
              <button
                onClick={() => fetchHealth(true)}
                disabled={refreshing}
                className="btn-glow !text-[12px] !px-4 !py-2.5 flex items-center gap-2 disabled:opacity-40"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && <SkeletonCards />}

        {/* ── Source Cards Grid ── */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {SOURCES.map((source, i) => {
              const status = health[source.key as SourceKey] as SourceHealth;
              return (
                <SourceCard
                  key={source.key}
                  source={source}
                  status={status}
                  index={i}
                  onClick={() => setSelectedSource(source.key)}
                />
              );
            })}
          </div>
        )}

        {/* ── Errors ── */}
        {health && health.errors.length > 0 && (
          <div className="mantis-card-premium mt-6 border-l-[3px] border-l-destructive/40 animate-in">
            <div className="flex items-center gap-2.5 mb-3">
              <AlertTriangle className="w-4 h-4 text-destructive/60" />
              <span className="section-header text-destructive/80">Collection Errors</span>
            </div>
            <div className="space-y-1.5">
              {health.errors.map((err, i) => (
                <p key={i} className="text-[12px] text-white/30 font-mono leading-relaxed">{err}</p>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ── Detail Modal ── */}
      {selectedSource && selectedSourceConfig && rawSnapshot && (
        <DetailModal
          sourceKey={selectedSource}
          source={selectedSourceConfig}
          data={rawSnapshot}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
