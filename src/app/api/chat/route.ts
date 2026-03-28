import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { buildStateSnapshot } from '@/lib/collectors';
import { MANTIS_CHAT_SYSTEM_PROMPT } from '@/lib/agent/prompts';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Fetch fresh data to inject into context
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
${priceLines}`;
  } catch {
    liveDataContext = '\n\n(Live data temporarily unavailable. Answer based on general knowledge.)';
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-5-20250514'),
    system: MANTIS_CHAT_SYSTEM_PROMPT + liveDataContext,
    messages,
  });

  return result.toTextStreamResponse();
}
