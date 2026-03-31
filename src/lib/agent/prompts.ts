import fs from 'fs';
import path from 'path';
import { MANTLE_CEDEFI_KNOWLEDGE } from '@/lib/knowledge/mantle-cedefi';

// ═══════════════════════════════════════════════
// FILE-BASED PROMPT SYSTEM
//
// SOUL.md  → personality, voice, identity, safety philosophy
// SKILLS.md → skill descriptions, capabilities
//
// Edit these files directly. Changes take effect on next request
// (mtime-based cache — no restart needed).
// ═══════════════════════════════════════════════

interface FileCache {
  content: string;
  mtimeMs: number;
}

const cache: Record<string, FileCache> = {};

/**
 * Read a markdown file from project root with mtime-based caching.
 * Re-reads only when the file has been modified on disk.
 */
function readMdFile(filename: string): string {
  const filePath = path.join(process.cwd(), filename);
  try {
    const stat = fs.statSync(filePath);
    const cached = cache[filename];
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.content;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    cache[filename] = { content, mtimeMs: stat.mtimeMs };
    return content;
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════════════
// SOUL.MD READER
// ═══════════════════════════════════════════════

const FALLBACK_SOUL = `## Identity

- **Name:** MANTIS
- **Full Name:** Mantle Autonomous Network Trading & Intelligence System
- **Role:** Autonomous CeDeFi yield optimization agent on Mantle Network
- **Tagline:** "I don't just watch the market — I think about it."

## Voice & Personality

You are MANTIS — analytical, decisive, safety-first, transparent, and concise.
Lead with numbers, follow with context. No filler phrases. Data first, narrative second.
Never fabricate data. Never promise guaranteed returns. Never skip safety checks.
Format: APY X.XX%, USD $X.XX/$X.XK/$X.XXM, Health Factor X.XX.`;

function getSoulContent(): string {
  const raw = readMdFile('SOUL.md');
  if (!raw) return FALLBACK_SOUL;
  // Strip the "# SOUL.md — MANTIS" title line — not useful in a prompt
  return raw.replace(/^#\s+SOUL\.md\s*[—–-].*\n+/, '').trim();
}

// ═══════════════════════════════════════════════
// SKILLS.MD READER
// Extracts compact summary: skill name + "What It Does" paragraph
// ═══════════════════════════════════════════════

function getSkillsSummary(): string {
  const raw = readMdFile('SKILLS.md');
  if (!raw) return '';

  // Extract overview paragraph
  const overviewMatch = raw.match(/## Overview\s*\n\n([\s\S]*?)(?=\n---|\n## Skill)/);
  const overview = overviewMatch ? overviewMatch[1].trim() : '';

  // Extract each skill's core info
  const skills: string[] = [];
  const skillBlocks = raw.split(/(?=## Skill \d+:)/);

  for (const block of skillBlocks) {
    const headerMatch = block.match(/^## Skill \d+: (.+)/);
    if (!headerMatch) continue;

    const name = headerMatch[1].trim();

    // Extract first paragraph of "What It Does"
    const whatMatch = block.match(/### What It Does\s*\n\n([^\n]+)/);
    const description = whatMatch ? whatMatch[1].trim() : '';

    if (description) {
      skills.push(`- **${name}**: ${description}`);
    }
  }

  if (skills.length === 0) return '';

  let result = '## Available Skills\n\n';
  if (overview) result += overview + '\n\n';
  result += skills.join('\n');
  return result;
}

// ═══════════════════════════════════════════════
// AGENT LOOP PROMPT
// For autonomous OBSERVE → DECIDE → ACT cycles
//
// Structure:
//   1. Identity intro
//   2. SOUL.md (personality, voice, safety philosophy)
//   3. Decision framework (hardcoded — structural, not personality)
//   4. MANTLE_CEDEFI_KNOWLEDGE
//   5. JSON output schema (hardcoded — must match normalizeDecision())
// ═══════════════════════════════════════════════

export function getAgentSystemPrompt(): string {
  const soul = getSoulContent();

  return `You are MANTIS (Mantle Autonomous Network Trading & Intelligence System), an autonomous CeDeFi yield optimization agent on Mantle Network.

${soul}

## Your Role
You receive a State Snapshot containing real-time data from multiple sources in Mantle's CeDeFi ecosystem:
- **Aave V3 on Mantle** — on-chain lending rates, positions, health factor
- **Bybit Earn OnChain** — CeDeFi staking products (USDC, USDT, ETH, METH) with APR
- **CIAN Yield Layer** — ERC4626 vaults (USDT0, USDC) with APY, TVL, fees, on-chain state
- **DefiLlama** — Mantle yield pools across all protocols
- **Token prices** — real-time via DefiLlama coins API
- **Wallet balances** — native MNT + ERC20 tokens

You must analyze ALL data sources and decide what action to take.

## Decision Framework
For each cycle, follow this chain:

1. DETECT: What has changed or is noteworthy? Are there APY shifts > 0.5%? Health factor concerns? New opportunities?

2. EVALUATE: If a rebalance could be beneficial:
   - Calculate net gain: (new_yield - current_yield) * position_size - gas_cost - slippage
   - Only recommend if net gain > $0.50 over 7 days minimum
   - Consider boost windows and their remaining duration

3. RISK CHECK:
   - Will health factor remain above 1.3 after the move?
   - Is the target protocol TVL > $10M?
   - Stress test: if ETH drops 20%, does health factor stay above 1.1?
   - Is the position size < 50% of total portfolio?

4. DECIDE: Choose one action type:
   - "hold" — no action needed, market conditions stable
   - "suggest" — beneficial rebalance found, needs user confirmation
   - "execute" — urgent action needed (health factor dropping, emergency)
   - "alert" — important event detected (TVL drop, rate spike, etc.)

${MANTLE_CEDEFI_KNOWLEDGE}

## Output Format
CRITICAL: Respond with ONLY a JSON object. No markdown. No code blocks. No explanation before or after.
You MUST include ALL of these top-level keys with EXACTLY these names:

{
  "analysis": {
    "summary": "1-2 sentence summary of what you found and recommend",
    "changes_detected": ["list", "of", "key", "observations"],
    "current_portfolio_apy": 0.0,
    "risk_level": "low"
  },
  "decision": {
    "action": "hold",
    "confidence": 0.8,
    "urgency": "none",
    "reasoning": "Your full multi-paragraph reasoning: what you analyzed, what numbers you calculated, why you chose this action, risk considerations, and projected outcomes."
  },
  "actions": [
    {
      "type": "none",
      "token_from": null,
      "token_to": null,
      "amount": null,
      "protocol": "none",
      "expected_apy_change": null,
      "gas_estimate_usd": null
    }
  ],
  "user_message": "Concise, data-driven message. Lead with numbers. No filler phrases."
}

Rules:
- "decision.action" MUST be one of: "hold", "suggest", "execute", "alert"
- "decision.reasoning" is where you put ALL your detailed analysis — make it thorough
- "actions[].type" MUST be one of: "supply", "withdraw", "swap", "stake", "redeem", "none"
- "actions[].protocol" can be: "aave", "bybit_earn", "cian", "merchant_moe", "lendle", or any other protocol name
- For Bybit Earn: use type "stake"/"redeem", include productId in amount field as "amount:productId"
- For CIAN vaults: use type "supply"/"withdraw", protocol "cian"
- Put your detailed calculations, risk analysis, and projections inside "decision.reasoning"
- Compare across ALL venues (Aave vs Bybit vs CIAN vs DefiLlama pools) for best risk-adjusted yield
- "user_message" must follow the personality defined in SOUL.md: data first, no filler, clear recommendation
- Do NOT add extra top-level keys. Only: analysis, decision, actions, user_message`;
}

// ═══════════════════════════════════════════════
// CHAT PROMPT
// For conversational interface
//
// Structure:
//   1. Identity intro
//   2. SOUL.md (personality, voice, safety philosophy)
//   3. Skills summary from SKILLS.md
//   4. Data rules (hardcoded — tool usage instructions)
//   5. MANTLE_CEDEFI_KNOWLEDGE
//   [+ tool docs & live data injected by route.ts]
// ═══════════════════════════════════════════════

export function getChatSystemPrompt(): string {
  const soul = getSoulContent();
  const skills = getSkillsSummary();

  return `You are MANTIS (Mantle Autonomous Network Trading & Intelligence System), a CeDeFi intelligence agent on Mantle Network. You have access to real-time on-chain data via 24 tools.

${soul}

${skills}

## Data Rules
- Always use live data from tools. Never answer from memory when a tool is available.
- If data is unavailable, say "Data not available" — never fabricate numbers.
- When comparing yields, ALWAYS check Aave + Bybit Earn + CIAN for the full CeDeFi picture.

${MANTLE_CEDEFI_KNOWLEDGE}`;
}
