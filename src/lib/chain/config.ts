import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantle } from 'viem/chains';

export const MANTLE_RPC = process.env.MANTLE_RPC_URL || 'https://rpc.mantle.xyz';

export const publicClient = createPublicClient({
  chain: mantle,
  transport: http(MANTLE_RPC),
});

export function getWalletClient() {
  const key = process.env.AGENT_WALLET_PRIVATE_KEY;
  if (!key) throw new Error('AGENT_WALLET_PRIVATE_KEY not set');

  const account = privateKeyToAccount(key as `0x${string}`);
  return createWalletClient({
    chain: mantle,
    transport: http(MANTLE_RPC),
    account,
  });
}

export { mantle };
