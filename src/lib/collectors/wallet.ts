import { formatUnits, formatEther } from 'viem';
import { publicClient } from '@/lib/chain/config';
import { TOKENS, TOKEN_DECIMALS, type TokenSymbol } from '@/lib/chain/contracts';
import { erc20Abi } from '@/lib/chain/abis/erc20';
import type { WalletBalance } from '@/lib/types';

export async function getWalletBalances(
  wallet: string,
  priceMap: Map<string, number>
): Promise<WalletBalance[]> {
  const balances: WalletBalance[] = [];

  // Native MNT balance
  const nativeBalance = await publicClient.getBalance({
    address: wallet as `0x${string}`,
  });

  const mntFormatted = formatEther(nativeBalance);
  const mntPrice = priceMap.get(TOKENS.WMNT.toLowerCase()) || 0;

  balances.push({
    symbol: 'MNT',
    address: '0x0000000000000000000000000000000000000000',
    balance: nativeBalance.toString(),
    formatted: mntFormatted,
    valueUSD: Number(mntFormatted) * mntPrice,
  });

  // ERC20 balances
  const tokenEntries = Object.entries(TOKENS) as [TokenSymbol, string][];

  const calls = tokenEntries.map(([symbol, address]) =>
    publicClient.readContract({
      address: address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [wallet as `0x${string}`],
    }).then(balance => ({ symbol, address, balance }))
      .catch(() => null)
  );

  const results = await Promise.all(calls);

  for (const result of results) {
    if (!result || result.balance === 0n) continue;

    const { symbol, address, balance } = result;
    const decimals = TOKEN_DECIMALS[symbol] || 18;
    const formatted = formatUnits(balance, decimals);
    const price = priceMap.get(address.toLowerCase()) || 0;

    balances.push({
      symbol,
      address,
      balance: balance.toString(),
      formatted,
      valueUSD: Number(formatted) * price,
    });
  }

  return balances;
}
