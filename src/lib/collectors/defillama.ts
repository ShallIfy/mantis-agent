import type { DefiLlamaPool } from '@/lib/types';

// Simple in-memory cache
let poolsCache: { data: DefiLlamaPool[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getMantleYieldPools(): Promise<DefiLlamaPool[]> {
  // Check cache
  if (poolsCache && Date.now() - poolsCache.timestamp < CACHE_TTL) {
    return poolsCache.data;
  }

  const res = await fetch('https://yields.llama.fi/pools', {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`DefiLlama API error: ${res.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pools: DefiLlamaPool[] = (json.data || [] as any[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.chain === 'Mantle' && p.apy > 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({
      pool: p.pool as string,
      chain: p.chain as string,
      project: p.project as string,
      symbol: p.symbol as string,
      tvlUsd: p.tvlUsd as number,
      apy: p.apy as number,
      apyBase: (p.apyBase as number) ?? null,
      apyReward: (p.apyReward as number) ?? null,
    }))
    .sort((a: DefiLlamaPool, b: DefiLlamaPool) => b.apy - a.apy);

  poolsCache = { data: pools, timestamp: Date.now() };
  return pools;
}

export async function getMantleTVL(): Promise<number> {
  const res = await fetch('https://api.llama.fi/v2/historicalChainTvl/Mantle');
  if (!res.ok) return 0;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return 0;

  return data[data.length - 1]?.tvl || 0;
}
