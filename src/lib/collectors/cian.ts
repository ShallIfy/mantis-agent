import { publicClient } from '@/lib/chain/config';
import { CIAN_VAULTS } from '@/lib/chain/contracts';
import type { CianVault } from '@/lib/types';

const CIAN_API_BASE = 'https://yieldlayer.cian.app/mantle/pool';

let cache: { data: CianVault[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

// Minimal ERC4626 ABI for on-chain reads
const ERC4626_ABI = [
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

async function fetchOnChainData(vaultAddress: string): Promise<{
  totalAssets: string | null;
  totalSupply: string | null;
}> {
  try {
    const [totalAssets, totalSupply] = await Promise.all([
      publicClient.readContract({
        address: vaultAddress as `0x${string}`,
        abi: ERC4626_ABI,
        functionName: 'totalAssets',
      }),
      publicClient.readContract({
        address: vaultAddress as `0x${string}`,
        abi: ERC4626_ABI,
        functionName: 'totalSupply',
      }),
    ]);
    return {
      totalAssets: totalAssets.toString(),
      totalSupply: totalSupply.toString(),
    };
  } catch {
    return { totalAssets: null, totalSupply: null };
  }
}

export async function getCianVaults(): Promise<CianVault[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  // Fetch REST API data
  const res = await fetch(`${CIAN_API_BASE}/home/vaults`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`CIAN API error: ${res.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();

  if (json.code !== 'ok' || !json.data) {
    throw new Error(`CIAN API: ${json.msg || 'unknown error'}`);
  }

  // Fetch vault details + on-chain data in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vaultPromises = json.data.map(async (v: any) => {
    // Fetch detail for net_apy and fee info
    let detail = null;
    try {
      const detailRes = await fetch(`${CIAN_API_BASE}/home/vault/${v.pool_address}`);
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        detail = detailJson.data;
      }
    } catch { /* skip detail */ }

    // Fetch on-chain ERC4626 data
    const onChain = await fetchOnChainData(v.pool_address);

    return {
      poolName: v.pool_name,
      poolAddress: v.pool_address,
      poolType: v.pool_type,
      apy: parseFloat(v.apy) || 0,
      apy7d: parseFloat(v.apy_7 || v.apy) || 0,
      netApy: detail ? parseFloat(detail.net_apy) || null : null,
      tvlUsd: parseFloat(v.tvl_usd) || 0,
      netTvlUsd: parseFloat(v.net_tvl_usd) || 0,
      depositCapacity: detail?.deposit_capacity ? parseFloat(detail.deposit_capacity) : null,
      minDeposit: detail?.conf?.min_deposit ? parseFloat(detail.conf.min_deposit) : null,
      minWithdraw: detail?.conf?.min_withdraw ? parseFloat(detail.conf.min_withdraw) : null,
      feePerformance: detail?.fee_info?.performance ? parseFloat(detail.fee_info.performance) : null,
      feeExit: detail?.fee_info?.exit ? parseFloat(detail.fee_info.exit) : null,
      totalAssets: onChain.totalAssets,
      totalSupply: onChain.totalSupply,
    } as CianVault;
  });

  const vaults: CianVault[] = await Promise.all(vaultPromises);

  cache = { data: vaults, timestamp: Date.now() };
  return vaults;
}

// Get specific CIAN vault addresses for Mantle
export function getCianVaultAddresses() {
  return CIAN_VAULTS;
}
