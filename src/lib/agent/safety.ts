import type { AgentDecision, StateSnapshot, StrategyConfig, SafetyCheckResult } from '@/lib/types';

// Hardcoded safety constants — cannot be overridden by LLM
const MIN_HEALTH_FACTOR = 1.3;
const EMERGENCY_HEALTH_FACTOR = 1.1;
const MAX_POSITION_MOVE_PERCENT = 0.5; // 50%

export function checkSafety(
  decision: AgentDecision,
  snapshot: StateSnapshot,
  _config: StrategyConfig
): SafetyCheckResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // RULE 1: Health Factor Floor
  const hf = snapshot.aave.account.healthFactor;
  const hasDebt = snapshot.aave.account.totalDebtUSD > 0;

  if (hasDebt && hf !== null && hf < MIN_HEALTH_FACTOR) {
    // Only allow withdrawals/repayments when HF is low
    const nonProtective = decision.actions.filter(
      a => a.type !== 'withdraw' && a.type !== 'none'
    );
    if (nonProtective.length > 0) {
      violations.push(
        `Health factor ${hf.toFixed(2)} is below minimum ${MIN_HEALTH_FACTOR}. Only withdrawals/repayments allowed.`
      );
    }
  }

  // RULE 2: Emergency Health Factor
  if (hasDebt && hf !== null && hf < EMERGENCY_HEALTH_FACTOR) {
    violations.push(
      `EMERGENCY: Health factor ${hf.toFixed(2)} below ${EMERGENCY_HEALTH_FACTOR}. Forcing emergency mode.`
    );
  }

  // RULE 3: Max Position Move (50% of portfolio)
  const totalValue = snapshot.wallet.totalValueUSD;
  if (totalValue > 0) {
    for (const action of decision.actions) {
      if (action.type === 'none') continue;
      if (!action.amount) continue;

      // Rough estimate: try to parse amount as number
      const amountNum = parseFloat(action.amount);
      if (isNaN(amountNum)) continue;

      // Find price for the token
      const tokenSymbol = action.token_from || action.token_to;
      if (!tokenSymbol) continue;

      const price = snapshot.prices.find(
        p => p.symbol.toLowerCase() === tokenSymbol.toLowerCase()
      );
      const moveValueUSD = price ? amountNum * price.priceUSD : amountNum; // fallback assumes USD

      const maxAllowed = totalValue * MAX_POSITION_MOVE_PERCENT;
      if (moveValueUSD > maxAllowed) {
        violations.push(
          `Action moves $${moveValueUSD.toFixed(2)} which exceeds ${MAX_POSITION_MOVE_PERCENT * 100}% limit ($${maxAllowed.toFixed(2)})`
        );
      }
    }
  }

  // RULE 4: Gas Profitability Check
  for (const action of decision.actions) {
    if (action.type === 'none') continue;
    if (action.gas_estimate_usd && action.expected_apy_change) {
      const estimatedWeeklyGain = (action.expected_apy_change / 100 / 52) * totalValue;
      if (action.gas_estimate_usd > estimatedWeeklyGain && estimatedWeeklyGain > 0) {
        warnings.push(
          `Gas cost ($${action.gas_estimate_usd.toFixed(4)}) exceeds weekly expected gain ($${estimatedWeeklyGain.toFixed(4)}). May not be profitable.`
        );
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings,
    adjustedActions: violations.length === 0 ? decision.actions : [],
  };
}
