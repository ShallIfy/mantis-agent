# MANTIS

**Mantle Autonomous Network Trading & Intelligence System**

The first autonomous DeFi agent built for Mantle's CeDeFi flywheel.

## What is MANTIS?

MANTIS is an autonomous DeFi agent that monitors and optimizes yield across Mantle's CeDeFi ecosystem. Unlike chatbots that just talk, MANTIS **executes** — running a three-phase autonomous loop:

```
OBSERVE → DECIDE → ACT
```

1. **OBSERVE** — Collects real-time data from Aave V3, DefiLlama, and on-chain token prices via Mantle RPC
2. **DECIDE** — Claude AI reasoning engine analyzes market conditions, evaluates strategies, and produces structured decisions
3. **ACT** — Safety module validates decisions against hardcoded rules before execution (health factor floors, position limits, gas checks)

## Features

- **Live DeFi Data** — Real-time Aave V3 rates, yield pools, and token prices from Mantle mainnet
- **AI Reasoning Engine** — Claude-powered analysis with structured JSON decision output
- **Safety Module** — Pure TypeScript safety checks that cannot be overridden by the LLM
- **Interactive Chat** — Ask MANTIS about yields, strategies, and risk scenarios with live data context
- **Dashboard** — Portfolio overview, yield table, agent activity log, and chat interface
- **Simulate/Execute Modes** — Safe simulation by default, real on-chain execution when ready

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router) |
| Chain | viem (Mantle, Chain ID 5000) |
| AI Reasoning | Anthropic Claude (Sonnet) |
| Chat | Vercel AI SDK (streaming) |
| Data | Aave V3 RPC + DefiLlama API |
| UI | Tailwind CSS + lucide-react |

## Architecture

```
src/
├── app/
│   ├── dashboard/         # Main dashboard page
│   ├── chat/              # Full-page chat interface
│   ├── api/
│   │   ├── chat/          # Streaming chat with live data
│   │   ├── snapshot/      # Full state snapshot endpoint
│   │   └── agent/         # Agent cycle trigger + logs
│   └── components/        # UI components
└── lib/
    ├── chain/             # viem config, contracts, ABIs
    ├── collectors/        # Data collection (Aave, DefiLlama, prices, wallet)
    ├── agent/             # Reasoning engine, safety, executor, loop
    └── knowledge/         # CeDeFi ecosystem context
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.local.example .env.local
# Add your ANTHROPIC_API_KEY

# Run development server
pnpm dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude reasoning |
| `MANTLE_RPC_URL` | No | Mantle RPC endpoint (defaults to public RPC) |
| `NEXT_PUBLIC_DEMO_WALLET` | No | Wallet address for dashboard display |
| `EXECUTION_MODE` | No | `simulate` (default) or `execute` |

## Safety

MANTIS includes a hardcoded safety module that runs **after** AI reasoning but **before** any execution:

- Health Factor floor: 1.3 (emergency at 1.1)
- Maximum position move: 50% of total
- Gas profitability check
- All rules are pure TypeScript — the LLM cannot override them

## Built For

**"When AI Meets Mantle"** bounty — demonstrating autonomous DeFi agents on Mantle's CeDeFi infrastructure.

## Links

- Website: [mantisagent.xyz](https://mantisagent.xyz)
- Twitter: [@mantis_xyz](https://twitter.com/mantis_xyz)
