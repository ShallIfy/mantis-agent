'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, Loader2, Sparkles, CheckCircle, XCircle, Square, ExternalLink, Clock, Shield } from 'lucide-react';
import { useRef, useEffect, useState, useMemo, useCallback, type FormEvent } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useWallet } from '@/lib/wallet/provider';
import { executeTransactions } from '@/app/components/AgentLog';
import type { ProposedTransaction } from '@/lib/types';

// ═══════════════════════════════════════════════
// MARKDOWN RENDERER
// ═══════════════════════════════════════════════

const mdComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="table-wrapper">
      <table {...props}>{children}</table>
    </div>
  ),
};

// ═══════════════════════════════════════════════
// SUGGESTED PROMPTS
// ═══════════════════════════════════════════════

const SUGGESTED_PROMPTS = [
  'Compare USDC yields across all protocols',
  'Aave V3 lending rates',
  'Best Bybit Earn rate?',
  'Analyze my portfolio yield',
];

// ═══════════════════════════════════════════════
// PART TYPES
// ═══════════════════════════════════════════════

interface MessagePart {
  type: string;
  text?: string;
  state?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

// ═══════════════════════════════════════════════
// STEP PARSER — groups parts by step boundary
// ═══════════════════════════════════════════════

interface Step {
  thinking: string;
  isThinkingStreaming: boolean;
  tools: MessagePart[];
  text: string;
  isTextStreaming: boolean;
}

function parseSteps(parts: MessagePart[]): Step[] {
  const steps: Step[] = [];
  let cur: Step = { thinking: '', isThinkingStreaming: false, tools: [], text: '', isTextStreaming: false };

  for (const p of parts) {
    if (p.type === 'step-start') {
      if (cur.thinking || cur.tools.length > 0 || cur.text) {
        steps.push(cur);
      }
      cur = { thinking: '', isThinkingStreaming: false, tools: [], text: '', isTextStreaming: false };
    } else if (p.type === 'reasoning') {
      cur.thinking += (cur.thinking ? '\n' : '') + (p.text || '');
      if (p.state === 'streaming') cur.isThinkingStreaming = true;
    } else if (p.type?.startsWith('tool-')) {
      cur.tools.push(p);
    } else if (p.type === 'text' && p.text) {
      cur.text += p.text;
      if (p.state === 'streaming') cur.isTextStreaming = true;
    }
  }
  if (cur.thinking || cur.tools.length > 0 || cur.text) {
    steps.push(cur);
  }
  return steps;
}

// ═══════════════════════════════════════════════
// TOOL SKILL MAPPING
// ═══════════════════════════════════════════════

const TOOL_SKILLS: Record<string, { skill: string; label: string; color: string }> = {
  mantle_getLendingMarkets:    { skill: 'Aave V3',       label: 'Lending Markets',    color: 'blue' },
  mantle_getSwapQuote:         { skill: 'DEX',           label: 'Swap Quote',         color: 'amber' },
  mantle_getPoolLiquidity:     { skill: 'DEX',           label: 'Pool Liquidity',     color: 'amber' },
  mantle_getPoolOpportunities: { skill: 'DEX',           label: 'Pool Opportunities', color: 'amber' },
  mantle_getProtocolTvl:       { skill: 'DEX',           label: 'Protocol TVL',       color: 'amber' },
  mantis_bybit_products:       { skill: 'Bybit Earn',    label: 'Earn Products',      color: 'yellow' },
  mantis_bybit_best_rate:      { skill: 'Bybit Earn',    label: 'Best Rate',          color: 'yellow' },
  mantis_cian_vaults:          { skill: 'CIAN',          label: 'Vaults',             color: 'teal' },
  mantis_cian_user_position:   { skill: 'CIAN',          label: 'User Position',      color: 'teal' },
  mantle_getBalance:           { skill: 'Wallet',        label: 'MNT Balance',        color: 'green' },
  mantle_getTokenBalances:     { skill: 'Wallet',        label: 'Token Balances',     color: 'green' },
  mantle_getAllowances:        { skill: 'Wallet',        label: 'Allowances',         color: 'green' },
  mantis_yield_projection:     { skill: 'Wallet',        label: 'Yield Projection',   color: 'green' },
  mantle_getTokenInfo:         { skill: 'Tokens',        label: 'Token Info',         color: 'purple' },
  mantle_getTokenPrices:       { skill: 'Tokens',        label: 'Token Prices',       color: 'purple' },
  mantle_resolveToken:         { skill: 'Tokens',        label: 'Resolve Token',      color: 'purple' },
  mantle_resolveAddress:       { skill: 'Tokens',        label: 'Resolve Address',    color: 'purple' },
  mantle_validateAddress:      { skill: 'Tokens',        label: 'Validate Address',   color: 'purple' },
  mantle_getChainInfo:         { skill: 'Mantle',        label: 'Chain Info',         color: 'cyan' },
  mantle_getChainStatus:       { skill: 'Mantle',        label: 'Chain Status',       color: 'cyan' },
  mantle_checkRpcHealth:       { skill: 'Mantle',        label: 'RPC Health',         color: 'cyan' },
  mantle_probeEndpoint:        { skill: 'Mantle',        label: 'Probe Endpoint',     color: 'cyan' },
  mantle_querySubgraph:        { skill: 'Indexer',       label: 'Query Subgraph',     color: 'rose' },
  mantle_queryIndexerSql:      { skill: 'Indexer',       label: 'Query SQL',          color: 'rose' },
  mantis_propose_transaction:  { skill: 'Transaction',   label: 'Proposing TX',       color: 'green' },
};

const SKILL_COLORS: Record<string, { text: string }> = {
  cyan:   { text: 'text-cyan-400/60' },
  green:  { text: 'text-emerald-400/60' },
  amber:  { text: 'text-amber-400/60' },
  purple: { text: 'text-purple-400/60' },
  blue:   { text: 'text-blue-400/60' },
  rose:   { text: 'text-rose-400/60' },
  yellow: { text: 'text-yellow-400/60' },
  teal:   { text: 'text-teal-400/60' },
};

// ═══════════════════════════════════════════════
// TOOL INVOCATION — compact inline
// ═══════════════════════════════════════════════

function ToolInvocationBlock({ part }: { part: MessagePart }) {
  const toolName = part.type.slice(5);
  const meta = TOOL_SKILLS[toolName];
  const skill = meta?.skill || 'Tool';
  const label = meta?.label || toolName;
  const colors = SKILL_COLORS[meta?.color || 'blue'] || SKILL_COLORS.blue;
  const isLoading = part.state === 'input-streaming' || part.state === 'input-available';
  const isDone = part.state === 'output-available';
  const isError = part.state === 'output-error';

  return (
    <div className="flex items-center gap-1.5 text-[11px] leading-none py-[3px]">
      {isLoading ? (
        <Loader2 className={cn('w-3 h-3 animate-spin', colors.text)} />
      ) : isError ? (
        <XCircle className="w-3 h-3 text-red-400/50" />
      ) : (
        <CheckCircle className={cn('w-3 h-3', colors.text)} />
      )}
      <span className="text-white/20">{skill}</span>
      <span className="text-white/[0.06]">&middot;</span>
      <span className={cn('font-medium', colors.text)}>{label}</span>
      {isLoading && <span className="text-white/15">...</span>}
      {isDone && <span className="text-white/15">done</span>}
      {isError && <span className="text-red-400/40">failed</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════
// THINKING BLOCK — subtle, collapsible
// ═══════════════════════════════════════════════

function ThinkingBlock({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isStreaming && text.length > 0) {
      const timer = setTimeout(() => setExpanded(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, text.length]);

  useEffect(() => {
    if (isStreaming && textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [text, isStreaming]);

  return (
    <div className="rounded-xl text-[11px] overflow-hidden bg-purple-500/[0.04] border border-purple-500/[0.06]">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-3 py-1.5 flex items-center gap-1.5 text-purple-400/50 font-medium hover:text-purple-400/70 transition-colors"
      >
        {isStreaming ? (
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400/30" />
        )}
        <span>{isStreaming ? 'Thinking...' : 'Thought process'}</span>
        <span className="ml-auto text-[10px] opacity-50">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div
          ref={textRef}
          className="px-3 pb-2 text-purple-300/40 whitespace-pre-wrap leading-relaxed max-h-[160px] overflow-y-auto"
        >
          {text}
          {isStreaming && <span className="inline-block w-1 h-3 bg-purple-400/60 ml-0.5 animate-pulse" />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// TRANSACTION APPROVAL CARD
// ═══════════════════════════════════════════════

interface TxCardProps {
  transactions: ProposedTransaction[];
  summary: string;
}

function TransactionApprovalCard({ transactions, summary }: TxCardProps) {
  const wallet = useWallet();
  const [status, setStatus] = useState<'idle' | 'unlocking' | 'executing' | 'done' | 'failed'>('idle');
  const [currentTx, setCurrentTx] = useState(-1);
  const [txResults, setTxResults] = useState<Map<string, { status: string; hash?: string }>>(new Map());
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [failError, setFailError] = useState('');
  const executingRef = useRef(false);

  // Core execution logic
  const doExecute = useCallback(async () => {
    if (executingRef.current || !wallet.sendTransaction || !wallet.isUnlocked) return;
    executingRef.current = true;
    setStatus('executing');
    setFailError('');

    let lastError = '';
    const success = await executeTransactions(
      transactions,
      async (tx) => {
        const idx = transactions.findIndex(
          t => t.to.toLowerCase() === tx.to.toLowerCase() && t.data === tx.data,
        );
        if (idx >= 0) setCurrentTx(idx);
        try {
          const hash = await wallet.sendTransaction!(tx);
          setTxResults(prev => {
            const next = new Map(prev);
            next.set(transactions[idx >= 0 ? idx : 0].id, { status: 'confirming', hash });
            return next;
          });
          return hash;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          // Mark this tx as failed in results
          setTxResults(prev => {
            const next = new Map(prev);
            next.set(transactions[idx >= 0 ? idx : 0].id, { status: 'failed' });
            return next;
          });
          throw err;
        }
      },
      wallet.refreshBalances,
    );

    if (success) {
      setStatus('done');
      setTxResults(prev => {
        const next = new Map(prev);
        transactions.forEach(t => {
          const existing = next.get(t.id);
          if (existing) next.set(t.id, { ...existing, status: 'success' });
        });
        return next;
      });
    } else {
      setStatus('failed');
      // Clean up error message for display
      const short = lastError.length > 120 ? lastError.slice(0, 120) + '...' : lastError;
      setFailError(short);
    }
  }, [transactions, wallet]);

  // AUTO-EXECUTE: if wallet is unlocked, start immediately on mount
  useEffect(() => {
    if (wallet.isUnlocked && status === 'idle' && !executingRef.current) {
      doExecute();
    }
  }, [wallet.isUnlocked, status, doExecute]);

  // After unlock via password, auto-execute
  useEffect(() => {
    if (wallet.isUnlocked && status === 'unlocking') {
      doExecute();
    }
  }, [wallet.isUnlocked, status, doExecute]);

  // If wallet is locked, show unlock prompt automatically
  const needsUnlock = wallet.address && !wallet.isUnlocked && (status === 'idle' || status === 'unlocking');

  const handleUnlock = async () => {
    if (!password) return;
    setUnlockError('');
    setStatus('unlocking');
    try {
      await wallet.unlock(password);
      // useEffect above will trigger doExecute
    } catch {
      setUnlockError('Wrong password');
      setStatus('idle');
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-primary/10 bg-primary/[0.03]">
        <Shield className="w-3.5 h-3.5 text-primary/70" />
        <span className="text-[12px] font-medium text-primary/80">
          {status === 'done' ? 'Transactions Complete' : status === 'executing' ? 'Executing...' : 'Transaction Proposal'}
        </span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/60">
          {transactions.length} tx{transactions.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Summary */}
      <div className="px-3.5 py-2 text-[12px] text-white/50">{summary}</div>

      {/* Transaction list */}
      <div className="px-3.5 pb-2 space-y-1">
        {transactions.map((tx, i) => {
          const result = txResults.get(tx.id);
          const isActive = status === 'executing' && currentTx === i;

          return (
            <div
              key={tx.id}
              className={cn(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px]',
                isActive ? 'bg-primary/[0.08] border border-primary/15' : 'bg-white/[0.02]',
              )}
            >
              <span className="w-4 h-4 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] text-white/30 flex-shrink-0">
                {i + 1}
              </span>
              <span className="text-white/60 flex-1 min-w-0 truncate">{tx.label}</span>

              {result?.status === 'success' && <CheckCircle className="w-3 h-3 text-primary/80 flex-shrink-0" />}
              {result?.status === 'confirming' && <Loader2 className="w-3 h-3 text-primary/60 animate-spin flex-shrink-0" />}
              {result?.status === 'failed' && <XCircle className="w-3 h-3 text-red-400/80 flex-shrink-0" />}
              {!result && isActive && <Loader2 className="w-3 h-3 text-primary/40 animate-spin flex-shrink-0" />}
              {!result && !isActive && status !== 'done' && <Clock className="w-3 h-3 text-white/15 flex-shrink-0" />}

              {result?.hash && (
                <a
                  href={`https://mantlescan.xyz/tx/${result.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-primary/40 hover:text-primary/70 transition-colors flex-shrink-0"
                >
                  <span className="text-[9px] underline underline-offset-2">{result.hash.slice(0, 8)}...</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer — contextual */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-primary/10">
        {/* No wallet */}
        {!wallet.address && status === 'idle' && (
          <div className="text-[11px] text-white/30">Connect a wallet to execute transactions.</div>
        )}

        {/* Wallet locked — inline unlock */}
        {needsUnlock && (
          <form onSubmit={(e) => { e.preventDefault(); handleUnlock(); }} className="flex items-center gap-2 w-full">
            <input
              type="password"
              placeholder="Wallet password to execute..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-primary/15 text-white/80 placeholder:text-white/25 outline-none focus:border-primary/30"
            />
            <button
              type="submit"
              disabled={!password || status === 'unlocking'}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-primary/90 text-black font-medium hover:bg-primary transition-colors disabled:opacity-40"
            >
              {status === 'unlocking' ? 'Unlocking...' : 'Unlock & Execute'}
            </button>
            {unlockError && <span className="text-[10px] text-red-400/70">{unlockError}</span>}
          </form>
        )}

        {/* Auto-executing */}
        {status === 'executing' && (
          <div className="flex items-center gap-2 text-[11px] text-primary/60">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Executing tx {currentTx + 1} of {transactions.length}...</span>
          </div>
        )}

        {/* Done */}
        {status === 'done' && (
          <div className="flex items-center gap-1.5 text-[11px] text-primary/70">
            <CheckCircle className="w-3 h-3" />
            <span>All transactions confirmed!</span>
          </div>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <div className="flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 text-red-400/70">
              <XCircle className="w-3 h-3 flex-shrink-0" />
              <span>Transaction failed.</span>
              <button
                onClick={() => { executingRef.current = false; setFailError(''); setStatus('idle'); }}
                className="ml-1 underline underline-offset-2 text-white/40 hover:text-white/60"
              >
                Retry
              </button>
            </div>
            {failError && (
              <div className="text-[10px] text-red-400/50 pl-[18px] break-all leading-relaxed">{failError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ASSISTANT MESSAGE — restructured rendering
// ═══════════════════════════════════════════════

function AssistantMessage({ parts }: { parts: MessagePart[] }) {
  const steps = useMemo(() => parseSteps(parts), [parts]);

  // Collect all tools across steps
  const allTools = useMemo(() => steps.flatMap(s => s.tools), [steps]);

  // Intermediate text = all steps except last
  const intermediateTexts = useMemo(
    () => steps.slice(0, -1).map(s => s.text).filter(Boolean),
    [steps],
  );

  // Final response = last step's text
  const finalText = steps.length > 0 ? steps[steps.length - 1].text : '';
  const isFinalStreaming = steps.length > 0 && steps[steps.length - 1].isTextStreaming;

  // Combined thinking from all steps
  const allThinking = useMemo(
    () => steps.map(s => s.thinking).filter(Boolean).join('\n\n'),
    [steps],
  );
  const isThinkingStreaming = steps.some(s => s.isThinkingStreaming);

  const hasContent = allTools.length > 0 || intermediateTexts.length > 0 || finalText || allThinking;
  if (!hasContent) return null;

  return (
    <div className="flex items-start gap-2.5">
      <Image
        src="/mantis-logo.png"
        alt="M"
        width={22}
        height={22}
        className="rounded-lg flex-shrink-0 mt-0.5 ring-1 ring-white/[0.06]"
      />
      <div className="max-w-[85%] space-y-1.5 min-w-0">
        {/* Tool invocations — grouped at top, with tx proposal interception */}
        {allTools.length > 0 && (
          <div className="pl-0.5 space-y-1.5">
            {allTools.map((tp, i) => {
              // Extract tool name from part type (e.g. "tool-mantis_propose_transaction")
              const toolName = tp.type.slice(5);

              // Intercept transaction proposal tool with completed output
              if (
                toolName === 'mantis_propose_transaction' &&
                tp.state === 'output-available' &&
                tp.output &&
                typeof tp.output === 'object' &&
                (tp.output as Record<string, unknown>).type === 'transaction_proposal'
              ) {
                const out = tp.output as { transactions: ProposedTransaction[]; summary: string };
                return (
                  <TransactionApprovalCard
                    key={i}
                    transactions={out.transactions}
                    summary={out.summary}
                  />
                );
              }

              return <ToolInvocationBlock key={i} part={tp} />;
            })}
          </div>
        )}

        {/* Intermediate status lines — compact, faded */}
        {intermediateTexts.length > 0 && (
          <div className="space-y-0.5 pl-0.5">
            {intermediateTexts.map((t, i) => (
              <p key={i} className="text-[11px] text-white/25 leading-relaxed line-clamp-2">
                {t}
              </p>
            ))}
          </div>
        )}

        {/* Final response — full bubble */}
        {finalText && (
          <div className="rounded-2xl rounded-tl-lg px-3.5 py-2.5 text-[13px] leading-relaxed bg-white/[0.04] text-white/80">
            <div className="chat-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{finalText}</ReactMarkdown>
            </div>
            {isFinalStreaming && (
              <span className="inline-block w-1 h-3.5 bg-primary/50 ml-0.5 animate-pulse rounded-full" />
            )}
          </div>
        )}

        {/* Thinking — always at bottom, collapsed after streaming */}
        {allThinking && (
          <ThinkingBlock text={allThinking} isStreaming={isThinkingStreaming} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════

export default function ChatWindow({ fullPage = false, floatingMode = false }: { fullPage?: boolean; floatingMode?: boolean }) {
  const wallet = useWallet();
  const walletRef = useRef(wallet.address);
  walletRef.current = wallet.address;
  const transport = useMemo(
    () => new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({ walletAddress: walletRef.current }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const { messages, sendMessage, status, stop } = useChat({ transport });
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  // Smart auto-scroll: track if user scrolled up
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUp.current = distanceFromBottom > 150;
  }, []);

  // Auto-scroll on new content unless user scrolled up
  useEffect(() => {
    if (scrollRef.current && !userScrolledUp.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    userScrolledUp.current = false;
    sendMessage({ text: inputValue });
    setInputValue('');
  };

  const handleSuggestion = (q: string) => {
    userScrolledUp.current = false;
    sendMessage({ text: q });
  };

  const handleStop = () => {
    stop();
  };

  return (
    <div className={cn(
      'flex flex-col',
      floatingMode
        ? 'h-full'
        : 'mantis-card-premium',
      !floatingMode && (fullPage ? 'h-[calc(100vh-8rem)]' : 'h-[520px]'),
    )}>
      {/* Header (non-floating only) */}
      {!floatingMode && (
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="section-header">{fullPage ? 'Chat with MANTIS' : 'Chat'}</span>
        </div>
      )}

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          'flex-1 overflow-y-auto space-y-4',
          floatingMode ? 'px-4 pt-4 pb-2' : 'pr-1 mb-3',
        )}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/[0.06] flex items-center justify-center mb-4 ring-1 ring-primary/[0.08]">
              <Image src="/mantis-logo.png" alt="MANTIS" width={28} height={28} className="rounded-lg opacity-60" />
            </div>
            <p className="text-[13px] text-white/25 mb-1">Ask MANTIS anything</p>
            <p className="text-[11px] text-white/15 mb-6">Yields, positions, risk — across Aave, Bybit, CIAN</p>
            <div className="flex flex-wrap gap-1.5 justify-center max-w-[320px]">
              {SUGGESTED_PROMPTS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-white/[0.06] text-white/30 hover:text-primary/80 hover:border-primary/20 hover:bg-primary/[0.04] transition-all duration-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map(m => {
          // ── User message ──
          if (m.role === 'user') {
            const text = (m.parts || [])
              .filter((p: MessagePart) => p.type === 'text' && p.text)
              .map((p: MessagePart) => p.text)
              .join('');
            if (!text) return null;
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-lg px-3.5 py-2.5 text-[13px] leading-relaxed bg-primary/90 text-black font-medium">
                  <div className="whitespace-pre-wrap">{text}</div>
                </div>
              </div>
            );
          }

          // ── Assistant message — restructured ──
          return <AssistantMessage key={m.id} parts={(m.parts || []) as MessagePart[]} />;
        })}

        {/* Typing indicator — only if no assistant parts yet */}
        {isLoading && messages.length > 0 && (() => {
          const last = messages[messages.length - 1];
          const hasParts = last?.role === 'assistant' && (last.parts || []).length > 0;
          if (hasParts) return null;
          return (
            <div className="flex items-start gap-2.5">
              <Image
                src="/mantis-logo.png"
                alt="M"
                width={22}
                height={22}
                className="rounded-lg flex-shrink-0 mt-0.5 ring-1 ring-white/[0.06] opacity-50"
              />
              <div className="rounded-2xl rounded-tl-lg px-4 py-3 bg-white/[0.04]">
                <div className="typing-dots flex gap-1">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Input ── */}
      <div className={cn(
        'flex-shrink-0 border-t border-white/[0.04]',
        floatingMode ? 'px-4 py-3' : 'pt-3',
      )}>
        <form onSubmit={handleSubmit} className="relative">
          <input
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Ask about yields, positions, risk..."
            className={cn(
              'w-full rounded-xl text-[13px] placeholder:text-white/20',
              'bg-white/[0.03] border border-white/[0.06]',
              'pl-4 pr-11 py-2.5',
              'focus:outline-none focus:border-primary/25 focus:bg-white/[0.04]',
              'transition-all duration-200',
            )}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/20 text-red-400/80 hover:bg-red-500/30 transition-all duration-200"
              title="Stop generating"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className={cn(
                'absolute right-1.5 top-1/2 -translate-y-1/2',
                'w-7 h-7 rounded-lg flex items-center justify-center',
                'transition-all duration-200',
                inputValue.trim()
                  ? 'bg-primary/90 text-black hover:bg-primary'
                  : 'bg-transparent text-white/15',
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
