import type { BybitEarnProduct } from '@/lib/types';

const BYBIT_EARN_URL = 'https://api.bybit.com/v5/earn/product';

let cache: { data: BybitEarnProduct[]; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 min (Bybit updates APR every ~10 min)

// Coins relevant to Mantle CeDeFi flywheel
const RELEVANT_COINS = new Set([
  'ETH', 'METH', 'USDC', 'USDT', 'BTC', 'USDTB',
]);

export async function getBybitEarnProducts(): Promise<BybitEarnProduct[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  const res = await fetch(`${BYBIT_EARN_URL}?category=OnChain`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Bybit Earn API error: ${res.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();

  if (json.retCode !== 0) {
    throw new Error(`Bybit Earn API: ${json.retMsg}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products: BybitEarnProduct[] = (json.result?.list || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p.status === 'Available' && RELEVANT_COINS.has(p.coin))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({
      productId: p.productId,
      coin: p.coin,
      category: p.category,
      estimateApr: parseFloat(p.estimateApr) || 0,
      minStakeAmount: p.minStakeAmount,
      maxStakeAmount: p.maxStakeAmount,
      status: p.status,
      duration: p.duration as 'Flexible' | 'Fixed',
      term: p.term || 0,
      swapCoin: p.swapCoin || '',
      redeemProcessingMinute: p.redeemProcessingMinute || 0,
    }))
    .sort((a: BybitEarnProduct, b: BybitEarnProduct) => b.estimateApr - a.estimateApr);

  cache = { data: products, timestamp: Date.now() };
  return products;
}
