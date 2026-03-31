# SKILLS.md — MANTIS

## Overview

MANTIS exposes 6 skills that map directly to its two services: the autonomous agent (`mantis-defi-agent`) and the conversational interface (`mantis-chat`). Skills are not external scripts — they are embedded capabilities powered by data collectors, the reasoning engine, the safety module, and 24 callable tools.

Each skill is registered in the ERC-8004 agent metadata (`public/agent-metadata.json`) and advertised to the Mantle Agent Skills framework.

---

## Skill 1: yield-optimization

**Service:** mantis-defi-agent
**Trigger:** Autonomous loop (every cycle) + chat query ("best yield?", "where should I put my USDC?")
**Source:** `src/lib/agent/loop.ts` → `src/lib/agent/engine.ts`

### What It Does

Scans yield opportunities across all integrated venues and identifies the optimal risk-adjusted position for a given asset. This is the core reasoning skill — it powers the OBSERVE → DECIDE → ACT loop.

### Data Sources (7 parallel collectors, ~200ms)

| Source | Collector | Data |
|--------|-----------|------|
| Aave V3 on-chain | `collectors/aave.ts` | 9 reserves — supply APY, borrow APY, utilization, total supply/borrow |
| Bybit Earn API | `collectors/bybit.ts` | OnChain staking products — APR, duration, min/max, swap coin |
| CIAN Protocol | `collectors/cian.ts` | ERC4626 vaults — APY, net APY, TVL, fees, on-chain totalAssets/totalSupply |
| Mantle MCP | `collectors/mcp.ts` | 10 lending markets + chain status via Mantle Agent Scaffold (19 tools, stdio) |
| DefiLlama yields | `collectors/defillama.ts` | 26 Mantle pools sorted by APY across all protocols |
| Token prices | `collectors/prices.ts` | 10 tokens via DefiLlama coins API |
| Wallet balances | `collectors/wallet.ts` | Native MNT + ERC20 balances with USD values |

### Decision Logic

1. **DETECT** — APY shift > 0.5%? New opportunity? Health factor concern?
2. **EVALUATE** — Net gain = (new_yield - current_yield) × position_size - gas - slippage. Only recommend if net gain > $0.50 over 7 days.
3. **RISK CHECK** — Health factor stays > 1.3? Target TVL > $10M? Stress test: ETH -20% → HF > 1.1? Position < 50% of portfolio?
4. **DECIDE** — Output one of: `hold`, `suggest`, `execute`, `alert`.

### Output Schema

```json
{
  "analysis": {
    "summary": "string",
    "changes_detected": ["string"],
    "current_portfolio_apy": 0.0,
    "risk_level": "low | medium | high"
  },
  "decision": {
    "action": "hold | suggest | execute | alert",
    "confidence": 0.0,
    "urgency": "none | low | medium | high",
    "reasoning": "multi-paragraph chain-of-thought"
  },
  "actions": [{
    "type": "supply | withdraw | swap | stake | redeem | none",
    "token_from": "string | null",
    "token_to": "string | null",
    "amount": "string | null",
    "protocol": "aave | bybit_earn | cian | merchant_moe | lendle | none",
    "expected_apy_change": "number | null",
    "gas_estimate_usd": "number | null"
  }],
  "user_message": "string"
}
```

### Model Configuration

- **Model:** Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- **Extended thinking:** Enabled, budget_tokens: 10,000
- **Temperature:** 1 (required when thinking is enabled)
- **Max tokens:** 16,000
- **Output normalization:** `normalizeDecision()` handles Claude's creative JSON formats — extracts from nested keys, alternative field names, code blocks, or partial JSON.

---

## Skill 2: cedefi-routing

**Service:** mantis-defi-agent + mantis-chat
**Trigger:** Every autonomous cycle + chat queries comparing CeFi vs DeFi
**Source:** `src/lib/knowledge/mantle-cedefi.ts` (injected into all prompts)

### What It Does

Routes yield analysis through both DeFi and CeFi venues to find the optimal path. This is what makes MANTIS a CeDeFi agent, not just a DeFi agent. The core value proposition: comparing Aave V3 supply rates against Bybit Earn APR against CIAN vault APY for the same asset.

### The CeDeFi Flywheel

```
Bybit users deposit → Mantle Vault (CIAN) → routes to Aave V3 → DeFi yields → returns to CeFi
```

This creates a closed loop where 80M CeFi users on Bybit access on-chain DeFi yields without managing wallets or gas.

### Venue Comparison Matrix

| Asset | DeFi: Aave V3 | DeFi: CIAN Vault | CeFi: Bybit Earn | DeFi: Lendle |
|-------|---------------|-------------------|-------------------|--------------|
| USDT | Supply APY | USDT0 Vault APY (Net APY after 20% perf fee) | APR (Flexible/Fixed) | Supply APY |
| USDC | Supply APY | USDC Vault APY | APR | Supply APY |
| ETH | Supply APY | — | APR → mETH/cmETH/stETH | — |
| WETH | Supply APY | — | — | Supply APY |

### Routing Strategies (from knowledge base)

1. **Conservative** — USDC/USDT0 supply on Aave (2-5% APY) or Bybit Earn (3.5% APR)
2. **Balanced** — Split between CIAN vaults (3.5%) + Aave stables + Lendle (5-9% for higher risk)
3. **Aggressive** — wrsETH looping: supply wrsETH → borrow WETH → swap to wrsETH → repeat (max 2-3x loops, liquidation risk increases per loop)

### Chat Tools for CeDeFi Routing

- `mantis_bybit_products` — All Bybit Earn OnChain products with APR
- `mantis_bybit_best_rate` — Best rate for a specific coin
- `mantis_cian_vaults` — All CIAN vaults with APY, Net APY, TVL
- `mantle_getLendingMarkets` — Aave V3 rates via MCP

---

## Skill 3: risk-assessment

**Service:** mantis-defi-agent
**Trigger:** Every autonomous cycle (Phase 3: ACT), before any execution
**Source:** `src/lib/agent/safety.ts`

### What It Does

Validates every agent decision against hardcoded safety rules. The safety module runs AFTER the AI reasoning engine but BEFORE any on-chain execution. It is pure TypeScript with hardcoded constants — the AI cannot override, modify, or bypass these rules.

### Safety Rules

| Rule | Constant | Behavior |
|------|----------|----------|
| Health Factor Floor | `MIN_HEALTH_FACTOR = 1.3` | If HF < 1.3 and debt exists, only withdrawals/repayments permitted. No new positions. |
| Emergency Health Factor | `EMERGENCY_HEALTH_FACTOR = 1.1` | If HF < 1.1, immediate block. Forces emergency mode. All actions rejected. |
| Position Size Limit | `MAX_POSITION_MOVE_PERCENT = 0.5` | No single move can exceed 50% of total portfolio value. Calculated per-action using token prices. |
| Gas Profitability | Calculated per-action | If gas cost exceeds weekly expected gain from the rebalance, generates a warning. |

### Safety Check Flow

```
AI Decision → checkSafety(decision, snapshot, config)
  → Rule 1: HF Floor check (violation if HF < 1.3 + non-protective action)
  → Rule 2: Emergency HF check (violation if HF < 1.1)
  → Rule 3: Position size check (violation if move > 50% portfolio)
  → Rule 4: Gas check (warning if gas > weekly gain)
  → Return { passed: boolean, violations: string[], warnings: string[], adjustedActions: AgentAction[] }
```

### Output

```typescript
interface SafetyCheckResult {
  passed: boolean;           // false if any violation exists
  violations: string[];      // hard blocks — action will NOT execute
  warnings: string[];        // soft alerts — action proceeds with warning
  adjustedActions: AgentAction[];  // empty if violations, original actions if passed
}
```

### Behavior on Failure

- **Violations present:** `adjustedActions = []` — no actions execute. The agent logs the violation and reports to the user.
- **Warnings only:** Actions proceed, warnings are displayed in the agent log and dashboard.
- **The AI sees the safety check result** in the next cycle's `previousDecision` context, so it can adapt its strategy.

---

## Skill 4: portfolio-analysis

**Service:** mantis-defi-agent + mantis-chat
**Trigger:** Every autonomous cycle (Phase 1: OBSERVE) + chat tool `mantis_yield_projection`
**Source:** `src/lib/calculators/yield-projection.ts` + `src/lib/collectors/index.ts`

### What It Does

Builds a complete picture of a wallet's DeFi positions across Aave V3 and CIAN Protocol, calculates blended APY, and projects daily/monthly/annual yield including net yield after borrow costs.

### Data Collected

1. **Aave V3 positions** — Per-reserve: supplied amount (USD), borrowed amount (USD), collateral enabled, supply APY, borrow APY
2. **CIAN vault positions** — On-chain ERC4626 `balanceOf()` → `convertToAssets()` for each vault the user has shares in
3. **Aave account summary** — Total collateral, total debt, available borrows, health factor, LTV, liquidation threshold
4. **Wallet balances** — Native MNT + 10 ERC20 tokens with USD values
5. **Token prices** — Real-time via DefiLlama coins API

### Yield Projection Calculation

For each position:
```
projectedAnnualYieldUSD = amountUSD × (positionAPY / 100)
userSharePercent = (amountUSD / poolTotalUSD) × 100
```

For the portfolio:
```
blendedAPY = totalSupplyIncome / totalSupplyValue × 100
netAnnual = supplyIncomeAnnual - borrowCostAnnual
```

### Output Schema (PortfolioProjection)

```typescript
{
  positions: [{
    protocol: 'aave' | 'cian',
    asset: string,
    type: 'supply' | 'borrow' | 'vault',
    amountUSD: number,
    poolTotalUSD: number,
    userSharePercent: number,
    positionAPY: number,
    projectedAnnualYieldUSD: number,
  }],
  totalValueUSD: number,
  blendedAPY: number,
  projectedYield: { daily, monthly, annual },
  netYield: { supplyIncomeAnnual, borrowCostAnnual, netAnnual, netMonthly, netDaily },
  summary: string,
}
```

### Chat Tool

- `mantis_yield_projection` — Triggers `calculateYieldProjection(wallet)`, returns the full `PortfolioProjection` object with human-readable summary.

---

## Skill 5: conversational-defi

**Service:** mantis-chat
**Trigger:** User sends a message in the chat interface
**Source:** `src/app/api/chat/route.ts`

### What It Does

Interactive conversational agent with access to 24 real-time tools (19 via Mantle Agent Scaffold MCP + 5 native MANTIS tools). Every chat response is grounded in live on-chain data — MANTIS never answers from memory when tools are available.

### Tool Inventory (24 tools)

**MCP Tools (19) — via Mantle Agent Scaffold over stdio:**

| Category | Tools |
|----------|-------|
| Network Primer | `mantle_getChainInfo`, `mantle_getChainStatus` |
| Portfolio Analyst | `mantle_getBalance`, `mantle_getTokenBalances`, `mantle_getAllowances` |
| Registry Navigator | `mantle_getTokenInfo`, `mantle_getTokenPrices`, `mantle_resolveToken`, `mantle_resolveAddress`, `mantle_validateAddress` |
| DeFi Operator | `mantle_getSwapQuote`, `mantle_getPoolLiquidity`, `mantle_getPoolOpportunities`, `mantle_getProtocolTvl`, `mantle_getLendingMarkets` |
| Data Indexer | `mantle_querySubgraph`, `mantle_queryIndexerSql` |
| Readonly Debugger | `mantle_checkRpcHealth`, `mantle_probeEndpoint` |

**MANTIS Native Tools (5):**

| Tool | Description |
|------|-------------|
| `mantis_yield_projection` | Projected yield across Aave V3 + CIAN positions |
| `mantis_bybit_products` | All Bybit Earn OnChain staking products |
| `mantis_bybit_best_rate` | Best APR for a specific coin on Bybit Earn |
| `mantis_cian_vaults` | CIAN vault data (APY, Net APY, TVL, fees, on-chain state) |
| `mantis_cian_user_position` | User's CIAN ERC4626 vault positions (shares → assets) |

### Chat Model Configuration

- **Model:** Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- **Thinking:** Adaptive (enabled when the model determines it's beneficial)
- **Max output tokens:** 32,000
- **Max tool steps:** 15 (via `stopWhen: stepCountIs(15)`)
- **Live data injection:** Every chat request fetches a fresh `StateSnapshot` and injects it as context — the AI starts each conversation turn with current Aave rates, Bybit products, CIAN vaults, token prices, and wallet balances.

### Tool Usage Rules (from system prompt)

1. Always use tools for on-chain data — never answer from memory.
2. If a tool errors, explain the error and suggest alternatives. Do not retry the same failing tool more than once.
3. Never call the same tool with the same parameters more than twice.
4. When comparing yields, always check Aave + Bybit Earn + CIAN for the full CeDeFi picture.
5. The live data context is a snapshot for awareness — always verify via tool calls for specific questions.
6. If referencing a protocol without a dedicated tool (e.g. Lendle), state the data source is DefiLlama aggregated data.

### Personality in Chat

- Lead with numbers, follow with context.
- No filler phrases. No "Sure!", "Of course!", "I'd be happy to help."
- Assumes the user understands DeFi. Does not explain basics unless asked.
- Every analysis ends with a clear recommendation.

---

## Skill 6: on-chain-identity

**Service:** mantis-defi-agent
**Trigger:** `/api/identity` endpoint + identity dashboard page
**Source:** `src/lib/identity/erc8004.ts`

### What It Does

Implements ERC-8004 agent identity registration on Mantle. This standard (ERC-721 extension) allows autonomous agents to register on-chain, store metadata, and build reputation through the IdentityRegistry and ReputationRegistry contracts.

### Contracts

| Contract | Address |
|----------|---------|
| IdentityRegistry | `ERC8004.IDENTITY_REGISTRY` (Mantle mainnet) |
| ReputationRegistry | `ERC8004.REPUTATION_REGISTRY` (Mantle mainnet) |

### Capabilities

1. **Registration calldata generation** — `prepareRegistrationCalldata(agentURI)` encodes `register(string)` calldata for signing by the wallet owner.
2. **Agent metadata** — Follows ERC-8004 `registration-v1` schema with name, description, image, services, skills, supported protocols.
3. **Registry queries** — `getTotalAgents()`, `getAgentCount(address)`, `getAgentURI(agentId)` via on-chain reads.
4. **Registration info endpoint** — `/api/identity` returns registry addresses, total registered agents, MANTIS metadata, registration cost (free, gas only ~0.001 MNT).

### Agent Metadata Schema

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "MANTIS",
  "description": "Autonomous CeDeFi agent on Mantle | Built on Agent Scaffold + MCP + Agent Skills | OBSERVE → DECIDE → ACT",
  "image": "https://raw.githubusercontent.com/ShallIfy/mantis-agent/main/public/mantis-logo.png",
  "services": [
    {
      "name": "mantis-defi-agent",
      "skills": ["yield-optimization", "cedefi-routing", "risk-assessment", "portfolio-analysis"],
      "domains": ["defi", "mantle"]
    },
    {
      "name": "mantis-chat",
      "skills": ["conversational-defi", "mantle-knowledge"],
      "domains": ["defi", "mantle"]
    }
  ],
  "supportedTrust": ["ERC-8004"],
  "supportedProtocols": ["MCP"]
}
```

### Boundaries

- Does not sign transactions — generates unsigned calldata for the user to sign.
- Does not store or handle private keys.
- Registration is permissionless (anyone can register an agent identity).
- Standard: ERC-721 + ERC-8004 extension.

---

## Skill Dependencies

```
yield-optimization
├── cedefi-routing (venue comparison)
├── risk-assessment (safety validation)
└── portfolio-analysis (current state)

conversational-defi
├── yield-optimization (via mantis_yield_projection)
├── cedefi-routing (via mantis_bybit_*, mantis_cian_*)
└── portfolio-analysis (via mantis_yield_projection, mantis_cian_user_position)

on-chain-identity
└── (independent — metadata + registry only)
```
