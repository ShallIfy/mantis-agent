import { NextResponse } from 'next/server';
import { runAgentCycle } from '@/lib/agent/loop';

export const maxDuration = 60; // Allow up to 60s for Claude API call

export async function POST() {
  const wallet = process.env.NEXT_PUBLIC_DEMO_WALLET || '0x0000000000000000000000000000000000000001';
  const mode = (process.env.EXECUTION_MODE || 'simulate') as 'simulate' | 'execute';

  try {
    const result = await runAgentCycle(wallet, undefined, mode);

    // Strip the full snapshot from the response to reduce payload size
    const { snapshot, ...rest } = result;
    return NextResponse.json({
      ...rest,
      snapshotSummary: {
        blockNumber: snapshot.blockNumber,
        totalValueUSD: snapshot.wallet.totalValueUSD,
        healthFactor: snapshot.aave.account.healthFactor,
        positionCount: snapshot.aave.positions.length,
        reserveCount: snapshot.aave.reserves.length,
        yieldPoolCount: snapshot.yields.mantlePools.length,
        collectionTimeMs: snapshot.metadata.collectionTimeMs,
        errors: snapshot.metadata.errors,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent cycle failed' },
      { status: 500 }
    );
  }
}
