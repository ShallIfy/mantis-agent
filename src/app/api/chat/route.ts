import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { buildStateSnapshot } from '@/lib/collectors';
import { mcpCallTool } from '@/lib/mcp/client';
import { calculateYieldProjection } from '@/lib/calculators/yield-projection';
import { MANTIS_CHAT_SYSTEM_PROMPT } from '@/lib/agent/prompts';

export const maxDuration = 120;

// ═══════════════════════════════════════════════
// MCP TOOLS — 19 tools grouped by Mantle Agent Skill
// ═══════════════════════════════════════════════

const mcpTools = {
  // ── Network Primer ──
  mantle_getChainInfo: tool({
    description: 'Get static chain configuration for Mantle mainnet or sepolia (chain ID, RPC URL, WMNT address, explorer, bridge, faucets)',
    inputSchema: z.object({
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getChainInfo', args),
  }),
  mantle_getChainStatus: tool({
    description: 'Get live block height, gas price (wei & gwei), and sync status from Mantle RPC',
    inputSchema: z.object({
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getChainStatus', args),
  }),

  // ── Portfolio Analyst ──
  mantle_getBalance: tool({
    description: 'Get native MNT balance for a wallet address on Mantle',
    inputSchema: z.object({
      address: z.string().describe('Wallet address (0x...)'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getBalance', args),
  }),
  mantle_getTokenBalances: tool({
    description: 'Get ERC-20 token balances for a wallet. Provide token symbols like ["WETH","USDC","WMNT"] or addresses.',
    inputSchema: z.object({
      address: z.string().describe('Wallet address'),
      tokens: z.array(z.string()).describe('Token symbols or addresses'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getTokenBalances', args),
  }),
  mantle_getAllowances: tool({
    description: 'Check ERC-20 allowances for token/spender pairs. Useful to check if a protocol is approved to spend tokens.',
    inputSchema: z.object({
      owner: z.string().describe('Owner wallet address'),
      pairs: z.array(z.object({
        token: z.string().describe('Token symbol or address'),
        spender: z.string().describe('Spender address'),
      })).describe('Array of {token, spender} pairs'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getAllowances', args),
  }),

  // ── Registry Navigator ──
  mantle_getTokenInfo: tool({
    description: 'Get ERC-20 token metadata: name, symbol, decimals, total supply',
    inputSchema: z.object({
      token: z.string().describe('Token symbol (e.g. WETH, USDC) or contract address'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getTokenInfo', args),
  }),
  mantle_getTokenPrices: tool({
    description: 'Get live token prices in USD or MNT. Uses DexScreener + DefiLlama fallback.',
    inputSchema: z.object({
      tokens: z.array(z.string()).describe('Token symbols or addresses, e.g. ["WETH","USDC","MNT"]'),
      base_currency: z.enum(['usd', 'mnt']).optional().default('usd'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getTokenPrices', args),
  }),
  mantle_resolveToken: tool({
    description: 'Resolve a token symbol to its contract address on Mantle. Cross-checks against the canonical Mantle token list.',
    inputSchema: z.object({
      symbol: z.string().describe('Token symbol to resolve (e.g. USDC, WETH, MNT, mETH, wrsETH)'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_resolveToken', args),
  }),

  // ── DeFi Operator ──
  mantle_getSwapQuote: tool({
    description: 'Get a DEX swap quote on Mantle (Agni Finance or Merchant Moe). Returns estimated output, price impact, route.',
    inputSchema: z.object({
      token_in: z.string().describe('Input token symbol or address'),
      token_out: z.string().describe('Output token symbol or address'),
      amount_in: z.string().describe('Human-readable input amount (e.g. "100" for 100 USDC)'),
      provider: z.enum(['agni', 'merchant_moe', 'best']).optional().default('best'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getSwapQuote', args),
  }),
  mantle_getPoolLiquidity: tool({
    description: 'Get pool reserves and liquidity for a specific DEX pool on Mantle',
    inputSchema: z.object({
      pool_address: z.string().describe('Pool contract address'),
      provider: z.enum(['agni', 'merchant_moe']).optional(),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getPoolLiquidity', args),
  }),
  mantle_getPoolOpportunities: tool({
    description: 'Find and rank DEX pool candidates for a token pair on Mantle. Returns pools sorted by liquidity and volume.',
    inputSchema: z.object({
      token_a: z.string().describe('First token symbol or address'),
      token_b: z.string().describe('Second token symbol or address'),
      provider: z.enum(['agni', 'merchant_moe', 'all']).optional().default('all'),
      max_results: z.number().min(1).max(10).optional().default(5),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getPoolOpportunities', args),
  }),
  mantle_getProtocolTvl: tool({
    description: 'Get protocol-level TVL for Mantle DeFi protocols (Agni, Merchant Moe, or all)',
    inputSchema: z.object({
      protocol: z.enum(['agni', 'merchant_moe', 'all']).optional().default('all'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getProtocolTvl', args),
  }),
  mantle_getLendingMarkets: tool({
    description: 'Get Aave V3 lending market data on Mantle: supply APY, borrow APY, TVL, LTV, liquidation threshold for all assets',
    inputSchema: z.object({
      protocol: z.enum(['aave_v3', 'aave', 'all']).optional().default('all'),
      asset: z.string().optional().describe('Filter by specific asset symbol'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_getLendingMarkets', args),
  }),

  // ── Registry Navigator (cont.) ──
  mantle_resolveAddress: tool({
    description: 'Resolve a contract name/alias to its address on Mantle (e.g. "aave_pool", "wmnt", "agni_router")',
    inputSchema: z.object({
      identifier: z.string().describe('Registry key, alias, or label (e.g. "aave_pool", "wmnt")'),
      category: z.enum(['system', 'token', 'bridge', 'defi', 'any']).optional().default('any'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_resolveAddress', args),
  }),
  mantle_validateAddress: tool({
    description: 'Validate an Ethereum address: check format, checksum, and optionally verify it has deployed code (is a contract)',
    inputSchema: z.object({
      address: z.string().describe('Address to validate'),
      check_code: z.boolean().optional().default(false).describe('Check if address has deployed bytecode'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_validateAddress', args),
  }),

  // ── Data Indexer ──
  mantle_querySubgraph: tool({
    description: 'Execute a GraphQL query against a Mantle indexer/subgraph endpoint',
    inputSchema: z.object({
      endpoint: z.string().describe('GraphQL endpoint URL'),
      query: z.string().describe('GraphQL query document'),
      variables: z.record(z.string(), z.unknown()).optional().describe('GraphQL variables'),
    }),
    execute: async (args) => mcpCallTool('mantle_querySubgraph', args),
  }),
  mantle_queryIndexerSql: tool({
    description: 'Execute a read-only SQL query against a Mantle indexer API',
    inputSchema: z.object({
      endpoint: z.string().describe('SQL indexer endpoint URL'),
      query: z.string().describe('Read-only SQL query'),
      params: z.record(z.string(), z.unknown()).optional().describe('Query parameters'),
    }),
    execute: async (args) => mcpCallTool('mantle_queryIndexerSql', args),
  }),

  // ── Readonly Debugger ──
  mantle_checkRpcHealth: tool({
    description: 'Check Mantle RPC endpoint health: reachability, chain ID match, block number, latency',
    inputSchema: z.object({
      rpc_url: z.string().optional().describe('RPC URL to test (defaults to configured RPC)'),
      network: z.enum(['mainnet', 'sepolia']).optional().default('mainnet'),
    }),
    execute: async (args) => mcpCallTool('mantle_checkRpcHealth', args),
  }),
  mantle_probeEndpoint: tool({
    description: 'Probe a JSON-RPC endpoint with a minimal method call (eth_blockNumber, eth_chainId, eth_getBalance)',
    inputSchema: z.object({
      rpc_url: z.string().describe('RPC endpoint to probe'),
      method: z.enum(['eth_chainId', 'eth_blockNumber', 'eth_getBalance']).optional().default('eth_blockNumber'),
    }),
    execute: async (args) => mcpCallTool('mantle_probeEndpoint', args),
  }),
};

// ═══════════════════════════════════════════════
// MANTIS TOOLS — native analysis tools
// ═══════════════════════════════════════════════

const mantisTools = {
  mantis_yield_projection: tool({
    description: 'Calculate projected yield for a wallet across all DeFi positions on Mantle (Aave V3 supply/borrow + CIAN vaults). Returns per-position share %, APY, projected daily/monthly/annual earnings, and net yield after borrow costs. Use this when the user asks about their yield, projected earnings, portfolio APY, or how much they are earning.',
    inputSchema: z.object({
      wallet: z.string().optional().describe('Wallet address (0x...). Uses demo wallet if not provided.'),
    }),
    execute: async (args) => {
      const wallet = args.wallet
        || process.env.NEXT_PUBLIC_DEMO_WALLET
        || '0x0000000000000000000000000000000000000001';
      return calculateYieldProjection(wallet);
    },
  }),
};

// ═══════════════════════════════════════════════
// CHAT ROUTE
// ═══════════════════════════════════════════════

export async function POST(req: Request) {
  const { messages: uiMessages } = await req.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = (uiMessages as any[]).map((m: any) => ({
    role: m.role as 'user' | 'assistant',
    content: m.parts
      ?.filter((p: any) => p.type === 'text')
      .map((p: any) => p.text || '')
      .join('') || m.content || '',
  }));

  // Fetch fresh snapshot for context
  const wallet = process.env.NEXT_PUBLIC_DEMO_WALLET || '0x0000000000000000000000000000000000000001';

  let liveDataContext = '';
  try {
    const snapshot = await buildStateSnapshot(wallet);

    const reserveLines = snapshot.aave.reserves
      .filter(r => r.supplyAPY > 0 || r.borrowAPY > 0)
      .map(r => `- ${r.symbol}: Supply ${r.supplyAPY.toFixed(2)}% / Borrow ${r.borrowAPY.toFixed(2)}%`)
      .join('\n');

    const yieldLines = snapshot.yields.topByAPY
      .slice(0, 8)
      .map(p => `- ${p.project}/${p.symbol}: ${p.apy.toFixed(2)}% APY, TVL $${(p.tvlUsd / 1e6).toFixed(1)}M`)
      .join('\n');

    const priceLines = snapshot.prices
      .map(p => `- ${p.symbol}: $${p.priceUSD.toFixed(2)}`)
      .join('\n');

    const positionLines = snapshot.aave.positions.length > 0
      ? snapshot.aave.positions.map(p =>
        `- ${p.symbol}: Supplied $${p.suppliedUSD.toFixed(2)}, Borrowed $${p.borrowedUSD.toFixed(2)}`
      ).join('\n')
      : 'No active positions.';

    liveDataContext = `

## Live Data (${new Date(snapshot.timestamp).toISOString()}, Block ${snapshot.blockNumber})

### Wallet: ${snapshot.wallet.address}
Total Value: $${snapshot.wallet.totalValueUSD.toFixed(2)}
Health Factor: ${snapshot.aave.account.healthFactor === null ? 'N/A' : snapshot.aave.account.healthFactor === Infinity ? '∞' : snapshot.aave.account.healthFactor.toFixed(4)}

### Active Positions
${positionLines}

### Aave V3 Mantle Rates
${reserveLines}

### Top Mantle Yield Pools
${yieldLines}

### Token Prices
${priceLines}

### Bybit Earn OnChain Products
${snapshot.bybit?.products?.length ? snapshot.bybit.products.map(p => `- ${p.coin}: ${p.estimateApr.toFixed(2)}% APR (${p.duration})${p.swapCoin ? ` → ${p.swapCoin}` : ''}`).join('\n') : 'No data available.'}

### CIAN Yield Layer Vaults
${snapshot.cian?.vaults?.length ? snapshot.cian.vaults.map(v => `- ${v.poolName}: APY ${v.apy.toFixed(2)}%${v.netApy !== null ? ` (Net: ${v.netApy.toFixed(2)}%)` : ''}, TVL $${(v.tvlUsd / 1e6).toFixed(1)}M`).join('\n') : 'No data available.'}`;
  } catch {
    liveDataContext = '\n\n(Live data temporarily unavailable. Use MCP tools to fetch fresh data.)';
  }

  const systemPrompt = MANTIS_CHAT_SYSTEM_PROMPT + `

## Agent Skills & Tools (20 tools across 6 Mantle Agent Skills)

**CRITICAL**: ALWAYS use the appropriate tool for on-chain data. NEVER answer from memory. NEVER say "I don't have this data". CALL THE TOOL.
Present results with clear formatting. If a tool errors, explain and suggest alternatives.

### Network Primer — chain info, gas prices, network status
- mantle_getChainInfo — chain config (ID, RPC, explorer, bridge)
- mantle_getChainStatus — live block height + gas price
Examples: "What's gas price?" → mantle_getChainStatus | "What chain ID?" → mantle_getChainInfo

### Portfolio Analyst — wallet balances, positions, yield analysis
- mantle_getBalance — native MNT balance
- mantle_getTokenBalances — ERC-20 balances for a wallet
- mantle_getAllowances — check token approvals
- mantle_getTokenPrices — live USD prices (DexScreener + DefiLlama)
- mantis_yield_projection — projected yield, share %, blended APY, earnings
Examples: "Check my balance" → mantle_getBalance | "My projected yield?" → mantis_yield_projection | "How much am I earning?" → mantis_yield_projection

### DeFi Operator — swaps, pools, lending, TVL
- mantle_getSwapQuote — DEX swap quotes (Agni, Merchant Moe)
- mantle_getPoolLiquidity — pool reserves & metadata
- mantle_getPoolOpportunities — rank pool candidates for token pair
- mantle_getLendingMarkets — Aave V3 supply/borrow APY, LTV
- mantle_getProtocolTvl — protocol-level TVL
Examples: "Swap 100 USDC to WETH" → mantle_getSwapQuote | "Aave rates?" → mantle_getLendingMarkets | "TVL of Agni?" → mantle_getProtocolTvl

### Registry Navigator — resolve addresses, token info
- mantle_resolveAddress — name/alias → contract address
- mantle_validateAddress — format check + bytecode verification
- mantle_resolveToken — token symbol → contract address
- mantle_getTokenInfo — ERC-20 metadata (name, decimals, supply)
Examples: "USDC address?" → mantle_resolveToken | "Is this a contract?" → mantle_validateAddress(check_code=true)

### Data Indexer — custom subgraph & SQL queries
- mantle_querySubgraph — execute GraphQL against indexer
- mantle_queryIndexerSql — execute read-only SQL
Examples: "Query the Aave subgraph" → mantle_querySubgraph

### Readonly Debugger — RPC diagnostics
- mantle_checkRpcHealth — health check (reachability, chain ID, latency)
- mantle_probeEndpoint — probe JSON-RPC with minimal call
Examples: "Is the RPC healthy?" → mantle_checkRpcHealth
` + liveDataContext;

  const anthropic = createAnthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages,
    tools: { ...mcpTools, ...mantisTools },
    stopWhen: stepCountIs(5),
    providerOptions: {
      anthropic: {
        thinking: { type: 'adaptive' },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
