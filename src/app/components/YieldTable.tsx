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

export default function YieldTable() {
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [tab, setTab] = useState<'aave' | 'ecosystem'>('aave');

  useEffect(() => {
    const wallet = process.env.NEXT_PUBLIC_DEMO_WALLET || '0x0000000000000000000000000000000000000001';
    fetch(`/api/snapshot?wallet=${wallet}`)
      .then(r => r.json())
      .then(data => {
        setReserves(data.aave?.reserves || []);
        setPools(data.yields?.topByAPY || []);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mantis-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" /> Yield Opportunities
        </h2>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setTab('aave')}
            className={`px-2 py-1 rounded ${tab === 'aave' ? 'bg-[var(--mantis-green)] text-black font-medium' : 'text-gray-400'}`}
          >
            Aave V3
          </button>
          <button
            onClick={() => setTab('ecosystem')}
            className={`px-2 py-1 rounded ${tab === 'ecosystem' ? 'bg-[var(--mantis-green)] text-black font-medium' : 'text-gray-400'}`}
          >
            Ecosystem
          </button>
        </div>
      </div>

      {tab === 'aave' ? (
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
      ) : (
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
