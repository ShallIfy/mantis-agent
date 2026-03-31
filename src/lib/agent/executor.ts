import { encodeFunctionData, parseUnits } from 'viem';
import { AAVE_V3, MERCHANT_MOE, TOKENS, TOKEN_DECIMALS, COLLATERAL_TOKENS } from '@/lib/chain/contracts';
import { aavePoolAbi } from '@/lib/chain/abis/aave-pool';
import { erc20Abi } from '@/lib/chain/abis/erc20';
import { moeRouterAbi } from '@/lib/chain/abis/moe-router';
import { wmntAbi } from '@/lib/chain/abis/wmnt';
import type { AgentAction, StateSnapshot, ExecutionResult, ProposedTransaction } from '@/lib/types';

export type ExecutionMode = 'simulate' | 'execute' | 'propose';

export function proposeActions(
  actions: AgentAction[],
  walletAddress: string,
): ProposedTransaction[] {
  const proposals: ProposedTransaction[] = [];
  let txIndex = 0;

  for (const action of actions) {
    if (action.type === 'none') continue;

    switch (action.type) {
      case 'supply': {
        if (!action.token_to || !action.amount) break;
        const tokenKey = action.token_to as keyof typeof TOKENS;
        const tokenAddress = TOKENS[tokenKey];
        if (!tokenAddress) break;
        const decimals = TOKEN_DECIMALS[tokenKey] || 18;
        const amount = parseUnits(action.amount, decimals);
        const canBeCollateral = COLLATERAL_TOKENS.has(tokenKey);
        const totalSteps = canBeCollateral ? 3 : 2;

        // TX 1: Approve
        proposals.push({
          id: `tx-${txIndex++}`,
          label: `Approve ${action.amount} ${action.token_to} for Aave V3`,
          to: tokenAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [AAVE_V3.POOL as `0x${string}`, amount],
          }),
          value: '0',
          chainId: 5000,
          action,
          step: 1,
          totalSteps,
        });

        // TX 2: Supply
        proposals.push({
          id: `tx-${txIndex++}`,
          label: `Supply ${action.amount} ${action.token_to} to Aave V3`,
          to: AAVE_V3.POOL,
          data: encodeFunctionData({
            abi: aavePoolAbi,
            functionName: 'supply',
            args: [tokenAddress as `0x${string}`, amount, walletAddress as `0x${string}`, 0],
          }),
          value: '0',
          chainId: 5000,
          action,
          step: 2,
          totalSteps,
        });

        // TX 3: Enable as collateral (only for WETH, WMNT — tokens with LTV > 0)
        if (canBeCollateral) {
          proposals.push({
            id: `tx-${txIndex++}`,
            label: `Enable ${action.token_to} as collateral on Aave V3`,
            to: AAVE_V3.POOL,
            data: encodeFunctionData({
              abi: aavePoolAbi,
              functionName: 'setUserUseReserveAsCollateral',
              args: [tokenAddress as `0x${string}`, true],
            }),
            value: '0',
            chainId: 5000,
            action,
            step: 3,
            totalSteps,
          });
        }
        break;
      }

      case 'withdraw': {
        if (!action.token_from || !action.amount) break;
        const tokenKey = action.token_from as keyof typeof TOKENS;
        const tokenAddress = TOKENS[tokenKey];
        if (!tokenAddress) break;
        const decimals = TOKEN_DECIMALS[tokenKey] || 18;
        const amount = parseUnits(action.amount, decimals);

        proposals.push({
          id: `tx-${txIndex++}`,
          label: `Withdraw ${action.amount} ${action.token_from} from Aave V3`,
          to: AAVE_V3.POOL,
          data: encodeFunctionData({
            abi: aavePoolAbi,
            functionName: 'withdraw',
            args: [tokenAddress as `0x${string}`, amount, walletAddress as `0x${string}`],
          }),
          value: '0',
          chainId: 5000,
          action,
          step: 1,
          totalSteps: 1,
        });
        break;
      }

      case 'borrow': {
        if (!action.token_to || !action.amount) break;
        const tokenKey = action.token_to as keyof typeof TOKENS;
        const tokenAddress = TOKENS[tokenKey];
        if (!tokenAddress) break;
        const decimals = TOKEN_DECIMALS[tokenKey] || 18;
        const amount = parseUnits(action.amount, decimals);

        proposals.push({
          id: `tx-${txIndex++}`,
          label: `Borrow ${action.amount} ${action.token_to} from Aave V3`,
          to: AAVE_V3.POOL,
          data: encodeFunctionData({
            abi: aavePoolAbi,
            functionName: 'borrow',
            args: [
              tokenAddress as `0x${string}`,
              amount,
              2n, // interestRateMode: 2 = variable rate
              0,  // referralCode
              walletAddress as `0x${string}`,
            ],
          }),
          value: '0',
          chainId: 5000,
          action,
          step: 1,
          totalSteps: 1,
        });
        break;
      }

      case 'repay': {
        if (!action.token_to || !action.amount) break;
        const tokenKey = action.token_to as keyof typeof TOKENS;
        const tokenAddress = TOKENS[tokenKey];
        if (!tokenAddress) break;
        const decimals = TOKEN_DECIMALS[tokenKey] || 18;
        const amount = parseUnits(action.amount, decimals);

        // TX 1: Approve repayment
        proposals.push({
          id: `tx-${txIndex++}`,
          label: `Approve ${action.amount} ${action.token_to} for Aave V3 repayment`,
          to: tokenAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [AAVE_V3.POOL as `0x${string}`, amount],
          }),
          value: '0',
          chainId: 5000,
          action,
          step: 1,
          totalSteps: 2,
        });

        // TX 2: Repay
        proposals.push({
          id: `tx-${txIndex++}`,
          label: `Repay ${action.amount} ${action.token_to} to Aave V3`,
          to: AAVE_V3.POOL,
          data: encodeFunctionData({
            abi: aavePoolAbi,
            functionName: 'repay',
            args: [
              tokenAddress as `0x${string}`,
              amount,
              2n, // interestRateMode: 2 = variable rate
              walletAddress as `0x${string}`,
            ],
          }),
          value: '0',
          chainId: 5000,
          action,
          step: 2,
          totalSteps: 2,
        });
        break;
      }

      case 'wrap': {
        if (!action.amount) break;
        const wrapAmount = parseUnits(action.amount, 18);
        proposals.push({
          id: `tx-${txIndex++}`,
          label: `Wrap ${action.amount} MNT → WMNT`,
          to: TOKENS.WMNT,
          data: encodeFunctionData({ abi: wmntAbi, functionName: 'deposit' }),
          value: wrapAmount.toString(),
          chainId: 5000,
          action,
          step: 1,
          totalSteps: 1,
        });
        break;
      }

      case 'unwrap': {
        if (!action.amount) break;
        const unwrapAmount = parseUnits(action.amount, 18);
        proposals.push({
          id: `tx-${txIndex++}`,
          label: `Unwrap ${action.amount} WMNT → MNT`,
          to: TOKENS.WMNT,
          data: encodeFunctionData({ abi: wmntAbi, functionName: 'withdraw', args: [unwrapAmount] }),
          value: '0',
          chainId: 5000,
          action,
          step: 1,
          totalSteps: 1,
        });
        break;
      }

      case 'swap': {
        if (!action.token_from || !action.token_to || !action.amount) break;

        // Auto-wrap: if source is native MNT, prepend a wrap tx and swap from WMNT
        const isMntSource = action.token_from === 'MNT';
        const effectiveFrom = isMntSource ? 'WMNT' : action.token_from;

        const fromKey = effectiveFrom as keyof typeof TOKENS;
        const toKey = action.token_to as keyof typeof TOKENS;
        const fromAddress = TOKENS[fromKey];
        const toAddress = TOKENS[toKey];
        if (!fromAddress || !toAddress) break;
        const fromDecimals = TOKEN_DECIMALS[fromKey] || 18;
        const swapAmount = parseUnits(action.amount, fromDecimals);

        // Count total steps
        const totalSteps = isMntSource ? 3 : 2;
        let step = 1;

        // TX 0 (optional): Wrap MNT → WMNT
        if (isMntSource) {
          proposals.push({
            id: `tx-${txIndex++}`,
            label: `Wrap ${action.amount} MNT → WMNT`,
            to: TOKENS.WMNT,
            data: encodeFunctionData({ abi: wmntAbi, functionName: 'deposit' }),
            value: swapAmount.toString(),
            chainId: 5000,
            action,
            step: step++,
            totalSteps,
          });
        }

        // Build path: direct pair or route through WMNT
        const wmnt = TOKENS.WMNT as `0x${string}`;
        const needsHop = fromKey !== 'WMNT' && toKey !== 'WMNT';
        const path = needsHop
          ? [fromAddress as `0x${string}`, wmnt, toAddress as `0x${string}`]
          : [fromAddress as `0x${string}`, toAddress as `0x${string}`];

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
        const amountOutMin = 0n;

        // TX: Approve router
        proposals.push({
          id: `tx-${txIndex++}`,
          label: `Approve ${action.amount} ${effectiveFrom} for Merchant Moe Router`,
          to: fromAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [MERCHANT_MOE.ROUTER as `0x${string}`, swapAmount],
          }),
          value: '0',
          chainId: 5000,
          action,
          step: step++,
          totalSteps,
        });

        // TX: Swap
        proposals.push({
          id: `tx-${txIndex++}`,
          label: `Swap ${action.amount} ${action.token_from} → ${action.token_to} via Merchant Moe`,
          to: MERCHANT_MOE.ROUTER,
          data: encodeFunctionData({
            abi: moeRouterAbi,
            functionName: 'swapExactTokensForTokens',
            args: [swapAmount, amountOutMin, path, walletAddress as `0x${string}`, deadline],
          }),
          value: '0',
          chainId: 5000,
          action,
          step: step++,
          totalSteps,
        });
        break;
      }
    }
  }

  return proposals;
}

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
      mode: mode as ExecutionResult['mode'],
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

            // Enable as collateral (only for tokens with LTV > 0)
            const { COLLATERAL_TOKENS } = await import('@/lib/chain/contracts');
            if (COLLATERAL_TOKENS.has(tokenKey)) {
              const collateralHash = await walletClient.writeContract({
                address: AAVE_V3.POOL as `0x${string}`,
                abi: aavePoolAbi,
                functionName: 'setUserUseReserveAsCollateral',
                args: [tokenAddress, true],
              });
              await publicClient.waitForTransactionReceipt({ hash: collateralHash });
              result.txHash = collateralHash;
            } else {
              result.txHash = supplyHash;
            }

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
