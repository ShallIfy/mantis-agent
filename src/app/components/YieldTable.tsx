'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface Reserve {
  symbol: string;
  supplyAPY: number;
  borrowAPY: number;
  utilizationRate: number;
  totalSupply: string;
}

interface Pool {
  project: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
}

interface BybitProduct {
  productId: string;
  coin: string;
  estimateApr: number;
  duration: string;
  swapCoin: string;
  minStakeAmount: string;
}

interface CianVault {
  poolName: string;
  poolAddress: string;
  apy: number;
  netApy: number | null;
  tvlUsd: number;
  feePerformance: number | null;
}

type TabType = 'aave' | 'bybit' | 'cian' | 'ecosystem';

export default function YieldTable() {
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [bybitProducts, setBybitProducts] = useState<BybitProduct[]>([]);
  const [cianVaults, setCianVaults] = useState<CianVault[]>([]);
  const [tab, setTab] = useState<TabType>('aave');

  useEffect(() => {
    const wallet = process.env.NEXT_PUBLIC_DEMO_WALLET || '0x0000000000000000000000000000000000000001';
    fetch(`/api/snapshot?wallet=${wallet}`)
      .then(r => r.json())
      .then(data => {
        setReserves(data.aave?.reserves || []);
        setPools(data.yields?.topByAPY || []);
        setBybitProducts(data.bybit?.products || []);
        setCianVaults(data.cian?.vaults || []);
      })
      .catch(() => {});
  }, []);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'aave', label: 'Aave V3' },
    { key: 'bybit', label: 'Bybit' },
    { key: 'cian', label: 'CIAN' },
    { key: 'ecosystem', label: 'All' },
  ];

  return (
    <div className="mantis-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" /> Yield Opportunities
        </h2>
        <div className="flex gap-1 text-xs">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-2 py-1 rounded ${tab === t.key ? 'bg-[var(--mantis-green)] text-black font-medium' : 'text-gray-400'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'aave' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-[var(--card-border)]">
                <th className="text-left py-2">Token</th>
                <th className="text-right py-2">Supply APY</th>
                <th className="text-right py-2">Borrow APY</th>
                <th className="text-right py-2">Util %</th>
              </tr>
            </thead>
            <tbody>
              {reserves
                .filter(r => r.supplyAPY > 0 || parseFloat(r.totalSupply) > 0)
                .sort((a, b) => b.supplyAPY - a.supplyAPY)
                .map(r => (
                  <tr key={r.symbol} className="border-b border-[var(--card-border)] border-opacity-30">
                    <td className="py-2 font-medium">{r.symbol}</td>
                    <td className="py-2 text-right text-mantis">{r.supplyAPY.toFixed(2)}%</td>
                    <td className="py-2 text-right text-red-400">{r.borrowAPY.toFixed(2)}%</td>
                    <td className="py-2 text-right text-gray-400">{r.utilizationRate.toFixed(0)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'bybit' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-[var(--card-border)]">
                <th className="text-left py-2">Coin</th>
                <th className="text-right py-2">APR</th>
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Receive</th>
              </tr>
            </thead>
            <tbody>
              {bybitProducts.map(p => (
                <tr key={p.productId} className="border-b border-[var(--card-border)] border-opacity-30">
                  <td className="py-2 font-medium">{p.coin}</td>
                  <td className="py-2 text-right text-mantis">{p.estimateApr.toFixed(2)}%</td>
                  <td className="py-2 text-gray-400">{p.duration}</td>
                  <td className="py-2 text-gray-400">{p.swapCoin || '—'}</td>
                </tr>
              ))}
              {bybitProducts.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-gray-500">Loading...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cian' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-[var(--card-border)]">
                <th className="text-left py-2">Vault</th>
                <th className="text-right py-2">APY</th>
                <th className="text-right py-2">Net APY</th>
                <th className="text-right py-2">TVL</th>
              </tr>
            </thead>
            <tbody>
              {cianVaults.map(v => (
                <tr key={v.poolAddress} className="border-b border-[var(--card-border)] border-opacity-30">
                  <td className="py-2 font-medium text-xs">{v.poolName}</td>
                  <td className="py-2 text-right text-mantis">{v.apy.toFixed(2)}%</td>
                  <td className="py-2 text-right text-yellow-400">{v.netApy !== null ? `${v.netApy.toFixed(2)}%` : '—'}</td>
                  <td className="py-2 text-right text-gray-400">
                    ${v.tvlUsd > 1e6 ? `${(v.tvlUsd / 1e6).toFixed(0)}M` : `${(v.tvlUsd / 1e3).toFixed(0)}K`}
                  </td>
                </tr>
              ))}
              {cianVaults.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-gray-500">Loading...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'ecosystem' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-[var(--card-border)]">
                <th className="text-left py-2">Protocol</th>
                <th className="text-left py-2">Token</th>
                <th className="text-right py-2">APY</th>
                <th className="text-right py-2">TVL</th>
              </tr>
            </thead>
            <tbody>
              {pools.slice(0, 10).map((p, i) => (
                <tr key={i} className="border-b border-[var(--card-border)] border-opacity-30">
                  <td className="py-2 text-gray-400">{p.project}</td>
                  <td className="py-2 font-medium">{p.symbol}</td>
                  <td className="py-2 text-right text-mantis">{p.apy.toFixed(2)}%</td>
                  <td className="py-2 text-right text-gray-400">
                    ${p.tvlUsd > 1e6 ? `${(p.tvlUsd / 1e6).toFixed(1)}M` : `${(p.tvlUsd / 1e3).toFixed(0)}K`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
