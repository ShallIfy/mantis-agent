'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, Bot, User, Loader2, Sparkles, Wrench, CheckCircle, XCircle } from 'lucide-react';
import { useRef, useEffect, useState, useMemo, type FormEvent } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const mdComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="table-wrapper">
      <table {...props}>{children}</table>
    </div>
  ),
};

const SUGGESTED_QUESTIONS = [
  'What is the USDC contract address on Mantle?',
  'Show me current Aave lending rates',
  'Get a swap quote for 100 USDC to WETH',
  'Check Mantle chain status and gas price',
];

interface MessagePart {
  type: string;
  text?: string;
  state?: string;
  // Tool parts in ai SDK v6: type="tool-${toolName}", state, input, output
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function getMessageText(message: { parts?: MessagePart[] }): string {
  if (!message.parts) return '';
  return message.parts
    .filter(p => p.type === 'text' && p.text)
    .map(p => p.text)
    .join('');
}

function getThinkingParts(message: { parts?: MessagePart[] }): { text: string; isStreaming: boolean } {
  if (!message.parts) return { text: '', isStreaming: false };
  const reasoningParts = message.parts.filter(p => p.type === 'reasoning');
  const text = reasoningParts.map(p => p.text || '').join('');
  const isStreaming = reasoningParts.some(p => p.state === 'streaming');
  return { text, isStreaming };
}

function getToolParts(message: { parts?: MessagePart[] }): MessagePart[] {
  if (!message.parts) return [];
  // In ai SDK v6, tool parts have type "tool-${toolName}" (e.g. "tool-mantle_resolveToken")
  return message.parts.filter(p => p.type.startsWith('tool-'));
}

// ═══════════════════════════════════════════════
// AGENT SKILLS — tools grouped by Mantle Agent Skill
// ═══════════════════════════════════════════════

const TOOL_SKILLS: Record<string, { skill: string; label: string; color: string }> = {
  // Network Primer
  mantle_getChainInfo:         { skill: 'Network Primer',    label: 'Chain Info',         color: 'cyan' },
  mantle_getChainStatus:       { skill: 'Network Primer',    label: 'Chain Status',       color: 'cyan' },
  // Portfolio Analyst
  mantle_getBalance:           { skill: 'Portfolio Analyst',  label: 'Get Balance',        color: 'green' },
  mantle_getTokenBalances:     { skill: 'Portfolio Analyst',  label: 'Token Balances',     color: 'green' },
  mantle_getAllowances:        { skill: 'Portfolio Analyst',  label: 'Allowances',         color: 'green' },
  mantle_getTokenPrices:       { skill: 'Portfolio Analyst',  label: 'Token Prices',       color: 'green' },
  mantis_yield_projection:     { skill: 'Portfolio Analyst',  label: 'Yield Projection',   color: 'green' },
  // DeFi Operator
  mantle_getSwapQuote:         { skill: 'DeFi Operator',     label: 'Swap Quote',         color: 'amber' },
  mantle_getPoolLiquidity:     { skill: 'DeFi Operator',     label: 'Pool Liquidity',     color: 'amber' },
  mantle_getPoolOpportunities: { skill: 'DeFi Operator',     label: 'Pool Opportunities', color: 'amber' },
  mantle_getLendingMarkets:    { skill: 'DeFi Operator',     label: 'Lending Markets',    color: 'amber' },
  mantle_getProtocolTvl:       { skill: 'DeFi Operator',     label: 'Protocol TVL',       color: 'amber' },
  // Registry Navigator
  mantle_resolveAddress:       { skill: 'Registry Navigator', label: 'Resolve Address',    color: 'purple' },
  mantle_validateAddress:      { skill: 'Registry Navigator', label: 'Validate Address',   color: 'purple' },
  mantle_resolveToken:         { skill: 'Registry Navigator', label: 'Resolve Token',      color: 'purple' },
  mantle_getTokenInfo:         { skill: 'Registry Navigator', label: 'Token Info',         color: 'purple' },
  // Data Indexer
  mantle_querySubgraph:        { skill: 'Data Indexer',       label: 'Query Subgraph',     color: 'blue' },
  mantle_queryIndexerSql:      { skill: 'Data Indexer',       label: 'Query Indexer',      color: 'blue' },
  // Readonly Debugger
  mantle_checkRpcHealth:       { skill: 'Readonly Debugger',  label: 'RPC Health',         color: 'rose' },
  mantle_probeEndpoint:        { skill: 'Readonly Debugger',  label: 'Probe Endpoint',     color: 'rose' },
};

const SKILL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  cyan:   { bg: 'bg-cyan-900/15',    text: 'text-cyan-400',    border: 'border-cyan-800/20' },
  green:  { bg: 'bg-emerald-900/15', text: 'text-emerald-400', border: 'border-emerald-800/20' },
  amber:  { bg: 'bg-amber-900/15',   text: 'text-amber-400',   border: 'border-amber-800/20' },
  purple: { bg: 'bg-purple-900/15',  text: 'text-purple-400',  border: 'border-purple-800/20' },
  blue:   { bg: 'bg-blue-900/15',    text: 'text-blue-400',    border: 'border-blue-800/20' },
  rose:   { bg: 'bg-rose-900/15',    text: 'text-rose-400',    border: 'border-rose-800/20' },
};

function ToolInvocationBlock({ part }: { part: MessagePart }) {
  const toolName = part.type.slice(5); // remove "tool-" prefix
  const meta = TOOL_SKILLS[toolName];
  const skill = meta?.skill || 'Tool';
  const label = meta?.label || toolName;
  const colors = SKILL_COLORS[meta?.color || 'blue'] || SKILL_COLORS.blue;
  const isLoading = part.state === 'input-streaming' || part.state === 'input-available';
  const isDone = part.state === 'output-available';
  const isError = part.state === 'output-error';

  return (
    <div className={cn('rounded-xl text-xs overflow-hidden border', colors.bg, colors.border)}>
      <div className="px-3 py-2 flex items-center gap-1.5">
        {isLoading ? (
          <Loader2 className={cn('w-3 h-3 animate-spin', colors.text)} />
        ) : isError ? (
          <XCircle className="w-3 h-3 text-red-400" />
        ) : (
          <CheckCircle className={cn('w-3 h-3', colors.text)} />
        )}
        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium opacity-70', colors.bg, colors.text)}>{skill}</span>
        <span className={cn('font-medium', colors.text)}>{label}</span>
        {isLoading && <span className={cn('ml-1 opacity-60', colors.text)}>calling...</span>}
        {isDone && <span className={cn('ml-1 opacity-60', colors.text)}>done</span>}
        {isError && <span className="text-red-400/60 ml-1">error</span>}
      </div>
    </div>
  );
}

function ThinkingBlock({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [text, isStreaming]);

  return (
    <div className="rounded-xl text-xs bg-purple-900/15 border border-purple-800/20 overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-3 py-2 flex items-center gap-1.5 text-purple-400 font-medium hover:bg-purple-900/10 transition-colors"
      >
        {isStreaming ? (
          <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        ) : (
          <span className="inline-block w-2 h-2 rounded-full bg-purple-500/50" />
        )}
        <span>{isStreaming ? 'Thinking...' : 'Thought process'}</span>
        <span className="ml-auto text-purple-500/60">{collapsed ? '▶' : '▼'}</span>
      </button>
      {!collapsed && (
        <div
          ref={textRef}
          className="px-3 pb-2 text-purple-300/70 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto"
        >
          {text}
          {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-purple-400 ml-0.5 animate-pulse" />}
        </div>
      )}
    </div>
  );
}

export default function ChatWindow({ fullPage = false }: { fullPage?: boolean }) {
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), []);
  const { messages, sendMessage, status } = useChat({ transport });
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue });
    setInputValue('');
  };

  const handleSuggestion = (q: string) => {
    sendMessage({ text: q });
  };

  return (
    <div className={cn(
      'mantis-card-premium flex flex-col',
      fullPage ? 'h-[calc(100vh-8rem)]' : 'h-[420px]'
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <span className="section-header">{fullPage ? 'Chat with MANTIS' : 'Chat'}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-primary/50" />
            </div>
            <p className="text-sm text-muted-foreground mb-5">Ask MANTIS about Mantle DeFi</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  className="text-xs px-4 py-2 rounded-xl border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/4 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => {
          const text = getMessageText(m);
          const thinkingData = m.role === 'assistant' ? getThinkingParts(m) : null;
          const hasThinking = thinkingData && thinkingData.text.length > 0;
          const toolParts = m.role === 'assistant' ? getToolParts(m) : [];
          const hasTools = toolParts.length > 0;
          if (!text && !hasThinking && !hasTools) return null;

          return (
            <div key={m.id} className={cn('flex gap-2.5', m.role === 'user' && 'justify-end')}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-primary/20">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={cn('max-w-[80%]', m.role !== 'user' && 'space-y-2')}>
                {hasThinking && (
                  <ThinkingBlock text={thinkingData.text} isStreaming={thinkingData.isStreaming} />
                )}
                {hasTools && (
                  <div className="space-y-1">
                    {toolParts.map((tp, i) => (
                      <ToolInvocationBlock key={i} part={tp} />
                    ))}
                  </div>
                )}
                {text && (
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm',
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-primary to-[var(--mantis-green-dim)] text-primary-foreground'
                        : 'bg-muted/60 text-foreground border border-border/30'
                    )}
                  >
                    {m.role === 'assistant' ? (
                      <div className="chat-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{text}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{text}</div>
                    )}
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            </div>
            <div className="bg-muted/60 border border-border/30 rounded-2xl px-4 py-3">
              <div className="typing-dots flex gap-1.5">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Ask about yields, positions, risk..."
          className="flex-1 bg-muted/30 border border-border/50 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="btn-glow w-10 h-10 flex items-center justify-center rounded-xl disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none p-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
