export const MANTLE_CEDEFI_KNOWLEDGE = `
## Mantle CeDeFi Ecosystem

### Protocol Map
- **Aave V3 on Mantle**: Largest lending market. $1.34B TVL. Supports WETH, WMNT, USDC, USDT0, USDe, sUSDe, wrsETH, FBTC, GHO.
- **CIAN Protocol**: Automated yield vault strategies (ERC4626). Partners with Bybit for Mantle Vault. Routes to Aave V3. $330M+ TVL.
  - USDT0 Vault: 0x74D2Bef5Afe200DaCC76FE2D3C4022435b54CdbB (~$272M TVL)
  - USDC Vault: 0x6B2BA8F249cC1376f2A02A9FaF8BEcA5D7718DCf (~$62M TVL)
  - 20% performance fee, 0.1% exit fee
- **Bybit Earn OnChain**: CeDeFi staking products accessible via API. Category "OnChain" for Mantle-relevant products.
  - USDT: ~4.12% APR (flexible), USDC: ~3.5% APR
  - ETH → METH/CMETH/STETH at ~2.11-2.38% APR
  - BTC: 1% APR (45d fixed), 0.38% APR (flexible → LBTC)
- **KelpDAO wrsETH**: Wrapped rsETH (liquid restaking token). Can be supplied on Aave for additional yield. $110M+ TVL.
- **Merchant Moe**: Primary DEX on Mantle. Liquidity Book AMM (bin-based pricing).
- **Lendle**: Aave V2 fork native to Mantle. Sometimes has competitive rates (USDC 8.9%, USDT 8.7%).
- **Bybit Earn / Mantle Vault**: CeFi yield product powered by CIAN. Routes to Aave/DeFi. Bridges 80M CeFi users to DeFi yields.

### CeDeFi Flywheel
Bybit users deposit → Mantle Vault (CIAN) routes to Aave → generates DeFi yields → returns to CeFi.
This is the core narrative: bridging 80M CeFi users to on-chain DeFi yield.

### Key Tokens
- WMNT: Wrapped MNT, native gas token
- WETH: Bridged ETH
- USDC/USDT0: Stablecoins
- mETH: Mantle staked ETH (liquid staking)
- cmETH: Compound mETH (CIAN vault receipt)
- wrsETH: KelpDAO wrapped rsETH (liquid restaking)
- sUSDe: Ethena staked USDe (yield-bearing stablecoin)
- FBTC: Bridged BTC
- GHO: Aave's native stablecoin

### Yield Strategies
1. **Conservative**: USDC/USDT0 supply on Aave (2-5% APY) or Bybit Earn (3.5% APR)
2. **Balanced**: Split between CIAN vaults (3.5% APY) + Aave stables + Lendle (5-9% APY for higher risk)
3. **Aggressive**: wrsETH looping (supply wrsETH → borrow WETH → swap to wrsETH → repeat)
   - Max recommended loops: 2-3x
   - Liquidation risk increases with each loop
   - Monitor health factor closely

### Safety Parameters
- Min health factor: 1.3 (safe) / 1.1 (emergency withdrawal trigger)
- Max single move: 50% of portfolio
- Gas check: skip rebalance if gas > 10% of expected yield gain
- Mantle has very low gas costs (~$0.01-0.05 per tx)

## Mantle Agent Skills Framework

### DeFi Operator (Planning Modes)
When analyzing DeFi opportunities, use one of these modes:
- **discovery_only**: Venue suggestions + rationale only. No addresses, no calldata.
- **compare_only**: Compare verified venues with live data. Cite protocols but no execution details.
- **execution_ready**: Full execution plan with addresses, approval steps, sequencing, and handoff.

### DeFi Venue Ranking
1. Resolve candidate protocols from registry
2. Rank using live signals:
   - Swaps: quote quality, volume, pool depth, slippage risk
   - Lending: TVL, utilization, asset support, withdrawal liquidity
   - Vaults: APY, net APY (after fees), capacity, lock-up period
3. If metrics stale → fall back to known defaults

### Risk Evaluator (Preflight Verdicts)
Before ANY action, run this checklist:
1. Slippage check — does planned slippage exceed user cap?
2. Liquidity depth — would this cause severe price impact?
3. Address safety — is the counterparty verified?
4. Allowance scope — is approval bounded and safe?
5. Gas & deadline — are parameters realistic?

**Verdict**: pass / warn / block
- pass: No fails. Execute.
- warn: No critical fails, but flag for user.
- block: Critical fail detected. DO NOT execute.

### Portfolio Analysis
When assessing a wallet:
1. Check native MNT balance
2. Check all ERC-20 token balances
3. Check Aave positions (collateral, debt, health factor)
4. Check CIAN vault positions (shares, convertToAssets)
5. Check Bybit Earn positions (if authenticated)
6. Classify overall risk: low / medium / high / critical
`;
