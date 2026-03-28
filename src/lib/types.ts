// MANTIS Core Types

export interface AaveReserveData {
  symbol: string;
  address: string;
  supplyAPY: number;
  borrowAPY: number;
  totalSupply: string;
  totalBorrow: string;
  utilizationRate: number;
  liquidityRate: string;
  variableBorrowRate: string;
}

export interface AaveUserPosition {
  symbol: string;
  address: string;
  supplied: string;
  suppliedUSD: number;
  borrowed: string;
  borrowedUSD: number;
  usageAsCollateralEnabled: boolean;
}

export interface AaveAccountData {
  totalCollateralUSD: number;
  totalDebtUSD: number;
  availableBorrowsUSD: number;
  healthFactor: number;
  ltv: number;
  liquidationThreshold: number;
}

export interface TokenPrice {
  symbol: string;
  address: string;
  priceUSD: number;
  timestamp: number;
}

export interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
}

export interface BybitEarnProduct {
  productId: string;
  coin: string;
  category: string;
  estimateApr: number; // parsed from "3.5%" string
  minStakeAmount: string;
  maxStakeAmount: string;
  status: string;
  duration: 'Flexible' | 'Fixed';
  term: number; // days, 0 for flexible
  swapCoin: string; // what you receive (e.g. "USDE", "METH")
  redeemProcessingMinute: number;
}

export interface CianVault {
  poolName: string;
  poolAddress: string;
  poolType: string;
  apy: number;
  apy7d: number;
  netApy: number | null;
  tvlUsd: number;
  netTvlUsd: number;
  depositCapacity: number | null;
  minDeposit: number | null;
  minWithdraw: number | null;
  feePerformance: number | null;
  feeExit: number | null;
  // On-chain ERC4626 data (optional)
  totalAssets: string | null;
  totalSupply: string | null;
}

export interface WalletBalance {
  symbol: string;
  address: string;
  balance: string;
  formatted: string;
  valueUSD: number;
}

export interface StateSnapshot {
  timestamp: number;
  blockNumber: number;
  wallet: {
    address: string;
    balances: WalletBalance[];
    totalValueUSD: number;
  };
  aave: {
    account: AaveAccountData;
    positions: AaveUserPosition[];
    reserves: AaveReserveData[];
  };
  yields: {
    mantlePools: DefiLlamaPool[];
    topByAPY: DefiLlamaPool[];
  };
  bybit: {
    products: BybitEarnProduct[];
  };
  cian: {
    vaults: CianVault[];
  };
  mcp: {
    lendingMarkets: { protocol: string; asset: string; supplyApy: number; borrowApy: number; [key: string]: unknown }[];
    chainStatus: { blockNumber: number; gasPrice: string; [key: string]: unknown } | null;
  };
  prices: TokenPrice[];
  metadata: {
    collectionTimeMs: number;
    errors: string[];
  };
}

// Agent Types

export interface AgentAction {
  type: 'supply' | 'withdraw' | 'swap' | 'none';
  token_from: string | null;
  token_to: string | null;
  amount: string | null;
  protocol: 'aave' | 'merchant_moe' | 'bybit_earn' | 'cian' | 'lendle' | 'none' | string;
  expected_apy_change: number | null;
  gas_estimate_usd: number | null;
}

export interface AgentDecision {
  timestamp?: number;
  thinking?: string; // Extended thinking chain-of-thought (from Claude thinking block)
  analysis: {
    summary: string;
    changes_detected?: string[];
    current_portfolio_apy?: number;
    risk_level?: 'low' | 'medium' | 'high';
    // Allow flexible fields from Claude reasoning
    [key: string]: unknown;
  };
  decision: {
    action: 'hold' | 'suggest' | 'execute' | 'alert';
    confidence: number;
    urgency?: 'none' | 'low' | 'medium' | 'high';
    reasoning: string;
  } | string; // Claude sometimes returns a string
  actions?: AgentAction[];
  user_message: string;
  // Allow additional fields from Claude
  [key: string]: unknown;
}

export interface ExecutionResult {
  action: AgentAction;
  mode: 'simulate' | 'execute';
  status: 'pending' | 'simulated' | 'success' | 'failed';
  txHash: string | null;
  error: string | null;
  timestamp: number;
}

export interface AgentCycleResult {
  cycleId: string;
  timestamp: number;
  snapshot: StateSnapshot;
  decision: AgentDecision;
  executionResults: ExecutionResult[];
  phases: {
    observe: { durationMs: number; errors: string[] };
    decide: { durationMs: number };
    act: { durationMs: number; safetyPassed: boolean; violations: string[] };
  };
}

export interface StrategyConfig {
  riskProfile: 'conservative' | 'balanced' | 'aggressive';
  maxPositionPercent: number;
  minHealthFactor: number;
  minYieldImprovement: number;
}

export interface SafetyCheckResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
  adjustedActions: AgentAction[];
}
