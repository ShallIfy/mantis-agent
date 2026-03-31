import Anthropic from '@anthropic-ai/sdk';
import { getAgentSystemPrompt } from './prompts';
import type { StateSnapshot, AgentDecision } from '@/lib/types';

/**
 * Normalize Claude's creative JSON output to our expected AgentDecision schema.
 * Claude with extended thinking often returns richer/different formats.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDecision(raw: any): AgentDecision {
  // If it already matches our schema, return as-is
  if (raw.decision?.action && raw.analysis?.summary && raw.user_message) {
    return raw as AgentDecision;
  }

  // Extract analysis summary from various possible locations
  const summary = raw.analysis?.summary
    || raw.analysis?.currentState
    || raw.summary
    || JSON.stringify(raw.analysis || {}).substring(0, 300);

  // Extract risk level
  const riskLevel = raw.analysis?.risk_level
    || raw.analysis?.riskLevel
    || raw.expectedPortfolioMetrics?.riskLevel?.toLowerCase()
    || 'medium';

  // Extract current APY
  const currentApy = raw.analysis?.current_portfolio_apy
    || raw.expectedPortfolioMetrics?.weightedAverageAPY
    || raw.allocationPlan?.targetWeightedAPY
    || 0;

  // Extract decision action
  const hasActions = (raw.actions?.length > 0 && raw.actions[0]?.type !== 'none')
    || (raw.recommendedActions?.length > 0)
    || (raw.allocationPlan?.tiers?.length > 0);
  const action = raw.decision?.action || (hasActions ? 'suggest' : 'hold');

  // Build reasoning from all available detail
  const reasoningParts: string[] = [];
  if (raw.decision?.reasoning) reasoningParts.push(raw.decision.reasoning);
  if (raw.analysis?.recommendedStrategy) reasoningParts.push(`Strategy: ${raw.analysis.recommendedStrategy}`);
  if (raw.allocationPlan) {
    reasoningParts.push(`Target APY: ${raw.allocationPlan.targetWeightedAPY || 'N/A'}%`);
    reasoningParts.push(`Projected annual income: $${raw.allocationPlan.projectedAnnualIncomeUSD || raw.expectedPortfolioMetrics?.estimatedAnnualYieldUSD || 'N/A'}`);
  }
  if (raw.analysis?.keyRisks?.length) {
    reasoningParts.push(`Key risks: ${raw.analysis.keyRisks.join('; ')}`);
  }
  if (raw.monitoringAlerts?.length) {
    reasoningParts.push(`Monitoring: ${raw.monitoringAlerts.map((a: { trigger: string }) => a.trigger).join('; ')}`);
  }
  // If still empty, serialize the whole thing
  if (reasoningParts.length === 0) {
    reasoningParts.push(JSON.stringify(raw, null, 2).substring(0, 2000));
  }

  // Extract user message
  const userMessage = raw.user_message
    || `Analysis complete. ${summary.substring(0, 150)}`;

  // Normalize actions to our format
  const normalizedActions = (raw.actions || raw.recommendedActions || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .slice(0, 5).map((a: any) => ({
      type: a.type || a.action || 'none',
      token_from: a.token_from || a.fromToken || null,
      token_to: a.token_to || a.toToken || null,
      amount: a.amount || a.fromAmount?.toString() || null,
      protocol: a.protocol || 'none',
      expected_apy_change: a.expected_apy_change || a.expectedAPY || null,
      gas_estimate_usd: a.gas_estimate_usd || null,
    }));

  return {
    analysis: {
      summary,
      changes_detected: raw.analysis?.changes_detected || raw.analysis?.marketObservations || [],
      current_portfolio_apy: currentApy,
      risk_level: riskLevel as 'low' | 'medium' | 'high',
    },
    decision: {
      action: action as 'hold' | 'suggest' | 'execute' | 'alert',
      confidence: raw.decision?.confidence || 0.7,
      urgency: raw.decision?.urgency || (hasActions ? 'medium' : 'none'),
      reasoning: reasoningParts.join('\n\n'),
    },
    actions: normalizedActions.length > 0 ? normalizedActions : [{ type: 'none', token_from: null, token_to: null, amount: null, protocol: 'none', expected_apy_change: null, gas_estimate_usd: null }],
    user_message: userMessage,
  };
}

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

  // Bybit Earn products
  if (snapshot.bybit?.products?.length > 0) {
    lines.push('### Bybit Earn OnChain Products (CeDeFi)');
    for (const p of snapshot.bybit.products) {
      const swapInfo = p.swapCoin ? ` → receive ${p.swapCoin}` : '';
      const termInfo = p.duration === 'Fixed' ? ` (${p.term}d lock)` : ' (Flexible)';
      lines.push(`- ${p.coin}: ${p.estimateApr.toFixed(2)}% APR${termInfo}${swapInfo} [min ${p.minStakeAmount}, max ${p.maxStakeAmount}]`);
    }
    lines.push('');
  }

  // CIAN Vaults
  if (snapshot.cian?.vaults?.length > 0) {
    lines.push('### CIAN Yield Layer Vaults (Mantle)');
    for (const v of snapshot.cian.vaults) {
      const netApyStr = v.netApy !== null ? `, Net APY ${v.netApy.toFixed(2)}%` : '';
      const feeStr = v.feePerformance !== null ? `, Perf fee ${v.feePerformance}%` : '';
      lines.push(`- ${v.poolName}: APY ${v.apy.toFixed(2)}%${netApyStr} (TVL $${(v.tvlUsd / 1e6).toFixed(1)}M${feeStr})`);
      if (v.totalAssets) {
        lines.push(`  On-chain: totalAssets=${v.totalAssets}, totalSupply=${v.totalSupply}`);
      }
    }
    lines.push('');
  }

  // MCP Lending Markets (from Mantle Agent Scaffold)
  if (snapshot.mcp?.lendingMarkets?.length > 0) {
    lines.push('### MCP: Lending Markets (via Mantle Agent Scaffold)');
    for (const m of snapshot.mcp.lendingMarkets) {
      lines.push(`- ${m.protocol}/${m.asset}: Supply ${m.supplyApy?.toFixed?.(2) || m.supplyApy}% / Borrow ${m.borrowApy?.toFixed?.(2) || m.borrowApy}%`);
    }
    lines.push('');
  }
  if (snapshot.mcp?.chainStatus) {
    lines.push(`### MCP: Chain Status — Block ${snapshot.mcp.chainStatus.blockNumber}, Gas Price ${snapshot.mcp.chainStatus.gasPrice}`);
    lines.push('');
  }

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
    const prevAction = typeof previousDecision.decision === 'string'
      ? previousDecision.decision
      : previousDecision.decision?.action || 'unknown';
    lines.push(`Action: ${prevAction}`);
    lines.push(`Summary: ${previousDecision.analysis?.summary || 'N/A'}`);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.messages.create as any)({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: {
      type: 'enabled',
      budget_tokens: 10000,
    },
    temperature: 1, // required when thinking is enabled
    system: getAgentSystemPrompt(),
    messages: [{ role: 'user', content: userMessage }],
  });

  // With thinking enabled, response has thinking blocks + text blocks
  // Extract thinking for logging, text for JSON parsing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thinkingBlock = response.content.find((b: any) => b.type === 'thinking');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textBlock = response.content.find((b: any) => b.type === 'text');
  const thinkingContent = thinkingBlock?.thinking || '';
  const text = textBlock?.text || '';

  // Log thinking for debugging
  if (thinkingContent) {
    console.log(`[MANTIS] Thinking (${thinkingContent.length} chars):`, thinkingContent.substring(0, 300) + '...');
  }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = JSON.parse(jsonStr.trim()) as any;

    // Normalize Claude's creative output to our expected schema
    const normalized = normalizeDecision(raw);
    if (thinkingContent) {
      normalized.thinking = thinkingContent;
    }
    return normalized;
  } catch {
    // If parsing fails, return a safe hold decision with thinking attached
    return {
      thinking: thinkingContent || undefined,
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
