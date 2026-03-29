import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

const SCAFFOLD_PATH = path.resolve(process.cwd(), '../mantle-agent-scaffold/dist/src/index.js');

let mcpClient: Client | null = null;
let isConnecting = false;

async function getClient(): Promise<Client> {
  if (mcpClient) return mcpClient;
  if (isConnecting) {
    // Wait for ongoing connection
    while (isConnecting) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (mcpClient) return mcpClient;
  }

  isConnecting = true;
  try {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SCAFFOLD_PATH],
      env: {
        ...process.env,
        MANTLE_MCP_TRANSPORT: 'stdio',
        MANTLE_RPC_URL: process.env.MANTLE_RPC_URL || 'https://rpc.mantle.xyz',
      } as Record<string, string>,
    });

    const client = new Client({
      name: 'mantis-agent',
      version: '0.1.0',
    });

    await client.connect(transport);
    mcpClient = client;
    console.log('[MCP] Connected to Mantle Agent Scaffold');
    return client;
  } finally {
    isConnecting = false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callTool(name: string, args: Record<string, unknown>): Promise<any> {
  const client = await getClient();
  const result = await client.callTool({ name, arguments: args });
  // MCP returns content array, extract text
  if (Array.isArray(result.content)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlock = result.content.find((c: any) => c.type === 'text');
    if (textBlock && 'text' in textBlock) {
      try {
        return JSON.parse(textBlock.text as string);
      } catch {
        return textBlock.text;
      }
    }
  }
  return result.content;
}

// High-level tool wrappers used by MANTIS

export async function mcpGetLendingMarkets(network: string = 'mainnet') {
  return callTool('mantle_getLendingMarkets', { network });
}

export async function mcpGetSwapQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  network?: string;
}) {
  return callTool('mantle_getSwapQuote', {
    token_in: params.tokenIn,
    token_out: params.tokenOut,
    amount_in: params.amountIn,
    network: params.network || 'mainnet',
  });
}

export async function mcpGetPoolLiquidity(params: {
  pool: string;
  protocol: string;
  network?: string;
}) {
  return callTool('mantle_getPoolLiquidity', {
    pool_address: params.pool,
    protocol: params.protocol,
    network: params.network || 'mainnet',
  });
}

export async function mcpGetTokenPrices(tokens: string[], network: string = 'mainnet') {
  return callTool('mantle_getTokenPrices', { tokens, network });
}

export async function mcpGetChainStatus(network: string = 'mainnet') {
  return callTool('mantle_getChainStatus', { network });
}

export async function mcpGetBalance(address: string, network: string = 'mainnet') {
  return callTool('mantle_getBalance', { address, network });
}

export async function mcpGetTokenBalances(params: {
  address: string;
  tokens: string[];
  network?: string;
}) {
  return callTool('mantle_getTokenBalances', {
    wallet_address: params.address,
    token_addresses: params.tokens,
    network: params.network || 'mainnet',
  });
}

export async function mcpGetPoolOpportunities(params: {
  tokenA: string;
  tokenB: string;
  network?: string;
}) {
  return callTool('mantle_getPoolOpportunities', {
    token_a: params.tokenA,
    token_b: params.tokenB,
    network: params.network || 'mainnet',
  });
}

export async function mcpCheckRpcHealth(network: string = 'mainnet') {
  return callTool('mantle_checkRpcHealth', { network });
}

// List all available tools
export async function mcpListTools() {
  const client = await getClient();
  return client.listTools();
}

// Public tool invocation (used by MCP Explorer page)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function mcpCallTool(name: string, args: Record<string, unknown>): Promise<any> {
  return callTool(name, args);
}

// Close connection
export async function mcpClose() {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
  }
}
