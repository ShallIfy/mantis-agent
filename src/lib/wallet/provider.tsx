'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  createPublicClient, createWalletClient, http, formatEther, formatUnits,
  type WalletClient, type TransactionRequest, type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantle } from 'viem/chains';
import {
  encryptAndStore, decryptFromStorage,
  hasStoredWallet, getStoredAddress, removeStoredWallet, isSecureContext,
} from './crypto';

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export interface TokenBalance {
  symbol: string;
  address: string;
  balance: string;
  decimals: number;
}

export interface WalletState {
  hasWallet: boolean;
  isUnlocked: boolean;
  address: string | null;
  mntBalance: string | null;
  tokenBalances: TokenBalance[];
  isLoading: boolean;
  error: string | null;
  isSecure: boolean;

  generateWallet: (password: string) => Promise<void>;
  importWallet: (privateKey: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  removeWallet: () => void;
  refreshBalances: () => Promise<void>;
  sendTransaction: (tx: TransactionRequest) => Promise<Hash>;
}

const WalletContext = createContext<WalletState | null>(null);

// ═══════════════════════════════════════════════
// KNOWN TOKENS
// ═══════════════════════════════════════════════

const TRACKED_TOKENS: { symbol: string; address: `0x${string}`; decimals: number }[] = [
  { symbol: 'USDC',   address: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9', decimals: 6 },
  { symbol: 'USDT0',  address: '0x3DB14BE6F0b3e2aF7651C18fC6D0238b48479c11', decimals: 6 },
  { symbol: 'WETH',   address: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111', decimals: 18 },
  { symbol: 'WMNT',   address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8', decimals: 18 },
  { symbol: 'mETH',   address: '0xcDA86A272531e8640cD7F1a92c01839911B90bb0', decimals: 18 },
];

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const RPC_URL = 'https://rpc.mantle.xyz';

// ═══════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════

export function WalletProvider({ children }: { children: ReactNode }) {
  const [hasWallet, setHasWallet] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [mntBalance, setMntBalance] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSecure, setIsSecure] = useState(false);
  const [mounted, setMounted] = useState(false);

  const walletClientRef = useRef<WalletClient | null>(null);
  const publicClientRef = useRef(
    typeof window !== 'undefined'
      ? createPublicClient({ chain: mantle, transport: http(RPC_URL) })
      : null,
  );

  // Hydration guard — only access browser APIs after mount
  useEffect(() => {
    setMounted(true);
    setIsSecure(isSecureContext());

    // Lazy-init publicClient if not created yet
    if (!publicClientRef.current) {
      publicClientRef.current = createPublicClient({ chain: mantle, transport: http(RPC_URL) });
    }

    const stored = hasStoredWallet();
    setHasWallet(stored);
    if (stored) {
      setAddress(getStoredAddress());
    }
  }, []);

  // Fetch balances
  const refreshBalances = useCallback(async () => {
    if (!address || !publicClientRef.current) return;
    const addr = address as `0x${string}`;

    try {
      const mnt = await publicClientRef.current.getBalance({ address: addr });
      setMntBalance(formatEther(mnt));

      const results = await Promise.allSettled(
        TRACKED_TOKENS.map(async (t) => {
          const raw = await publicClientRef.current!.readContract({
            address: t.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [addr],
          });
          return {
            symbol: t.symbol,
            address: t.address as string,
            balance: formatUnits(raw, t.decimals),
            decimals: t.decimals,
          };
        }),
      );

      const balances: TokenBalance[] = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<TokenBalance>).value)
        .filter(b => parseFloat(b.balance) > 0);

      setTokenBalances(balances);
    } catch {
      // Silently fail
    }
  }, [address]);

  // Auto-refresh balances when address changes
  useEffect(() => {
    if (mounted && address) {
      refreshBalances();
    }
  }, [mounted, address, refreshBalances]);

  const generateWallet = useCallback(async (password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { generatePrivateKey } = await import('viem/accounts');
      const pk = generatePrivateKey();
      const account = privateKeyToAccount(pk);
      await encryptAndStore(pk, password, account.address);
      setAddress(account.address);
      setHasWallet(true);

      const client = createWalletClient({ chain: mantle, transport: http(RPC_URL), account });
      walletClientRef.current = client;
      setIsUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate wallet');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const importWallet = useCallback(async (privateKey: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const pk = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
      const account = privateKeyToAccount(pk);
      await encryptAndStore(pk, password, account.address);
      setAddress(account.address);
      setHasWallet(true);

      const client = createWalletClient({ chain: mantle, transport: http(RPC_URL), account });
      walletClientRef.current = client;
      setIsUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid private key');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unlock = useCallback(async (password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const pk = await decryptFromStorage(password);
      const account = privateKeyToAccount(pk as `0x${string}`);
      const client = createWalletClient({ chain: mantle, transport: http(RPC_URL), account });
      walletClientRef.current = client;
      setAddress(account.address);
      setIsUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlock');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const lock = useCallback(() => {
    walletClientRef.current = null;
    setIsUnlocked(false);
  }, []);

  const removeWalletFn = useCallback(() => {
    removeStoredWallet();
    walletClientRef.current = null;
    setIsUnlocked(false);
    setHasWallet(false);
    setAddress(null);
    setMntBalance(null);
    setTokenBalances([]);
  }, []);

  const sendTransaction = useCallback(async (tx: TransactionRequest): Promise<Hash> => {
    if (!walletClientRef.current) throw new Error('Wallet not unlocked');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await walletClientRef.current.sendTransaction(tx as any);
    setTimeout(() => refreshBalances(), 3000);
    return hash;
  }, [refreshBalances]);

  return (
    <WalletContext.Provider
      value={{
        hasWallet, isUnlocked, address, mntBalance, tokenBalances,
        isLoading, error, isSecure,
        generateWallet, importWallet, unlock, lock,
        removeWallet: removeWalletFn, refreshBalances, sendTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
