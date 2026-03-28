import { publicClient } from '@/lib/chain/config';
import { getAaveReserves, getAaveUserAccount, getAaveUserPositions } from './aave';
import { getMantleYieldPools } from './defillama';
import { getTokenPrices, buildPriceMap } from './prices';
import { getWalletBalances } from './wallet';
import { getBybitEarnProducts } from './bybit';
import { getCianVaults } from './cian';
import { getMcpData } from './mcp';
import type { StateSnapshot } from '@/lib/types';

export async function buildStateSnapshot(walletAddress: string): Promise<StateSnapshot> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Get block number
  let blockNumber = 0n;
  try {
    blockNumber = await publicClient.getBlockNumber();
  } catch (e) {
    errors.push(`Block number fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fetch prices first (needed by other collectors)
  let prices = await getTokenPrices().catch(e => {
    errors.push(`Prices fetch failed: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  });

  const priceMap = buildPriceMap(prices);

  // Fetch everything else in parallel
  const [reservesResult, accountResult, positionsResult, walletResult, poolsResult, bybitResult, cianResult, mcpResult] =
    await Promise.allSettled([
      getAaveReserves(),
      getAaveUserAccount(walletAddress),
      getAaveUserPositions(walletAddress, priceMap),
      getWalletBalances(walletAddress, priceMap),
      getMantleYieldPools(),
      getBybitEarnProducts(),
      getCianVaults(),
      getMcpData(),
    ]);

  const reserves = reservesResult.status === 'fulfilled' ? reservesResult.value : [];
  if (reservesResult.status === 'rejected') {
    errors.push(`Aave reserves failed: ${reservesResult.reason}`);
  }

  const account = accountResult.status === 'fulfilled'
    ? accountResult.value
    : { totalCollateralUSD: 0, totalDebtUSD: 0, availableBorrowsUSD: 0, healthFactor: Infinity, ltv: 0, liquidationThreshold: 0 };
  if (accountResult.status === 'rejected') {
    errors.push(`Aave account failed: ${accountResult.reason}`);
  }

  const positions = positionsResult.status === 'fulfilled' ? positionsResult.value : [];
  if (positionsResult.status === 'rejected') {
    errors.push(`Aave positions failed: ${positionsResult.reason}`);
  }

  const walletBalances = walletResult.status === 'fulfilled' ? walletResult.value : [];
  if (walletResult.status === 'rejected') {
    errors.push(`Wallet balances failed: ${walletResult.reason}`);
  }

  const pools = poolsResult.status === 'fulfilled' ? poolsResult.value : [];
  if (poolsResult.status === 'rejected') {
    errors.push(`DefiLlama pools failed: ${poolsResult.reason}`);
  }

  const bybitProducts = bybitResult.status === 'fulfilled' ? bybitResult.value : [];
  if (bybitResult.status === 'rejected') {
    errors.push(`Bybit Earn failed: ${bybitResult.reason}`);
  }

  const cianVaults = cianResult.status === 'fulfilled' ? cianResult.value : [];
  if (cianResult.status === 'rejected') {
    errors.push(`CIAN vaults failed: ${cianResult.reason}`);
  }

  const mcpData = mcpResult.status === 'fulfilled' ? mcpResult.value : { lendingMarkets: [], chainStatus: null };
  if (mcpResult.status === 'rejected') {
    errors.push(`MCP scaffold failed: ${mcpResult.reason}`);
  }

  const totalWalletValue = walletBalances.reduce((sum, b) => sum + b.valueUSD, 0)
    + account.totalCollateralUSD;

  return {
    timestamp: Date.now(),
    blockNumber: Number(blockNumber),
    wallet: {
      address: walletAddress,
      balances: walletBalances,
      totalValueUSD: totalWalletValue,
    },
    aave: {
      account,
      positions,
      reserves,
    },
    yields: {
      mantlePools: pools,
      topByAPY: pools.slice(0, 10),
    },
    bybit: {
      products: bybitProducts,
    },
    cian: {
      vaults: cianVaults,
    },
    mcp: mcpData,
    prices,
    metadata: {
      collectionTimeMs: Date.now() - startTime,
      errors,
    },
  };
}
