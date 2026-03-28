import Anthropic from '@anthropic-ai/sdk';
import { MANTIS_SYSTEM_PROMPT } from './prompts';
import type { StateSnapshot, AgentDecision } from '@/lib/types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // @anthropic-ai/sdk appends /v1/messages, so baseURL should NOT include /v1
  baseURL: process.env.ANTHROPIC_BASE_URL
    ? process.env.ANTHROPIC_BASE_URL.replace(/\/v1$/, '')
    : 'https://api.anthropic.com',
});

function formatSnapshotForClaude(snapshot: StateSnapshot, previousDecision?: AgentDecision): string {
  const lines: string[] = [];

  lines.push(`## Current State Snapshot (${new Date(snapshot.timestamp).toISOString()})`);
  lines.push(`Block: ${snapshot.blockNumber}`);
  lines.push('');

  // Wallet
  lines.push(`### Wallet: ${snapshot.wallet.address}`);
  lines.push(`Total Value (wallet + Aave): $${snapshot.wallet.totalValueUSD.toFixed(2)}`);
  lines.push('');

  // Aave account
  const acc = snapshot.aave.account;
  lines.push('### Aave Account');
  lines.push(`Health Factor: ${acc.healthFactor === null ? 'N/A (no debt)' : acc.healthFactor === Infinity ? 'Infinity (no debt)' : acc.healthFactor.toFixed(4)}`);
  lines.push(`Total Collateral: $${acc.totalCollateralUSD.toFixed(2)}`);
  lines.push(`Total Debt: $${acc.totalDebtUSD.toFixed(2)}`);
  lines.push(`Available Borrows: $${acc.availableBorrowsUSD.toFixed(2)}`);
  lines.push('');

  // Positions
  if (snapshot.aave.positions.length > 0) {
    lines.push('### Active Positions');
    for (const p of snapshot.aave.positions) {
      lines.push(`- ${p.symbol}: Supplied ${p.supplied} ($${p.suppliedUSD.toFixed(2)}), Borrowed ${p.borrowed} ($${p.borrowedUSD.toFixed(2)})`);
    }
    lines.push('');
  }

  // Reserves
  lines.push('### Aave V3 Mantle Rates');
  for (const r of snapshot.aave.reserves) {
    if (r.supplyAPY > 0 || r.borrowAPY > 0) {
      lines.push(`- ${r.symbol}: Supply APY ${r.supplyAPY.toFixed(2)}%, Borrow APY ${r.borrowAPY.toFixed(2)}%, Utilization ${r.utilizationRate.toFixed(1)}%`);
    }
  }
  lines.push('');

  // Top yields
  lines.push('### Top Yield Opportunities on Mantle');
  for (const p of snapshot.yields.topByAPY.slice(0, 10)) {
    lines.push(`- ${p.project} / ${p.symbol}: ${p.apy.toFixed(2)}% APY (TVL $${(p.tvlUsd / 1e6).toFixed(1)}M)`);
  }
  lines.push('');

  // Prices
  lines.push('### Token Prices');
  for (const p of snapshot.prices) {
    lines.push(`- ${p.symbol}: $${p.priceUSD.toFixed(4)}`);
  }
  lines.push('');

  // Wallet balances
  const nonZero = snapshot.wallet.balances.filter(b => parseFloat(b.formatted) > 0.0001);
  if (nonZero.length > 0) {
    lines.push('### Wallet Balances (uninvested)');
    for (const b of nonZero) {
      lines.push(`- ${b.symbol}: ${b.formatted} ($${b.valueUSD.toFixed(2)})`);
    }
    lines.push('');
  }

  // Previous decision
  if (previousDecision) {
    lines.push('### Previous Decision');
    lines.push(`Action: ${previousDecision.decision.action}`);
    lines.push(`Summary: ${previousDecision.analysis.summary}`);
    lines.push('');
  }

  lines.push('Analyze this state. IMPORTANT: Your response must be ONLY the JSON object, nothing else. No markdown, no explanation, no code blocks — just raw JSON matching the schema.');

  return lines.join('\n');
}

export async function runReasoningEngine(
  snapshot: StateSnapshot,
  previousDecision?: AgentDecision
): Promise<AgentDecision> {
  const userMessage = formatSnapshotForClaude(snapshot, previousDecision);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: {
      type: 'enabled',
      budget_tokens: 10000,
    },
    system: MANTIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  // With thinking enabled, response has thinking blocks + text blocks
  const textBlock = response.content.find(b => b.type === 'text');
  const text = textBlock?.type === 'text' ? textBlock.text : '';

  // Parse JSON — handle code blocks, embedded JSON, or clean JSON
  let jsonStr = text.trim();

  // Try 1: code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Try 2: find first { ... } block if not valid JSON
  try {
    JSON.parse(jsonStr);
  } catch {
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      jsonStr = text.substring(braceStart, braceEnd + 1);
    }
  }

  try {
    return JSON.parse(jsonStr.trim()) as AgentDecision;
  } catch {
    // If parsing fails, return a safe hold decision
    return {
      analysis: {
        summary: 'Failed to parse reasoning engine output. Defaulting to hold.',
        changes_detected: ['parsing_error'],
        current_portfolio_apy: 0,
        risk_level: 'low',
      },
      decision: {
        action: 'hold',
        confidence: 0,
        urgency: 'none',
        reasoning: `Raw output: ${text.substring(0, 500)}`,
      },
      actions: [{ type: 'none', token_from: null, token_to: null, amount: null, protocol: 'none', expected_apy_change: null, gas_estimate_usd: null }],
      user_message: 'Agent encountered an issue processing this cycle. Standing by.',
    };
  }
}
