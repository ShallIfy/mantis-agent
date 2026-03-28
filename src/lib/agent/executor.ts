import type { AgentAction, StateSnapshot, ExecutionResult } from '@/lib/types';

export type ExecutionMode = 'simulate' | 'execute';

export async function executeActions(
  actions: AgentAction[],
  _snapshot: StateSnapshot,
  mode: ExecutionMode = 'simulate'
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  for (const action of actions) {
    if (action.type === 'none') continue;

    const result: ExecutionResult = {
      action,
      mode,
      status: 'pending',
      txHash: null,
      error: null,
      timestamp: Date.now(),
    };

    try {
      if (mode === 'simulate') {
        // Simulation mode — log what would happen
        result.status = 'simulated';
        result.txHash = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      } else {
        // Real execution via viem
        // Import dynamically to avoid loading wallet client when not needed
        const { getWalletClient } = await import('@/lib/chain/config');
        const { publicClient } = await import('@/lib/chain/config');
        const { AAVE_V3, TOKENS } = await import('@/lib/chain/contracts');
        const { aavePoolAbi } = await import('@/lib/chain/abis/aave-pool');
        const { erc20Abi } = await import('@/lib/chain/abis/erc20');
        const { parseUnits } = await import('viem');

        const walletClient = getWalletClient();
        const TOKEN_DECIMALS = (await import('@/lib/chain/contracts')).TOKEN_DECIMALS;

        switch (action.type) {
          case 'supply': {
            if (!action.token_to || !action.amount) throw new Error('Missing token_to or amount');

            const tokenKey = action.token_to as keyof typeof TOKENS;
            const tokenAddress = TOKENS[tokenKey] as `0x${string}`;
            const decimals = TOKEN_DECIMALS[tokenKey] || 18;
            const amount = parseUnits(action.amount, decimals);

            // Approve
            const approveHash = await walletClient.writeContract({
              address: tokenAddress,
              abi: erc20Abi,
              functionName: 'approve',
              args: [AAVE_V3.POOL as `0x${string}`, amount],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });

            // Supply
            const supplyHash = await walletClient.writeContract({
              address: AAVE_V3.POOL as `0x${string}`,
              abi: aavePoolAbi,
              functionName: 'supply',
              args: [tokenAddress, amount, walletClient.account.address, 0],
            });
            await publicClient.waitForTransactionReceipt({ hash: supplyHash });

            result.txHash = supplyHash;
            result.status = 'success';
            break;
          }

          case 'withdraw': {
            if (!action.token_from || !action.amount) throw new Error('Missing token_from or amount');

            const tokenKey = action.token_from as keyof typeof TOKENS;
            const tokenAddress = TOKENS[tokenKey] as `0x${string}`;
            const decimals = TOKEN_DECIMALS[tokenKey] || 18;
            const amount = parseUnits(action.amount, decimals);

            const withdrawHash = await walletClient.writeContract({
              address: AAVE_V3.POOL as `0x${string}`,
              abi: aavePoolAbi,
              functionName: 'withdraw',
              args: [tokenAddress, amount, walletClient.account.address],
            });
            await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

            result.txHash = withdrawHash;
            result.status = 'success';
            break;
          }

          case 'swap': {
            // Swap via Merchant Moe — complex, simulate for now
            result.status = 'simulated';
            result.txHash = `SIM-SWAP-${Date.now()}`;
            break;
          }
        }
      }
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
    }

    results.push(result);
  }

  return results;
}
