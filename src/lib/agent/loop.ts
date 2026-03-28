import { buildStateSnapshot } from '@/lib/collectors';
import { runReasoningEngine } from './engine';
import { checkSafety } from './safety';
import { executeActions, type ExecutionMode } from './executor';
import { appendAgentLog, getLastDecision } from './logger';
import type { AgentCycleResult, ExecutionResult, StrategyConfig } from '@/lib/types';

const DEFAULT_CONFIG: StrategyConfig = {
  riskProfile: 'balanced',
  maxPositionPercent: 50,
  minHealthFactor: 1.3,
  minYieldImprovement: 0.5,
};

export async function runAgentCycle(
  walletAddress: string,
  config: StrategyConfig = DEFAULT_CONFIG,
  mode: ExecutionMode = 'simulate'
): Promise<AgentCycleResult> {
  const cycleId = `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const phases = {
    observe: { durationMs: 0, errors: [] as string[] },
    decide: { durationMs: 0 },
    act: { durationMs: 0, safetyPassed: false, violations: [] as string[] },
  };

  // PHASE 1: OBSERVE
  const observeStart = Date.now();
  const snapshot = await buildStateSnapshot(walletAddress);
  phases.observe.durationMs = Date.now() - observeStart;
  phases.observe.errors = snapshot.metadata.errors;

  // PHASE 2: DECIDE
  const decideStart = Date.now();
  const previousDecision = getLastDecision();
  const decision = await runReasoningEngine(snapshot, previousDecision);
  decision.timestamp = Date.now();
  phases.decide.durationMs = Date.now() - decideStart;

  // PHASE 3: ACT
  const actStart = Date.now();
  let executionResults: ExecutionResult[] = [];

  // Normalize decision.decision — Claude may return unexpected formats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decisionField = decision.decision as any;
  const actionType: string = typeof decisionField === 'string'
    ? decisionField.toLowerCase()
    : (decisionField?.action || 'hold').toString().toLowerCase();

  const actions = decision.actions || [];
  if (actionType === 'hold' || actionType === 'alert' || actionType === 'none') {
    phases.act.safetyPassed = true;
  } else if (actions.length > 0) {
    const safetyCheck = checkSafety(decision, snapshot, config);
    phases.act.safetyPassed = safetyCheck.passed;
    phases.act.violations = safetyCheck.violations;

    if (safetyCheck.passed) {
      const execMode = actionType === 'execute' ? mode : 'simulate';
      executionResults = await executeActions(safetyCheck.adjustedActions, snapshot, execMode);
    }
  }
  phases.act.durationMs = Date.now() - actStart;

  const result: AgentCycleResult = {
    cycleId,
    timestamp: Date.now(),
    snapshot,
    decision,
    executionResults,
    phases,
  };

  appendAgentLog(result);

  return result;
}
