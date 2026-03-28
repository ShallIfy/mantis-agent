'use client';

import { useEffect, useState } from 'react';
import { Shield, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';

interface SnapshotData {
  wallet: {
    address: string;
    totalValueUSD: number;
    balances: Array<{ symbol: string; formatted: string; valueUSD: number }>;
  };
  aave: {
    account: {
      totalCollateralUSD: number;
      totalDebtUSD: number;
      healthFactor: number | null;
    };
    positions: Array<{
      symbol: string;
      supplied: string;
      suppliedUSD: number;
      borrowed: string;
      borrowedUSD: number;
    }>;
  };
}

export default function PortfolioView() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const wallet = process.env.NEXT_PUBLIC_DEMO_WALLET || '0x0000000000000000000000000000000000000001';
      const res = await fetch(`/api/snapshot?wallet=${wallet}`);
      const json = await res.json();
      setData(json);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="mantis-card animate-pulse">
        <div className="h-4 bg-[var(--card-border)] rounded w-1/3 mb-4" />
        <div className="h-8 bg-[var(--card-border)] rounded w-1/2" />
      </div>
    );
  }

  if (!data) return null;

  const hf = data.aave.account.healthFactor;
  const hfColor = hf === null || hf === Infinity ? 'text-gray-400'
    : hf > 1.5 ? 'text-mantis'
    : hf > 1.3 ? 'text-yellow-400'
    : 'text-red-400';

  return (
    <div className="mantis-card">
      <h2 className="text-sm font-medium text-gray-400 mb-3">Portfolio Overview</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <DollarSign className="w-3 h-3" /> Total Value
          </div>
          <div className="text-2xl font-bold">${data.wallet.totalValueUSD.toFixed(2)}</div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <Shield className="w-3 h-3" /> Health Factor
          </div>
          <div className={`text-2xl font-bold ${hfColor}`}>
            {hf === null ? 'N/A' : hf === Infinity ? '∞' : hf.toFixed(2)}
          </div>
        </div>
      </div>

      {data.aave.account.totalCollateralUSD > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-500">Collateral: </span>
            <span className="text-mantis">${data.aave.account.totalCollateralUSD.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">Debt: </span>
            <span className="text-red-400">${data.aave.account.totalDebtUSD.toFixed(2)}</span>
          </div>
        </div>
      )}

      {data.aave.positions.length > 0 && (
        <div className="border-t border-[var(--card-border)] pt-3 mt-3">
          <h3 className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Active Positions
          </h3>
          <div className="space-y-2">
            {data.aave.positions.map(p => (
              <div key={p.symbol} className="flex justify-between text-sm">
                <span>{p.symbol}</span>
                <div className="text-right">
                  <span className="text-mantis">${p.suppliedUSD.toFixed(2)}</span>
                  {p.borrowedUSD > 0 && (
                    <span className="text-red-400 ml-2">-${p.borrowedUSD.toFixed(2)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.aave.positions.length === 0 && (
        <div className="border-t border-[var(--card-border)] pt-3 mt-3 text-sm text-gray-500 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          No active Aave positions. Fund wallet to start.
        </div>
      )}

      {/* Wallet balances */}
      {data.wallet.balances.filter(b => b.valueUSD > 0.01).length > 0 && (
        <div className="border-t border-[var(--card-border)] pt-3 mt-3">
          <h3 className="text-xs text-gray-500 mb-2">Wallet Balances</h3>
          <div className="space-y-1">
            {data.wallet.balances
              .filter(b => b.valueUSD > 0.01)
              .map(b => (
                <div key={b.symbol} className="flex justify-between text-sm">
                  <span>{b.symbol}</span>
                  <span className="text-gray-400">
                    {parseFloat(b.formatted).toFixed(4)} (${b.valueUSD.toFixed(2)})
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
