import { NextRequest, NextResponse } from 'next/server';
import { getAgentLog } from '@/lib/agent/logger';

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');

  const logs = getAgentLog(limit).map(entry => ({
    cycleId: entry.cycleId,
    timestamp: entry.timestamp,
    decision: entry.decision,
    executionResults: entry.executionResults,
    phases: entry.phases,
    snapshotSummary: {
      blockNumber: entry.snapshot.blockNumber,
      totalValueUSD: entry.snapshot.wallet.totalValueUSD,
      healthFactor: entry.snapshot.aave.account.healthFactor,
    },
  }));

  return NextResponse.json({ logs });
}
