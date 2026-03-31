import { NextRequest, NextResponse } from 'next/server';
import { mcpListTools, mcpCallTool } from '@/lib/mcp/client';
import { getMcpData, getMcpSwapQuote } from '@/lib/collectors/mcp';
import { getBybitEarnProducts } from '@/lib/collectors/bybit';
import { getCianVaults } from '@/lib/collectors/cian';
import { calculateYieldProjection, getCianUserPositions } from '@/lib/calculators/yield-projection';

// ═══════════════════════════════════════════════
// MANTIS NATIVE TOOLS — definitions for /mcp explorer
// ═══════════════════════════════════════════════

const MANTIS_TOOL_DEFS = [
  {
    name: 'mantis_bybit_products',
    description: 'Get all available Bybit Earn OnChain staking products. Returns APR, duration (Flexible/Fixed), min/max stake amounts, and swap coin. Covers USDT, USDC, ETH, METH, BTC, USDTB.',
    inputSchema: {
      type: 'object',
      properties: {
        coin: { type: 'string', description: 'Filter by specific coin (e.g. USDT, ETH). Returns all coins if not provided.' },
      },
    },
  },
  {
    name: 'mantis_bybit_best_rate',
    description: 'Find the best Bybit Earn rate for a specific coin. Returns the highest APR product with full details.',
    inputSchema: {
      type: 'object',
      properties: {
        coin: { type: 'string', description: 'Coin symbol to find best rate for (e.g. USDT, ETH, USDC, BTC, METH)' },
      },
      required: ['coin'],
    },
  },
  {
    name: 'mantis_cian_vaults',
    description: 'Get all CIAN Yield Layer vaults on Mantle. Returns APY, Net APY (after fees), TVL, deposit capacity, fee structure, and on-chain ERC4626 data.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mantis_cian_user_position',
    description: "Get a wallet's position in CIAN ERC4626 vaults on Mantle. Returns shares converted to underlying assets value.",
    inputSchema: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Wallet address (0x...). Uses demo wallet if not provided.' },
      },
    },
  },
  {
    name: 'mantis_yield_projection',
    description: 'Calculate projected yield for a wallet across all DeFi positions on Mantle (Aave V3 supply/borrow + CIAN vaults). Returns per-position APY, projected daily/monthly/annual earnings, and net yield.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet: { type: 'string', description: 'Wallet address (0x...). Uses demo wallet if not provided.' },
      },
    },
  },
];

// Execute MANTIS native tools
async function executeMantisNativeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'mantis_bybit_products': {
      const products = await getBybitEarnProducts();
      const coin = args.coin as string | undefined;
      if (coin) {
        const filtered = products.filter(p => p.coin.toUpperCase() === coin.toUpperCase());
        return { coin, products: filtered, count: filtered.length };
      }
      return { products, count: products.length };
    }
    case 'mantis_bybit_best_rate': {
      const products = await getBybitEarnProducts();
      const coin = (args.coin as string).toUpperCase();
      const filtered = products.filter(p => p.coin.toUpperCase() === coin);
      if (filtered.length === 0) {
        return { error: `No Bybit Earn products found for ${coin}`, availableCoins: [...new Set(products.map(p => p.coin))] };
      }
      return { bestProduct: filtered[0], alternativeProducts: filtered.slice(1), totalOptions: filtered.length };
    }
    case 'mantis_cian_vaults': {
      const vaults = await getCianVaults();
      return { vaults, count: vaults.length };
    }
    case 'mantis_cian_user_position': {
      const wallet = (args.wallet as string) || process.env.NEXT_PUBLIC_DEMO_WALLET || '0x0000000000000000000000000000000000000001';
      const [positions, vaults] = await Promise.all([getCianUserPositions(wallet), getCianVaults()]);
      const enriched = positions.map(p => {
        const vault = vaults.find(v => v.poolAddress.toLowerCase() === p.vaultAddress.toLowerCase());
        return { ...p, vaultAPY: vault?.apy ?? null, vaultNetAPY: vault?.netApy ?? null, vaultTVL: vault?.tvlUsd ?? null };
      });
      return { wallet, positions: enriched, count: enriched.length, hasPositions: enriched.length > 0 };
    }
    case 'mantis_yield_projection': {
      const wallet = (args.wallet as string) || process.env.NEXT_PUBLIC_DEMO_WALLET || '0x0000000000000000000000000000000000000001';
      return calculateYieldProjection(wallet);
    }
    default:
      throw new Error(`Unknown MANTIS tool: ${name}`);
  }
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  try {
    if (action === 'tools') {
      const mcpResult = await mcpListTools();
      // Merge MCP scaffold tools + MANTIS native tools
      const allTools = [...(mcpResult.tools || []), ...MANTIS_TOOL_DEFS];
      return NextResponse.json({ tools: allTools });
    }

    if (action === 'invoke') {
      const tool = req.nextUrl.searchParams.get('tool');
      if (!tool) {
        return NextResponse.json({ error: 'tool parameter required' }, { status: 400 });
      }
      const argsRaw = req.nextUrl.searchParams.get('args') || '{}';
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(argsRaw);
      } catch {
        return NextResponse.json({ error: 'Invalid args JSON' }, { status: 400 });
      }
      const start = Date.now();
      // Route to MANTIS native handler or MCP scaffold
      const result = tool.startsWith('mantis_')
        ? await executeMantisNativeTool(tool, args)
        : await mcpCallTool(tool, args);
      const latencyMs = Date.now() - start;
      return NextResponse.json({ result, latencyMs });
    }

    if (action === 'swap-quote') {
      const tokenIn = req.nextUrl.searchParams.get('tokenIn') || '';
      const tokenOut = req.nextUrl.searchParams.get('tokenOut') || '';
      const amountIn = req.nextUrl.searchParams.get('amountIn') || '1';
      const quote = await getMcpSwapQuote(tokenIn, tokenOut, amountIn);
      return NextResponse.json({ quote });
    }

    // Default: return lending markets + chain status
    const data = await getMcpData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'MCP error' },
      { status: 500 }
    );
  }
}
