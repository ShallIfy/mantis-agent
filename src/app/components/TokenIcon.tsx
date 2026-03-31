'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const TOKEN_LOGO_MAP: Record<string, string> = {
  // Mantle Token List CDN
  MNT:    'https://token-list.mantle.xyz/data/Mantle/logo.svg',
  WMNT:   'https://token-list.mantle.xyz/data/Mantle/logo.svg',
  WETH:   'https://token-list.mantle.xyz/data/WETH/logo.svg',
  ETH:    'https://token-list.mantle.xyz/data/WETH/logo.svg',
  USDC:   'https://token-list.mantle.xyz/data/USDC/logo.png',
  USDT:   'https://token-list.mantle.xyz/data/USDT/logo.svg',
  USDT0:  'https://token-list.mantle.xyz/data/USDT0/logo.svg',
  mETH:   'https://token-list.mantle.xyz/data/mETH/logo.svg',
  METH:   'https://token-list.mantle.xyz/data/mETH/logo.svg',
  cmETH:  'https://token-list.mantle.xyz/data/cmETH/logo.svg',
  CMETH:  'https://token-list.mantle.xyz/data/cmETH/logo.svg',
  FBTC:   'https://token-list.mantle.xyz/data/FBTC/logo.svg',
  wstETH: 'https://token-list.mantle.xyz/data/wstETH/logo.svg',
  wrsETH: 'https://token-list.mantle.xyz/data/wrsETH/logo.svg',
  USDY:   'https://token-list.mantle.xyz/data/USDY/logo.png',
  // External CDNs
  GHO:    'https://app.aave.com/icons/tokens/gho.svg',
  USDe:   'https://ethena.fi/shared/usde.svg',
  USDE:   'https://ethena.fi/shared/usde.svg',
  sUSDe:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x9D39A5DE30e57443BfF2A8307A4256c8797A3497/logo.png',
  SUSDE:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x9D39A5DE30e57443BfF2A8307A4256c8797A3497/logo.png',
  STETH:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84/logo.png',
  stETH:  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84/logo.png',
  BTC:    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
};

const TOKEN_COLORS: Record<string, string> = {
  MNT: '#00D26E',
  WMNT: '#00D26E',
  WETH: '#627eea',
  ETH: '#627eea',
  USDC: '#2775ca',
  USDT: '#50af95',
  USDT0: '#50af95',
  mETH: '#9b59b6',
  METH: '#9b59b6',
  cmETH: '#e67e22',
  CMETH: '#e67e22',
  FBTC: '#f7931a',
  wstETH: '#00a3ff',
  wrsETH: '#00cfbe',
  GHO: '#2ebac6',
  USDe: '#1a1a2e',
  USDE: '#1a1a2e',
  sUSDe: '#1a1a2e',
  SUSDE: '#1a1a2e',
  USDY: '#1c3a5f',
  BTC: '#f7931a',
  STETH: '#00a3ff',
  stETH: '#00a3ff',
  LBTC: '#f7931a',
  USDTB: '#50af95',
};

const SIZES = {
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
} as const;

const FONT_SIZES = {
  sm: 'text-[0.5rem]',
  md: 'text-[0.55rem]',
  lg: 'text-[0.65rem]',
} as const;

interface TokenIconProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function TokenIcon({ symbol, size = 'md', className }: TokenIconProps) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = TOKEN_LOGO_MAP[symbol];
  const color = TOKEN_COLORS[symbol] || '#6b7c72';

  if (logoUrl && !imgError) {
    return (
      <div className={cn(
        SIZES[size],
        'rounded-full overflow-hidden flex-shrink-0 bg-black/30 ring-1 ring-white/10',
        className
      )}>
        <img
          src={logoUrl}
          alt={symbol}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        SIZES[size],
        FONT_SIZES[size],
        'rounded-full flex items-center justify-center flex-shrink-0 font-bold text-black ring-1 ring-white/10',
        className
      )}
      style={{ background: color }}
    >
      {symbol.charAt(0)}
    </div>
  );
}

export { TOKEN_COLORS };
