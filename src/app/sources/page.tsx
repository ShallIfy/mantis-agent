'use client';

import { useEffect, useState } from 'react';
import Header from '@/app/components/Header';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp, Coins, Vault, Network, Globe, DollarSign, Wallet, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SnapshotHealth {
  aave: { online: boolean; count: number; detail: string };
  bybit: { online: boolean; count: number; detail: string };
  cian: { online: boolean; count: number; detail: string };
  mcp: { online: boolean; count: number; detail: string };
  defillama: { online: boolean; count: number; detail: string };
  prices: { online: boolean; count: number; detail: string };
  wallet: { online: boolean; count: number; detail: string };
  collectionTimeMs: number;
  errors: string[];
}

const SOURCES = [
  { key: 'aave', name: 'Aave V3', icon: TrendingUp, type: 'On-chain', typeColor: 'bg-blue-500/8 text-blue-400 border-blue-500/20', description: 'Lending/borrowing rates via PoolDataProvider' },
  { key: 'bybit', name: 'Bybit Earn', icon: Coins, type: 'REST API', typeColor: 'bg-yellow-500/8 text-yellow-400 border-yellow-500/20', description: 'OnChain earn products via Bybit API' },
  { key: 'cian', name: 'CIAN Protocol', icon: Vault, type: 'On-chain + REST', typeColor: 'bg-emerald-500/8 text-emerald-400 border-emerald-500/20', description: 'ERC4626 vaults via REST + on-chain' },
  { key: 'mcp', name: 'MCP Scaffold', icon: Network, type: 'MCP stdio', typeColor: 'bg-purple-500/8 text-purple-400 border-purple-500/20', description: 'Mantle Agent Scaffold via stdio subprocess' },
  { key: 'defillama', name: 'DefiLlama', icon: Globe, type: 'REST API', typeColor: 'bg-yellow-500/8 text-yellow-400 border-yellow-500/20', description: 'Yield pools aggregator across Mantle' },
  { key: 'prices', name: 'Token Prices', icon: DollarSign, type: 'REST API', typeColor: 'bg-yellow-500/8 text-yellow-400 border-yellow-500/20', description: 'DefiLlama coins API for price feeds' },
  { key: 'wallet', name: 'Wallet Balances', icon: Wallet, type: 'On-chain', typeColor: 'bg-blue-500/8 text-blue-400 border-blue-500/20', description: 'Native MNT + ERC20 balances on-chain' },
] as const;

function parseHealth(data: Record<string, unknown>): SnapshotHealth {
  const d = data as Record<string, Record<string, unknown>>;
  const aaveReserves = (d.aave as Record<string, unknown[]>)?.reserves || [];
  const bybitProducts = (d.bybit as Record<string, unknown[]>)?.products || [];
  const cianVaults = (d.cian as Record<string, unknown[]>)?.vaults || [];
  const mcpMarkets = (d.mcp as Record<string, unknown[]>)?.lendingMarkets || [];
  const mcpChain = (d.mcp as Record<string, unknown>)?.chainStatus;
  const pools = ((d.yields as Record<string, unknown[]>)?.mantlePools || []);
  const prices = (d.prices as unknown as unknown[]) || [];
  const balances = ((d.wallet as Record<string, unknown[]>)?.balances || []);
  const meta = (d.metadata as Record<string, unknown>) || {};

  return {
    aave: { online: aaveReserves.length > 0, count: aaveReserves.length, detail: `${aaveReserves.length} reserves` },
    bybit: { online: bybitProducts.length > 0, count: bybitProducts.length, detail: `${bybitProducts.length} products` },
    cian: { online: cianVaults.length > 0, count: cianVaults.length, detail: `${cianVaults.length} vaults` },
    mcp: { online: mcpMarkets.length > 0 || mcpChain !== null, count: mcpMarkets.length, detail: `${mcpMarkets.length} lending markets` },
    defillama: { online: pools.length > 0, count: pools.length, detail: `${pools.length} pools` },
    prices: { online: prices.length > 0, count: prices.length, detail: `${prices.length} tokens` },
    wallet: { online: balances.length > 0, count: balances.length, detail: `${balances.length} balances` },
    collectionTimeMs: (meta.collectionTimeMs as number) || 0,
    errors: (meta.errors as string[]) || [],
  };
}

export default function SourcesPage() {
  const [health, setHealth] = useState<SnapshotHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/snapshot?wallet=0x0000000000000000000000000000000000000001');
      const data = await res.json();
      setHealth(parseHealth(data));
      setLastUpdated(new Date());
    } catch {
      // fail silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  const onlineCount = health ? SOURCES.filter(s => health[s.key as keyof SnapshotHealth] && (health[s.key as keyof SnapshotHealth] as { online: boolean }).online).length : 0;

  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Hero */}
        <div className="hero-card mb-6 animate-in">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="gradient-text-hero">Data Sources</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Real-time health status of all 7 data collectors
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={() => fetchHealth(true)}
                disabled={refreshing}
                className="btn-glow text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Health Summary */}
        {health && (
          <div className="grid grid-cols-3 gap-4 mb-6 animate-in stagger-1">
            <div className="stat-card">
              <div className="stat-label mb-1">Sources Online</div>
              <div className="flex items-baseline gap-1">
                <span className={cn('stat-value', onlineCount === 7 ? 'stat-value-green' : 'text-yellow-400')}>
                  {onlineCount}/7
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label mb-1">Collection Time</div>
              <div className="stat-value">{health.collectionTimeMs}ms</div>
            </div>
            <div className="stat-card">
              <div className="stat-label mb-1">Errors</div>
              <div className={cn('stat-value', health.errors.length > 0 ? 'text-destructive' : 'stat-value-green')}>
                {health.errors.length}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
            <p className="text-sm text-muted-foreground mt-4">Fetching data sources...</p>
          </div>
        )}

        {/* Source Cards Grid */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SOURCES.map((source, i) => {
              const status = health[source.key as keyof SnapshotHealth] as { online: boolean; count: number; detail: string };
              const Icon = source.icon;
              return (
                <div
                  key={source.key}
                  className={cn(
                    'mantis-card-premium border-l-[3px] animate-in',
                    status.online ? 'border-l-primary/50' : 'border-l-destructive/50',
                    `stagger-${Math.min(i + 1, 5)}`
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center',
                        status.online ? 'bg-primary/10' : 'bg-destructive/10'
                      )}>
                        <Icon className={cn('w-4.5 h-4.5', status.online ? 'text-primary' : 'text-destructive')} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{source.name}</h3>
                        <p className="text-[10px] text-muted-foreground">{source.description}</p>
                      </div>
                    </div>
                    {status.online ? (
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <Badge variant="outline" className={cn('text-[0.6rem]', source.typeColor)}>
                      {source.type}
                    </Badge>
                    <Badge variant="outline" className={cn(
                      'text-[0.6rem]',
                      status.online
                        ? 'border-primary/20 bg-primary/8 text-primary'
                        : 'border-destructive/20 bg-destructive/8 text-destructive'
                    )}>
                      {status.online ? 'Online' : 'Offline'}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{status.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Errors */}
        {health && health.errors.length > 0 && (
          <div className="mt-6 mantis-card-premium border-l-[3px] border-l-destructive/50">
            <h3 className="section-header text-destructive mb-3">Collection Errors</h3>
            <div className="space-y-1">
              {health.errors.map((err, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">{err}</p>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
