import { TOKENS } from '@/lib/chain/contracts';
import type { TokenPrice } from '@/lib/types';

export async function getTokenPrices(): Promise<TokenPrice[]> {
  const addresses = Object.entries(TOKENS)
    .map(([, addr]) => `mantle:${addr}`)
    .join(',');

  const res = await fetch(
    `https://coins.llama.fi/prices/current/${addresses}`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) {
    throw new Error(`DefiLlama prices API error: ${res.status}`);
  }

  const json = await res.json();
  const coins = json.coins || {};
  const prices: TokenPrice[] = [];

  for (const [symbol, address] of Object.entries(TOKENS)) {
    const key = `mantle:${address}`;
    const coin = coins[key];

    if (coin) {
      prices.push({
        symbol,
        address,
        priceUSD: coin.price,
        timestamp: coin.timestamp * 1000,
      });
    }
  }

  return prices;
}

export function buildPriceMap(prices: TokenPrice[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of prices) {
    map.set(p.address.toLowerCase(), p.priceUSD);
  }
  return map;
}
