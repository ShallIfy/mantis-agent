import { mcpGetLendingMarkets, mcpGetSwapQuote, mcpGetChainStatus } from '@/lib/mcp/client';

export interface McpLendingMarket {
  protocol: string;
  asset: string;
  supplyApy: number;
  borrowApy: number;
  totalSupply: string;
  totalBorrow: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface McpSwapQuote {
  protocol: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface McpData {
  lendingMarkets: McpLendingMarket[];
  chainStatus: {
    blockNumber: number;
    gasPrice: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  } | null;
}

let cache: { data: McpData; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 min

export async function getMcpData(): Promise<McpData> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  const [lendingResult, chainResult] = await Promise.allSettled([
    mcpGetLendingMarkets(),
    mcpGetChainStatus(),
  ]);

  const lendingRaw = lendingResult.status === 'fulfilled' ? lendingResult.value : null;
  // MCP returns markets directly as array or wrapped in {markets: [...]}
  const lendingMarkets = lendingRaw
    ? (Array.isArray(lendingRaw) ? lendingRaw : Array.isArray(lendingRaw?.markets) ? lendingRaw.markets : [])
    : [];

  const chainStatus = chainResult.status === 'fulfilled'
    ? chainResult.value
    : null;

  const data: McpData = {
    lendingMarkets,
    chainStatus,
  };

  cache = { data, timestamp: Date.now() };
  return data;
}

export async function getMcpSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<McpSwapQuote | null> {
  try {
    const result = await mcpGetSwapQuote({ tokenIn, tokenOut, amountIn });
    return result as McpSwapQuote;
  } catch {
    return null;
  }
}
