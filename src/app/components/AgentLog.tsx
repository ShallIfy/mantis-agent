'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, ExternalLink, Loader2, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { useWallet } from '@/lib/wallet/provider';
import { createPublicClient, http } from 'viem';
import { mantle } from 'viem/chains';
import { toast } from 'sonner';
import type { ProposedTransaction } from '@/lib/types';

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

interface TerminalLine {
  id: string;
  timestamp: number;
  type: 'system' | 'info' | 'tx-pending' | 'tx-confirming' | 'tx-success' | 'tx-failed' | 'warning' | 'error';
  text: string;
  txHash?: string;
  indent?: boolean;
}

// ═══════════════════════════════════════════════
// GLOBAL LOG (other components can push to this)
// ═══════════════════════════════════════════════

type LogListener = () => void;
const listeners: Set<LogListener> = new Set();
let globalLines: TerminalLine[] = [];

function nextId() {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function pushTerminalLine(line: Omit<TerminalLine, 'id' | 'timestamp'>) {
  globalLines = [...globalLines, { ...line, id: nextId(), timestamp: Date.now() }];
  if (globalLines.length > 200) globalLines = globalLines.slice(-200);
  listeners.forEach(fn => fn());
}

export function useTerminalLines() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const fn = () => rerender(n => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return globalLines;
}

// ═══════════════════════════════════════════════
// EXECUTE TRANSACTIONS (callable from anywhere)
// ═══════════════════════════════════════════════

export async function executeTransactions(
  transactions: ProposedTransaction[],
  sendTransaction: (tx: { to: `0x${string}`; data: `0x${string}`; value: bigint }) => Promise<`0x${string}`>,
  refreshBalances: () => Promise<void>,
) {
  const publicClient = createPublicClient({
    chain: mantle,
    transport: http('https://rpc.mantle.xyz'),
  });

  pushTerminalLine({ type: 'info', text: `Executing ${transactions.length} transaction(s)...` });

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const label = `[${i + 1}/${transactions.length}] ${tx.label}`;

    pushTerminalLine({ type: 'tx-pending', text: label });

    try {
      const hash = await sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : 0n,
      });

      pushTerminalLine({ type: 'tx-confirming', text: `Waiting for confirmation...`, txHash: hash, indent: true });

      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

      pushTerminalLine({ type: 'tx-success', text: `Confirmed`, txHash: hash, indent: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      pushTerminalLine({ type: 'tx-failed', text: `Failed: ${msg}`, indent: true });
      pushTerminalLine({ type: 'error', text: `Execution stopped — remaining transactions skipped.` });
      toast.error(`Transaction failed: ${tx.label}`);
      return false;
    }
  }

  pushTerminalLine({ type: 'tx-success', text: `All ${transactions.length} transactions confirmed!` });
  toast.success('Transactions confirmed on-chain!');
  refreshBalances();
  return true;
}

// ═══════════════════════════════════════════════
// LINE ENTRY
// ═══════════════════════════════════════════════

const LINE_ACCENT: Record<TerminalLine['type'], string> = {
  'system': 'border-l-transparent',
  'info': 'border-l-[rgba(0,210,110,0.25)]',
  'tx-pending': 'border-l-[rgba(234,179,8,0.35)]',
  'tx-confirming': 'border-l-[rgba(0,210,110,0.25)]',
  'tx-success': 'border-l-[rgba(0,210,110,0.5)]',
  'tx-failed': 'border-l-[rgba(239,68,68,0.45)]',
  'warning': 'border-l-[rgba(234,179,8,0.25)]',
  'error': 'border-l-[rgba(239,68,68,0.35)]',
};

const LINE_COLOR: Record<TerminalLine['type'], string> = {
  'system': 'text-[var(--muted-foreground)]',
  'info': 'text-[rgba(0,210,110,0.75)]',
  'tx-pending': 'text-[rgba(234,179,8,0.85)]',
  'tx-confirming': 'text-[rgba(0,210,110,0.6)]',
  'tx-success': 'text-[rgba(0,210,110,0.9)]',
  'tx-failed': 'text-[rgba(239,68,68,0.85)]',
  'warning': 'text-[rgba(234,179,8,0.65)]',
  'error': 'text-[rgba(239,68,68,0.75)]',
};

const LINE_BG: Record<TerminalLine['type'], string> = {
  'system': '',
  'info': '',
  'tx-pending': '',
  'tx-confirming': '',
  'tx-success': 'bg-[rgba(0,210,110,0.03)]',
  'tx-failed': 'bg-[rgba(239,68,68,0.03)]',
  'warning': '',
  'error': 'bg-[rgba(239,68,68,0.02)]',
};

function LineIcon({ type }: { type: TerminalLine['type'] }) {
  switch (type) {
    case 'tx-pending':
      return <Clock className="w-3 h-3 text-yellow-400/70 flex-shrink-0 mt-[2px]" />;
    case 'tx-confirming':
      return <Loader2 className="w-3 h-3 text-primary/60 animate-spin flex-shrink-0 mt-[2px]" />;
    case 'tx-success':
      return <CheckCircle className="w-3 h-3 text-primary/80 flex-shrink-0 mt-[2px]" />;
    case 'tx-failed':
      return <XCircle className="w-3 h-3 text-red-400/80 flex-shrink-0 mt-[2px]" />;
    default:
      return null;
  }
}

function LinePrefix({ type, indent }: { type: TerminalLine['type']; indent?: boolean }) {
  if (indent) return <span className="w-3 flex-shrink-0" />;
  const prefixes: Partial<Record<TerminalLine['type'], string>> = { system: '~', info: '>', warning: '!', error: '\u00d7' };
  const p = prefixes[type] || '>';
  return <span className="w-3 text-center text-[var(--muted-foreground)] opacity-30 select-none flex-shrink-0 mt-[1px]">{p}</span>;
}

function TerminalEntry({ line, formatTime }: { line: TerminalLine; formatTime: (ts: number) => string }) {
  const icon = <LineIcon type={line.type} />;
  const hasTxIcon = ['tx-pending', 'tx-confirming', 'tx-success', 'tx-failed'].includes(line.type);

  return (
    <div
      className={[
        'terminal-line flex items-start gap-2 py-[3px] px-2 -mx-2 rounded-md border-l-2',
        'transition-colors duration-150 hover:bg-[rgba(0,210,110,0.04)]',
        LINE_ACCENT[line.type],
        LINE_COLOR[line.type],
        LINE_BG[line.type],
        line.indent ? 'ml-5' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Timestamp */}
      <span className="text-[var(--muted-foreground)] opacity-25 text-[10px] flex-shrink-0 tabular-nums select-none mt-[2px] font-mono">
        {formatTime(line.timestamp)}
      </span>

      {/* Icon or prefix */}
      {hasTxIcon ? icon : <LinePrefix type={line.type} indent={line.indent} />}

      {/* Content */}
      <span className="break-all leading-[1.7]">{line.text}</span>

      {/* TX Hash link */}
      {line.txHash && (
        <a
          href={`https://mantlescan.xyz/tx/${line.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary/35 hover:text-primary/75 transition-colors flex-shrink-0 ml-auto"
        >
          <span className="text-[10px] underline underline-offset-2 decoration-primary/20">{line.txHash.slice(0, 10)}...</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// TERMINAL COMPONENT
// ═══════════════════════════════════════════════

export default function AgentLog() {
  const wallet = useWallet();
  const lines = useTerminalLines();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [booted, setBooted] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length]);

  // Boot sequence
  const boot = useCallback(() => {
    if (booted) return;
    setBooted(true);

    pushTerminalLine({ type: 'system', text: 'MANTIS Agent Terminal v1.0' });
    pushTerminalLine({ type: 'system', text: 'Mantle Network \u00b7 Chain 5000' });

    if (wallet.address) {
      pushTerminalLine({ type: 'info', text: `Wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` });
      pushTerminalLine({
        type: wallet.isUnlocked ? 'tx-success' : 'warning',
        text: wallet.isUnlocked ? 'Wallet unlocked \u2014 ready to sign' : 'Wallet locked \u2014 unlock to execute',
      });
    } else {
      pushTerminalLine({ type: 'warning', text: 'No wallet connected' });
    }

    pushTerminalLine({ type: 'system', text: 'Awaiting instructions...' });
  }, [booted, wallet.address, wallet.isUnlocked]);

  useEffect(() => { boot(); }, [boot]);

  // Watch wallet unlock
  useEffect(() => {
    if (!booted) return;
    if (wallet.address && wallet.isUnlocked) {
      pushTerminalLine({ type: 'info', text: `Wallet unlocked: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.isUnlocked]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="mantis-card-premium !p-0 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(0,210,110,0.06)] bg-[rgba(5,10,7,0.4)]">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary/70" />
            <div className="absolute inset-0 blur-[6px] bg-primary/20 rounded-full" />
          </div>
          <span className="section-header !text-[0.65rem] !text-[var(--muted-foreground)]">Activity Log</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Network badge */}
          <span className="badge badge-green">MANTLE</span>

          {/* Wallet status */}
          {wallet.address ? (
            <span className="text-[10px] font-mono text-primary/45 flex items-center gap-1.5">
              <span className="w-[5px] h-[5px] rounded-full bg-primary/70 shadow-[0_0_6px_rgba(0,210,110,0.5)]" />
              {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] opacity-40">disconnected</span>
          )}
        </div>
      </div>

      {/* ── Terminal Body ── */}
      <div
        ref={scrollRef}
        className="relative terminal-body max-h-[340px] overflow-y-auto"
      >
        {/* Grid overlay */}
        <div className="absolute inset-0 grid-pattern opacity-20 pointer-events-none" />

        {/* Content */}
        <div className="relative p-4 sm:p-5 font-mono text-[11.5px]">
          {/* Empty state */}
          {lines.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-[var(--muted-foreground)] opacity-30">
              <Activity className="w-5 h-5" />
              <span className="text-xs tracking-wide">Waiting for activity...</span>
            </div>
          )}

          {/* Lines */}
          <div className="space-y-px">
            {lines.map((line) => (
              <TerminalEntry key={line.id} line={line} formatTime={formatTime} />
            ))}
          </div>

          {/* Cursor */}
          {lines.length > 0 && (
            <div className="flex items-center gap-2 mt-2 pl-2">
              <span className="text-[var(--muted-foreground)] opacity-20 text-[10px] tabular-nums font-mono">
                {formatTime(Date.now())}
              </span>
              <span className="text-primary/30 text-xs select-none">{'\u203a'}</span>
              <span className="terminal-cursor w-[6px] h-[14px] rounded-[1px] bg-primary/50" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
