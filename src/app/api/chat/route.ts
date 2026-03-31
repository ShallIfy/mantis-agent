import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { buildStateSnapshot } from '@/lib/collectors';
import { mcpCallTool } from '@/lib/mcp/client';
import { calculateYieldProjection, getCianUserPositions } from '@/lib/calculators/yield-projection';
import { getBybitEarnProducts } from '@/lib/collectors/bybit';
import { getCianVaults } from '@/lib/collectors/cian';
import { getChatSystemPrompt } from '@/lib/agent/prompts';
import { proposeActions } from '@/lib/agent/executor';
import { TOKENS } from '@/lib/chain/contracts';
import { getAddress, createPublicClient, http } from 'viem';
import { mantle } from 'viem/chains';
import type { AgentAction, ProposedTransaction } from '@/lib/types';

export const maxDuration = 300;

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
// MANTIS TOOLS — native analysis, Bybit Earn, CIAN
// ═══════════════════════════════════════════════

const mantisTools = {
  // ── Wallet / Portfolio ──
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

  // ── Bybit Earn ──
  mantis_bybit_products: tool({
    description: 'Get all available Bybit Earn OnChain staking products. Returns APR, duration (Flexible/Fixed), min/max stake amounts, and swap coin. Covers USDT, USDC, ETH, METH, BTC, USDTB. Use this when the user asks about Bybit Earn rates, CeDeFi staking, or off-chain yield options.',
    inputSchema: z.object({
      coin: z.string().optional().describe('Filter by specific coin (e.g. USDT, ETH). Returns all coins if not provided.'),
    }),
    execute: async (args) => {
      const products = await getBybitEarnProducts();
      if (args.coin) {
        const filtered = products.filter(p => p.coin.toUpperCase() === args.coin!.toUpperCase());
        return { coin: args.coin, products: filtered, count: filtered.length };
      }
      return { products, count: products.length };
    },
  }),
  mantis_bybit_best_rate: tool({
    description: 'Find the best Bybit Earn rate for a specific coin. Returns the highest APR product with full details. Use when user asks "best rate for USDT" or "where to stake ETH on Bybit".',
    inputSchema: z.object({
      coin: z.string().describe('Coin symbol to find best rate for (e.g. USDT, ETH, USDC, BTC, METH)'),
    }),
    execute: async (args) => {
      const products = await getBybitEarnProducts();
      const filtered = products.filter(p => p.coin.toUpperCase() === args.coin.toUpperCase());
      if (filtered.length === 0) {
        return { error: `No Bybit Earn products found for ${args.coin}`, availableCoins: [...new Set(products.map(p => p.coin))] };
      }
      return { bestProduct: filtered[0], alternativeProducts: filtered.slice(1), totalOptions: filtered.length };
    },
  }),

  // ── CIAN Protocol ──
  mantis_cian_vaults: tool({
    description: 'Get all CIAN Yield Layer vaults on Mantle. Returns APY, Net APY (after fees), TVL, deposit capacity, fee structure, and on-chain ERC4626 data (totalAssets, totalSupply). Currently USDT0 and USDC vaults. Use when user asks about CIAN yields, vault APY, or DeFi vault options.',
    inputSchema: z.object({}),
    execute: async () => {
      const vaults = await getCianVaults();
      return { vaults, count: vaults.length };
    },
  }),
  mantis_cian_user_position: tool({
    description: 'Get a wallet\'s position in CIAN ERC4626 vaults on Mantle. Returns shares converted to underlying assets value for each vault the user has deposited into. Use when user asks about their CIAN positions or vault deposits.',
    inputSchema: z.object({
      wallet: z.string().optional().describe('Wallet address (0x...). Uses demo wallet if not provided.'),
    }),
    execute: async (args) => {
      const wallet = args.wallet
        || process.env.NEXT_PUBLIC_DEMO_WALLET
        || '0x0000000000000000000000000000000000000001';
      const [positions, vaults] = await Promise.all([
        getCianUserPositions(wallet),
        getCianVaults(),
      ]);
      const enriched = positions.map(p => {
        const vault = vaults.find(v => v.poolAddress.toLowerCase() === p.vaultAddress.toLowerCase());
        return { ...p, vaultAPY: vault?.apy ?? null, vaultNetAPY: vault?.netApy ?? null, vaultTVL: vault?.tvlUsd ?? null };
      });
      return { wallet, positions: enriched, count: enriched.length, hasPositions: enriched.length > 0 };
    },
  }),
};

// ═══════════════════════════════════════════════
// TRANSACTION TOOLS — propose on-chain actions
// ═══════════════════════════════════════════════

const SUPPORTED_TOKENS = Object.keys(TOKENS);

const simulationClient = createPublicClient({ chain: mantle, transport: http('https://rpc.mantle.xyz') });

// Simulate each tx via eth_call to catch reverts before proposing
async function simulateTransactions(
  txs: ProposedTransaction[],
  from: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Only simulate txs that are truly standalone (no prior approve/state dependency).
  // Withdraw and Borrow read on-chain state directly — everything else depends on
  // a preceding approve or supply tx that hasn't happened yet (eth_call is stateless).
  const simulatable = txs.filter(tx =>
    tx.label.startsWith('Withdraw ') || tx.label.startsWith('Borrow ')
  );

  for (const tx of simulatable) {
    try {
      await simulationClient.call({
        account: from as `0x${string}`,
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : 0n,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Match Aave error codes at word boundaries
      const aaveMatch = msg.match(/\b(error )?(\d{1,2})\b/i);
      const code = aaveMatch ? aaveMatch[2] : null;

      if (code === '36') {
        return { ok: false, reason: `Transaction "${tx.label}" would fail: No collateral supplied. You need to supply WETH or WMNT as collateral before borrowing.` };
      }
      if (code === '35') {
        return { ok: false, reason: `Transaction "${tx.label}" would fail: Insufficient collateral. Your health factor would drop below safe levels.` };
      }
      if (code === '27' || code === '26') {
        return { ok: false, reason: `Transaction "${tx.label}" would fail: Borrowing is not enabled for this asset on Aave.` };
      }
      if (msg.includes('ERC20: insufficient') || msg.includes('transfer amount exceeds balance')) {
        return { ok: false, reason: `Transaction "${tx.label}" would fail: Insufficient token balance.` };
      }
      const short = msg.length > 300 ? msg.slice(0, 300) + '...' : msg;
      return { ok: false, reason: `Transaction "${tx.label}" would fail on-chain: ${short}` };
    }
  }
  return { ok: true };
}

function buildTransactionTools(walletAddr: string) {
  return {
    mantis_propose_transaction: tool({
      description:
        'Propose DeFi transactions for user approval. Call ONLY when user explicitly requests an on-chain action like supply, withdraw, borrow, repay, swap, wrap, or unwrap. Returns unsigned calldata that the user can review and sign client-side.',
      inputSchema: z.object({
        action: z.enum(['supply', 'withdraw', 'borrow', 'repay', 'swap', 'wrap', 'unwrap']).describe('The DeFi action. Use "swap" with token="MNT" to auto-wrap native MNT before swapping.'),
        token: z.string().describe('Token symbol. For swap: SOURCE token (use "MNT" for native MNT). For wrap/unwrap: ignored (always MNT/WMNT).'),
        tokenTo: z.string().optional().describe('DESTINATION token for swap only, e.g. USDC, WETH'),
        amount: z.string().describe('Amount as decimal string, e.g. "100" or "0.5"'),
        protocol: z.enum(['aave-v3', 'merchant-moe']).default('aave-v3').describe('Protocol to use (merchant-moe for swaps)'),
      }),
      execute: async ({ action, token, tokenTo, amount }) => {
        const upperToken = token.toUpperCase();

        // Wrap/unwrap don't need token validation — always MNT/WMNT
        if (action === 'wrap' || action === 'unwrap') {
          if (!walletAddr || walletAddr === '0x0000000000000000000000000000000000000001') {
            return { type: 'error' as const, message: 'No wallet connected. Please connect your wallet first.' };
          }
          let normalizedWallet: string;
          try { normalizedWallet = getAddress(walletAddr); } catch {
            return { type: 'error' as const, message: `Invalid wallet address: ${walletAddr}` };
          }
          const agentAction: AgentAction = {
            type: action, token_from: null, token_to: null, amount,
            protocol: 'none', expected_apy_change: null, gas_estimate_usd: null,
          };
          try {
            const transactions = proposeActions([agentAction], normalizedWallet);
            if (transactions.length === 0) return { type: 'error' as const, message: `Failed to build ${action} transaction.` };
            const simResult = await simulateTransactions(transactions, normalizedWallet);
            if (!simResult.ok) return { type: 'error' as const, message: simResult.reason };
            const label = action === 'wrap' ? `Wrap ${amount} MNT → WMNT` : `Unwrap ${amount} WMNT → MNT`;
            return { type: 'transaction_proposal' as const, transactions, summary: `${label} (${transactions.length} transaction)` };
          } catch (err) {
            return { type: 'error' as const, message: `Failed: ${err instanceof Error ? err.message : String(err)}` };
          }
        }

        // Validate token — allow "MNT" for swap (auto-wraps)
        const isNativeMnt = upperToken === 'MNT' && action === 'swap';
        if (!isNativeMnt && !SUPPORTED_TOKENS.includes(upperToken)) {
          return {
            type: 'error' as const,
            message: `Token "${token}" is not supported. Supported tokens: ${SUPPORTED_TOKENS.join(', ')}, MNT (for swap)`,
          };
        }

        // For swap, validate destination token
        if (action === 'swap') {
          if (!tokenTo) {
            return { type: 'error' as const, message: 'Swap requires a destination token (tokenTo).' };
          }
          const upperTo = tokenTo.toUpperCase();
          if (!SUPPORTED_TOKENS.includes(upperTo)) {
            return {
              type: 'error' as const,
              message: `Destination token "${tokenTo}" is not supported. Supported: ${SUPPORTED_TOKENS.join(', ')}`,
            };
          }
          const effectiveFrom = isNativeMnt ? 'WMNT' : upperToken;
          if (effectiveFrom === upperTo) {
            return { type: 'error' as const, message: 'Source and destination tokens must be different.' };
          }
        }

        if (!walletAddr || walletAddr === '0x0000000000000000000000000000000000000001') {
          return {
            type: 'error' as const,
            message: 'No wallet connected. Please connect your wallet first.',
          };
        }

        // Normalize wallet address (EIP-55 checksum)
        let normalizedWallet: string;
        try {
          normalizedWallet = getAddress(walletAddr);
        } catch {
          return {
            type: 'error' as const,
            message: `Invalid wallet address: ${walletAddr}`,
          };
        }

        // Build AgentAction
        const upperTo = tokenTo?.toUpperCase() ?? null;
        const agentAction: AgentAction = action === 'swap'
          ? {
              type: 'swap',
              token_from: upperToken, // "MNT" triggers auto-wrap in executor
              token_to: upperTo,
              amount,
              protocol: 'merchant_moe',
              expected_apy_change: null,
              gas_estimate_usd: null,
            }
          : {
              type: action,
              token_from: action === 'withdraw' ? upperToken : null,
              token_to: (action === 'supply' || action === 'borrow' || action === 'repay') ? upperToken : null,
              amount,
              protocol: 'aave',
              expected_apy_change: null,
              gas_estimate_usd: null,
            };

        try {
          // Generate unsigned calldata
          const transactions = proposeActions([agentAction], normalizedWallet);

          if (transactions.length === 0) {
            return {
              type: 'error' as const,
              message: `Could not generate transactions for ${action} ${amount} ${upperToken}. Check that the token and amount are valid.`,
            };
          }

          // Pre-flight simulation — check if txs will revert before proposing
          const simResult = await simulateTransactions(transactions, normalizedWallet);
          if (!simResult.ok) {
            return {
              type: 'error' as const,
              message: simResult.reason,
            };
          }

          const actionLabels: Record<string, string> = { supply: 'Supply', withdraw: 'Withdraw', borrow: 'Borrow', repay: 'Repay', swap: 'Swap' };
          let summary: string;
          if (action === 'swap') {
            const fromLabel = isNativeMnt ? 'MNT' : upperToken;
            summary = `Swap ${amount} ${fromLabel} → ${upperTo} via Merchant Moe (${transactions.length} transaction${transactions.length > 1 ? 's' : ''})`;
          } else {
            summary = `${actionLabels[action] || action} ${amount} ${upperToken} on Aave V3 (${transactions.length} transaction${transactions.length > 1 ? 's' : ''})`;
          }
          return {
            type: 'transaction_proposal' as const,
            transactions,
            summary,
          };
        } catch (err) {
          return {
            type: 'error' as const,
            message: `Failed to build transaction: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      },
    }),
  };
}

// ═══════════════════════════════════════════════
// CHAT ROUTE
// ═══════════════════════════════════════════════

export async function POST(req: Request) {
  const { messages: uiMessages, walletAddress: clientWallet } = await req.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = (uiMessages as any[]).map((m: any) => ({
    role: m.role as 'user' | 'assistant',
    content: m.parts
      ?.filter((p: any) => p.type === 'text')
      .map((p: any) => p.text || '')
      .join('') || m.content || '',
  }));

  // Fetch fresh snapshot for context
  const wallet = clientWallet || process.env.NEXT_PUBLIC_DEMO_WALLET || '0x0000000000000000000000000000000000000001';

  let liveDataContext = '';
  try {
    const snapshot = await buildStateSnapshot(wallet);

    const reserveLines = snapshot.aave.reserves
      .filter(r => r.supplyAPY > 0 || r.borrowAPY > 0)
      .map(r => `- ${r.symbol}: Supply ${r.supplyAPY.toFixed(2)}% / Borrow ${r.borrowAPY.toFixed(2)}%`)
      .join('\n');

    const fmtTvl = (v: number) => v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
    const yieldLines = snapshot.yields.topByAPY
      .slice(0, 8)
      .map(p => `- ${p.project}/${p.symbol}: ${p.apy.toFixed(2)}% APY, TVL ${fmtTvl(p.tvlUsd)}`)
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
${snapshot.cian?.vaults?.length ? snapshot.cian.vaults.map(v => `- ${v.poolName}: APY ${v.apy.toFixed(2)}%${v.netApy !== null ? ` (Net: ${v.netApy.toFixed(2)}%)` : ''}, TVL ${fmtTvl(v.tvlUsd)}`).join('\n') : 'No data available.'}`;
  } catch {
    liveDataContext = '\n\n(Live data temporarily unavailable. Use MCP tools to fetch fresh data.)';
  }

  const systemPrompt = getChatSystemPrompt() + `

## Agent Tools (24 tools across 8 platforms)

**CRITICAL RULES**:
1. ALWAYS use the appropriate tool for on-chain data. NEVER answer from memory.
2. Present results with clear formatting (tables, bullet points).
3. If a tool errors, explain the error and suggest alternatives. DO NOT retry the same failing tool more than once.
4. If a tool returns empty/null results, try ONE alternative approach then summarize what you found.
5. NEVER call the same tool with the same parameters more than twice in one conversation.
6. When comparing yields, ALWAYS check Aave + Bybit Earn + CIAN to give the user the full CeDeFi picture.
7. The "Live Data" section above is a SNAPSHOT for context awareness. When users ask specific questions, ALWAYS verify via tool calls. Do NOT directly quote or cite Live Data as a source — present tool results instead.
8. If you mention a protocol (e.g. Lendle) that has NO dedicated tool, clearly state the data source is DefiLlama aggregated data, not a direct on-chain query.

### Aave V3 — lending & borrowing on Mantle
- mantle_getLendingMarkets — supply APY, borrow APY, LTV, liquidation threshold, TVL, oracle prices
Examples: "Aave rates?" → mantle_getLendingMarkets | "Best lending rate?" → mantle_getLendingMarkets

### DEX (Agni + Merchant Moe) — swaps, pools, TVL
- mantle_getSwapQuote — DEX swap quotes with price impact & route
- mantle_getPoolLiquidity — pool reserves & liquidity metadata
- mantle_getPoolOpportunities — find & rank pools for a token pair
- mantle_getProtocolTvl — protocol-level TVL
Examples: "Swap 100 USDC to WETH" → mantle_getSwapQuote | "TVL of Agni?" → mantle_getProtocolTvl

### Bybit Earn — CeDeFi OnChain staking products
- mantis_bybit_products — all available products (APR, duration, min/max)
- mantis_bybit_best_rate — find best rate for a specific coin
Examples: "Bybit Earn rates?" → mantis_bybit_products | "Best USDT rate on Bybit?" → mantis_bybit_best_rate

### CIAN Protocol — ERC4626 yield layer vaults
- mantis_cian_vaults — all vaults (APY, Net APY, TVL, fees, on-chain data)
- mantis_cian_user_position — user's vault positions (shares → asset value)
Examples: "CIAN vault APY?" → mantis_cian_vaults | "My CIAN positions?" → mantis_cian_user_position

### Wallet — balances, allowances, yield analysis
- mantle_getBalance — native MNT balance
- mantle_getTokenBalances — ERC-20 token balances
- mantle_getAllowances — check token approvals/allowances
- mantis_yield_projection — projected yield across all positions (Aave + CIAN combined)
Examples: "Check my balance" → mantle_getBalance | "My projected yield?" → mantis_yield_projection

### Tokens — metadata, prices, address resolution
- mantle_getTokenInfo — ERC-20 metadata (name, symbol, decimals, supply)
- mantle_getTokenPrices — live prices in USD or MNT (DexScreener + DefiLlama)
- mantle_resolveToken — symbol → contract address with token-list cross-check
- mantle_resolveAddress — contract name/alias → address
- mantle_validateAddress — format + checksum + bytecode check
Examples: "USDC address?" → mantle_resolveToken | "Price of MNT?" → mantle_getTokenPrices

### Mantle Network — chain info, gas, RPC diagnostics
- mantle_getChainInfo — static chain config (chain ID, RPC, explorer, bridge)
- mantle_getChainStatus — live block height + gas price
- mantle_checkRpcHealth — RPC health check (reachability, chain ID, latency)
- mantle_probeEndpoint — probe JSON-RPC endpoint with minimal call
Examples: "Gas price?" → mantle_getChainStatus | "Chain ID?" → mantle_getChainInfo

### Indexer — custom subgraph & SQL queries
- mantle_querySubgraph — execute GraphQL against Mantle indexer
- mantle_queryIndexerSql — execute read-only SQL

### Transaction Execution — propose on-chain DeFi actions
- mantis_propose_transaction — generate unsigned calldata for on-chain DeFi actions
**Supported actions:** \`supply\`, \`withdraw\`, \`borrow\`, \`repay\` (Aave V3) | \`swap\` (Merchant Moe) | \`wrap\`, \`unwrap\` (MNT↔WMNT)
**Supported tokens:** ${SUPPORTED_TOKENS.join(', ')}. Native MNT accepted for swap source (auto-wraps).

**TOKEN ALIASES — resolve these BEFORE calling the tool:**
- User says "ETH" → use token="WETH" (Mantle uses Wrapped ETH)
- User says "USDT" → use token="USDT0" (Mantle uses USDT0, not USDT)
- User says "MNT" for swap source → use token="MNT" (system auto-prepends wrap tx)
- User says "MNT" for swap destination → call TWO tools: first swap(token=X, tokenTo="WMNT"), then unwrap(amount=output)
- User says "MNT" for wrap → action="wrap"
- User says "WMNT" for unwrap → action="unwrap"
Always silently resolve aliases — don't ask the user "did you mean WETH?" Just use the correct token.

**SWAP → MNT (destination) handling:**
When user wants to receive native MNT (e.g. "swap 50 USDC to MNT"), you MUST call the tool TWICE:
1. mantis_propose_transaction(action="swap", token="USDC", tokenTo="WMNT") — swap to wrapped MNT
2. mantis_propose_transaction(action="unwrap", amount="<estimated output>") — unwrap to native MNT
Explain to user: "I'll swap to WMNT first, then unwrap to native MNT — 2 separate proposal cards."

**SHORTCUT swaps:**
- "Swap MNT to WMNT" or "Wrap MNT" → action="wrap"
- "Swap WMNT to MNT" or "Unwrap WMNT" → action="unwrap"

**COLLATERAL INFO (Aave V3 Mantle):**
- Only **WETH** and **WMNT** can be used as collateral (LTV > 0). Supply of these tokens auto-enables collateral.
- USDC, USDT0, USDe, sUSDe, FBTC have LTV=0 → supply earns interest but CANNOT be used as collateral for borrowing.
- To borrow, user MUST first supply WETH or WMNT as collateral.
- If user asks to borrow but has no WETH/WMNT supplied, explain this limitation.

**RULES:**
1. ONLY call when user EXPLICITLY requests an on-chain action. NEVER for info queries.
2. If token or amount is ambiguous, ASK for clarification.
3. Borrow uses variable interest rate. Repay requires approval first.
4. After proposing, briefly explain the txs and risks (health factor for borrow, slippage for swap).
5. For multi-action requests (e.g. "supply ETH and borrow USDC"), call tool ONCE per action.
6. For SWAP: ALWAYS call mantis_propose_transaction DIRECTLY. Do NOT call mantle_getSwapQuote first — the executor auto-routes through WMNT when no direct pool exists. Just propose it immediately.

Examples:
- "Supply 0.1 ETH to Aave" → token="WETH" (alias resolved), action="supply"
- "Swap 50 USDT to WETH" → token="USDT0" (alias resolved), tokenTo="WETH", action="swap"
- "Swap 1 MNT to USDC" → token="MNT", tokenTo="USDC", action="swap" (auto-wraps)
- "Swap 50 USDC to MNT" → FIRST swap(token="USDC", tokenTo="WMNT"), THEN unwrap
- "Wrap 2 MNT" → action="wrap", amount="2"
` + liveDataContext;

  const anthropic = createAnthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages,
    tools: { ...mcpTools, ...mantisTools, ...buildTransactionTools(wallet) },
    maxOutputTokens: 32000,
    stopWhen: stepCountIs(15),
    providerOptions: {
      anthropic: {
        thinking: { type: 'adaptive' },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
