// Verified contract addresses on Mantle Mainnet (Chain ID 5000)
// Source: aave-address-book, Merchant Moe docs, Mantlescan

export const AAVE_V3 = {
  POOL: '0x458F293454fE0d67EC0655f3672301301DD51422',
  POOL_DATA_PROVIDER: '0x487c5c669D9eee6057C44973207101276cf73b68',
  ORACLE: '0x47a063CfDa980532267970d478EC340C0F80E8df',
  UI_POOL_DATA_PROVIDER: '0x077df1990bF703fb1687515747ddb13621133649',
  WALLET_BALANCE_PROVIDER: '0x91855bbfE5F19c245C3dA9B9fC954394a6f9da8f',
} as const;

export const TOKENS = {
  WETH: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
  WMNT: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
  USDC: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
  USDT0: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
  USDe: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34',
  sUSDe: '0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2',
  wrsETH: '0x93e855643e940D025bE2e529272e4Dbd15a2Cf74',
  mETH: '0xcDA86A272531e8640cD7F1a92c01839911B90BB0',
  FBTC: '0xC96dE26018A54D51c097160568752c4E3BD6C364',
  GHO: '0xfc421aD3C883Bf9E7C4f42dE845C4e4405799e73',
} as const;

export const TOKEN_DECIMALS: Record<string, number> = {
  WETH: 18,
  WMNT: 18,
  USDC: 6,
  USDT0: 6,
  USDe: 18,
  sUSDe: 18,
  wrsETH: 18,
  mETH: 18,
  FBTC: 8,
  GHO: 18,
};

export const ERC8004 = {
  IDENTITY_REGISTRY: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  REPUTATION_REGISTRY: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
} as const;

export const CIAN_VAULTS = {
  USDT0: '0x74D2Bef5Afe200DaCC76FE2D3C4022435b54CdbB',
  USDC: '0x6B2BA8F249cC1376f2A02A9FaF8BEcA5D7718DCf',
} as const;

export const MERCHANT_MOE = {
  ROUTER: '0xeaEE7EE68874218c3558b40063c42B82D3E7232a',
  LB_ROUTER: '0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a',
  FACTORY: '0x5bef015ca9424a7c07b68490616a4c1f094bedec',
} as const;

// Tokens with LTV > 0 on Aave V3 Mantle — can be used as collateral
export const COLLATERAL_TOKENS: ReadonlySet<string> = new Set(['WETH', 'WMNT']);

export type TokenSymbol = keyof typeof TOKENS;

export function getTokenAddress(symbol: TokenSymbol): `0x${string}` {
  return TOKENS[symbol] as `0x${string}`;
}

export function getTokenSymbol(address: string): TokenSymbol | undefined {
  const normalized = address.toLowerCase();
  for (const [symbol, addr] of Object.entries(TOKENS)) {
    if (addr.toLowerCase() === normalized) return symbol as TokenSymbol;
  }
  return undefined;
}
