import { formatUnits } from 'viem';
import { publicClient } from '@/lib/chain/config';
import { AAVE_V3, TOKENS, TOKEN_DECIMALS, type TokenSymbol } from '@/lib/chain/contracts';
import { aaveDataProviderAbi } from '@/lib/chain/abis/aave-data-provider';
import { aavePoolAbi } from '@/lib/chain/abis/aave-pool';
import type { AaveReserveData, AaveAccountData, AaveUserPosition } from '@/lib/types';

const RAY = 10n ** 27n;
const SECONDS_PER_YEAR = 31536000;

function rayToAPY(rate: bigint): number {
  // Simple APR conversion: rate / RAY * 100
  return Number((rate * 10000n) / RAY) / 100;
}

export async function getAaveReserves(): Promise<AaveReserveData[]> {
  const reserves: AaveReserveData[] = [];
  const tokenEntries = Object.entries(TOKENS) as [TokenSymbol, string][];

  const calls = tokenEntries.map(([symbol, address]) =>
    publicClient.readContract({
      address: AAVE_V3.POOL_DATA_PROVIDER as `0x${string}`,
      abi: aaveDataProviderAbi,
      functionName: 'getReserveData',
      args: [address as `0x${string}`],
    }).then(data => ({ symbol, address, data }))
      .catch(() => null)
  );

  const results = await Promise.all(calls);

  for (const result of results) {
    if (!result) continue;
    const { symbol, address, data } = result;
    const [, , totalAToken, , totalVariableDebt, liquidityRate, variableBorrowRate] = data;

    const decimals = TOKEN_DECIMALS[symbol] || 18;

    reserves.push({
      symbol,
      address,
      supplyAPY: rayToAPY(liquidityRate),
      borrowAPY: rayToAPY(variableBorrowRate),
      totalSupply: formatUnits(totalAToken, decimals),
      totalBorrow: formatUnits(totalVariableDebt, decimals),
      utilizationRate: totalAToken > 0n
        ? Number((totalVariableDebt * 10000n) / totalAToken) / 100
        : 0,
      liquidityRate: liquidityRate.toString(),
      variableBorrowRate: variableBorrowRate.toString(),
    });
  }

  return reserves;
}

export async function getAaveUserAccount(wallet: string): Promise<AaveAccountData> {
  const data = await publicClient.readContract({
    address: AAVE_V3.POOL as `0x${string}`,
    abi: aavePoolAbi,
    functionName: 'getUserAccountData',
    args: [wallet as `0x${string}`],
  });

  const [totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor] = data;

  // Aave V3 base currency is USD with 8 decimals
  return {
    totalCollateralUSD: Number(formatUnits(totalCollateralBase, 8)),
    totalDebtUSD: Number(formatUnits(totalDebtBase, 8)),
    availableBorrowsUSD: Number(formatUnits(availableBorrowsBase, 8)),
    healthFactor: healthFactor === BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      ? Infinity
      : Number(formatUnits(healthFactor, 18)),
    ltv: Number(ltv) / 100,
    liquidationThreshold: Number(currentLiquidationThreshold) / 100,
  };
}

export async function getAaveUserPositions(
  wallet: string,
  prices: Map<string, number>
): Promise<AaveUserPosition[]> {
  const positions: AaveUserPosition[] = [];
  const tokenEntries = Object.entries(TOKENS) as [TokenSymbol, string][];

  const calls = tokenEntries.map(([symbol, address]) =>
    publicClient.readContract({
      address: AAVE_V3.POOL_DATA_PROVIDER as `0x${string}`,
      abi: aaveDataProviderAbi,
      functionName: 'getUserReserveData',
      args: [address as `0x${string}`, wallet as `0x${string}`],
    }).then(data => ({ symbol, address, data }))
      .catch(() => null)
  );

  const results = await Promise.all(calls);

  for (const result of results) {
    if (!result) continue;
    const { symbol, address, data } = result;
    const [currentATokenBalance, , currentVariableDebtTokenBalance, , , , , , usageAsCollateralEnabled] = data;

    // Skip tokens with no positions
    if (currentATokenBalance === 0n && currentVariableDebtTokenBalance === 0n) continue;

    const decimals = TOKEN_DECIMALS[symbol] || 18;
    const supplied = formatUnits(currentATokenBalance, decimals);
    const borrowed = formatUnits(currentVariableDebtTokenBalance, decimals);
    const price = prices.get(address.toLowerCase()) || 0;

    positions.push({
      symbol,
      address,
      supplied,
      suppliedUSD: Number(supplied) * price,
      borrowed,
      borrowedUSD: Number(borrowed) * price,
      usageAsCollateralEnabled,
    });
  }

  return positions;
}
