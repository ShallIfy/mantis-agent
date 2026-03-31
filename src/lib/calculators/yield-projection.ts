import { formatUnits } from 'viem';
import { publicClient } from '@/lib/chain/config';
import { CIAN_VAULTS, TOKENS } from '@/lib/chain/contracts';
import { buildStateSnapshot } from '@/lib/collectors';
import { buildPriceMap } from '@/lib/collectors/prices';

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export interface PositionProjection {
  protocol: 'aave' | 'cian';
  asset: string;
  type: 'supply' | 'borrow' | 'vault';
  amountUSD: number;
  poolTotalUSD: number;
  userSharePercent: number;
  positionAPY: number;
  projectedAnnualYieldUSD: number;
}

export interface PortfolioProjection {
  timestamp: number;
  walletAddress: string;
  positions: PositionProjection[];
  totalValueUSD: number;
  blendedAPY: number;
  projectedYield: {
    daily: number;
    monthly: number;
    annual: number;
  };
  netYield: {
    supplyIncomeAnnual: number;
    borrowCostAnnual: number;
    netAnnual: number;
    netMonthly: number;
    netDaily: number;
  };
  summary: string;
}

// ═══════════════════════════════════════════════
// CIAN ERC4626 USER BALANCE FETCHER
// ═══════════════════════════════════════════════

const ERC4626_USER_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;

export interface CianUserPosition {
  vaultSymbol: string;
  vaultAddress: string;
  assetsFormatted: number;
  decimals: number;
}

export async function getCianUserPositions(wallet: string): Promise<CianUserPosition[]> {
  const positions: CianUserPosition[] = [];
  const vaultEntries = Object.entries(CIAN_VAULTS) as [string, string][];

  const calls = vaultEntries.map(async ([symbol, address]) => {
    try {
      const [shares, decimals] = await Promise.all([
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: ERC4626_USER_ABI,
          functionName: 'balanceOf',
          args: [wallet as `0x${string}`],
        }),
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: ERC4626_USER_ABI,
          functionName: 'decimals',
        }),
      ]);

      if (shares === 0n) return null;

      const assets = await publicClient.readContract({
        address: address as `0x${string}`,
        abi: ERC4626_USER_ABI,
        functionName: 'convertToAssets',
        args: [shares],
      });

      return {
        vaultSymbol: symbol,
        vaultAddress: address,
        assetsFormatted: Number(formatUnits(assets, Number(decimals))),
        decimals: Number(decimals),
      };
    } catch {
      return null;
    }
  });

  const results = await Promise.all(calls);
  for (const r of results) {
    if (r) positions.push(r);
  }
  return positions;
}

// ═══════════════════════════════════════════════
// MAIN CALCULATOR
// ═══════════════════════════════════════════════

// Map CIAN vault symbols to their underlying token addresses for price lookup
const CIAN_UNDERLYING: Record<string, string> = {
  USDT0: TOKENS.USDT0,
  USDC: TOKENS.USDC,
};

export async function calculateYieldProjection(
  walletAddress: string
): Promise<PortfolioProjection> {
  const [snapshot, cianUserPositions] = await Promise.all([
    buildStateSnapshot(walletAddress),
    getCianUserPositions(walletAddress),
  ]);

  const priceMap = buildPriceMap(snapshot.prices);
  const positions: PositionProjection[] = [];

  // ── Aave Supply Positions ──
  for (const pos of snapshot.aave.positions) {
    const reserve = snapshot.aave.reserves.find(r => r.symbol === pos.symbol);
    if (!reserve) continue;
    const price = priceMap.get(pos.address.toLowerCase()) || 0;

    if (pos.suppliedUSD > 0) {
      const poolTotalUSD = Number(reserve.totalSupply) * price;

      positions.push({
        protocol: 'aave',
        asset: pos.symbol,
        type: 'supply',
        amountUSD: round(pos.suppliedUSD),
        poolTotalUSD: round(poolTotalUSD),
        userSharePercent: poolTotalUSD > 0
          ? round((pos.suppliedUSD / poolTotalUSD) * 100, 6)
          : 0,
        positionAPY: round(reserve.supplyAPY),
        projectedAnnualYieldUSD: round(pos.suppliedUSD * (reserve.supplyAPY / 100)),
      });
    }

    if (pos.borrowedUSD > 0) {
      const poolTotalBorrowUSD = Number(reserve.totalBorrow) * price;

      positions.push({
        protocol: 'aave',
        asset: pos.symbol,
        type: 'borrow',
        amountUSD: round(pos.borrowedUSD),
        poolTotalUSD: round(poolTotalBorrowUSD),
        userSharePercent: poolTotalBorrowUSD > 0
          ? round((pos.borrowedUSD / poolTotalBorrowUSD) * 100, 6)
          : 0,
        positionAPY: round(-reserve.borrowAPY),
        projectedAnnualYieldUSD: round(-(pos.borrowedUSD * (reserve.borrowAPY / 100))),
      });
    }
  }

  // ── CIAN Vault Positions ──
  for (const cianPos of cianUserPositions) {
    const vault = snapshot.cian.vaults.find(
      v => v.poolAddress.toLowerCase() === cianPos.vaultAddress.toLowerCase()
    );
    if (!vault) continue;

    const underlyingAddress = CIAN_UNDERLYING[cianPos.vaultSymbol];
    const price = underlyingAddress
      ? (priceMap.get(underlyingAddress.toLowerCase()) || 1)
      : 1;

    const amountUSD = cianPos.assetsFormatted * price;
    const effectiveAPY = vault.netApy !== null ? vault.netApy : vault.apy;

    positions.push({
      protocol: 'cian',
      asset: `${vault.poolName}`,
      type: 'vault',
      amountUSD: round(amountUSD),
      poolTotalUSD: round(vault.tvlUsd),
      userSharePercent: vault.tvlUsd > 0
        ? round((amountUSD / vault.tvlUsd) * 100, 6)
        : 0,
      positionAPY: round(effectiveAPY),
      projectedAnnualYieldUSD: round(amountUSD * (effectiveAPY / 100)),
    });
  }

  // ── Portfolio Aggregation ──
  const supplyPositions = positions.filter(p => p.type === 'supply' || p.type === 'vault');
  const borrowPositions = positions.filter(p => p.type === 'borrow');

  const totalSupplyValue = supplyPositions.reduce((s, p) => s + p.amountUSD, 0);

  const supplyIncomeAnnual = supplyPositions.reduce(
    (s, p) => s + p.projectedAnnualYieldUSD, 0
  );
  const borrowCostAnnual = Math.abs(
    borrowPositions.reduce((s, p) => s + p.projectedAnnualYieldUSD, 0)
  );
  const netAnnual = supplyIncomeAnnual - borrowCostAnnual;

  const blendedAPY = totalSupplyValue > 0
    ? (supplyIncomeAnnual / totalSupplyValue) * 100
    : 0;

  // ── Summary ──
  const parts: string[] = [];
  if (supplyPositions.length > 0) {
    parts.push(
      `${supplyPositions.length} earning position(s) worth $${totalSupplyValue.toFixed(2)} at ~${blendedAPY.toFixed(2)}% blended APY`
    );
  }
  if (borrowPositions.length > 0) {
    const totalBorrow = borrowPositions.reduce((s, p) => s + p.amountUSD, 0);
    parts.push(
      `${borrowPositions.length} borrow position(s) worth $${totalBorrow.toFixed(2)} costing $${borrowCostAnnual.toFixed(2)}/year`
    );
  }
  if (positions.length === 0) {
    parts.push('No active DeFi positions found. Deposit into Aave V3 or CIAN vaults on Mantle to start earning yield.');
  }
  parts.push(
    `Net projected yield: $${netAnnual.toFixed(2)}/year | $${(netAnnual / 12).toFixed(2)}/month | $${(netAnnual / 365).toFixed(4)}/day`
  );

  return {
    timestamp: Date.now(),
    walletAddress,
    positions,
    totalValueUSD: round(totalSupplyValue),
    blendedAPY: round(blendedAPY),
    projectedYield: {
      daily: round(netAnnual / 365, 4),
      monthly: round(netAnnual / 12),
      annual: round(netAnnual),
    },
    netYield: {
      supplyIncomeAnnual: round(supplyIncomeAnnual),
      borrowCostAnnual: round(borrowCostAnnual),
      netAnnual: round(netAnnual),
      netMonthly: round(netAnnual / 12),
      netDaily: round(netAnnual / 365, 4),
    },
    summary: parts.join('. ') + '.',
  };
}

function round(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
