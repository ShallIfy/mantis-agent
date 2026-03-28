export const MANTLE_CEDEFI_KNOWLEDGE = `
## Mantle CeDeFi Ecosystem

### Protocol Map
- **Aave V3 on Mantle**: Largest lending market. $1.34B TVL. Supports WETH, WMNT, USDC, USDT0, USDe, sUSDe, wrsETH, FBTC, GHO.
- **CIAN Protocol**: Automated yield vault strategies. Partners with Bybit for Mantle Vault. Routes to Aave V3. $150M+ AUM.
- **KelpDAO wrsETH**: Wrapped rsETH (liquid restaking token). Can be supplied on Aave for additional yield. $110M+ TVL.
- **Merchant Moe**: Primary DEX on Mantle. Liquidity Book AMM (bin-based pricing).
- **Lendle**: Aave V2 fork native to Mantle. Sometimes has competitive rates.
- **Bybit Earn / Mantle Vault**: CeFi yield product powered by CIAN. Routes to Aave/DeFi. Bridges 80M CeFi users to DeFi yields.

### CeDeFi Flywheel
Bybit users deposit → Mantle Vault (CIAN) routes to Aave → generates DeFi yields → returns to CeFi.
This is the core narrative: bridging 80M CeFi users to on-chain DeFi yield.

### Key Tokens
- WMNT: Wrapped MNT, native gas token
- WETH: Bridged ETH
- USDC/USDT0: Stablecoins
- mETH: Mantle staked ETH (liquid staking)
- wrsETH: KelpDAO wrapped rsETH (liquid restaking)
- sUSDe: Ethena staked USDe (yield-bearing stablecoin)
- FBTC: Bridged BTC
- GHO: Aave's native stablecoin

### Yield Strategies
1. **Conservative**: USDC/USDT0 supply on Aave (2-5% APY)
2. **Balanced**: Split between stables + wrsETH/mETH supply (3-7% APY avg)
3. **Aggressive**: wrsETH looping (supply wrsETH → borrow WETH → swap to wrsETH → repeat)
   - Max recommended loops: 2-3x
   - Liquidation risk increases with each loop
   - Monitor health factor closely

### Safety Parameters
- Min health factor: 1.3 (safe) / 1.1 (emergency withdrawal trigger)
- Max single move: 50% of portfolio
- Gas check: skip rebalance if gas > 10% of expected yield gain
- Mantle has very low gas costs (~$0.01-0.05 per tx)
`;
