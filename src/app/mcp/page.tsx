'use client';

import { useEffect, useState, useMemo } from 'react';
import Header from '@/app/components/Header';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Play, ChevronDown, ChevronRight, Network, Loader2, CheckCircle, XCircle,
  Clock, Layers, Cpu, Search, Zap, ArrowRight, Box, Wallet, Coins,
  TrendingUp, BookOpen, Server, Activity, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, { type?: string; description?: string; enum?: string[]; default?: unknown }>;
    required?: string[];
  };
}

interface ChainHealth {
  blockNumber?: number;
  gasPrice?: string;
  gasPriceGwei?: string;
  latencyMs: number;
}

// ═══════════════════════════════════════════════
// AGENT SKILLS — aligned with Mantle Agent Skills framework
// ═══════════════════════════════════════════════

const TOOL_CATEGORIES: Record<string, string[]> = {
  'Network Primer': ['mantle_getChainInfo', 'mantle_getChainStatus'],
  'Portfolio Analyst': ['mantle_getBalance', 'mantle_getTokenBalances', 'mantle_getAllowances', 'mantle_getTokenPrices'],
  'DeFi Operator': ['mantle_getSwapQuote', 'mantle_getPoolLiquidity', 'mantle_getPoolOpportunities', 'mantle_getLendingMarkets', 'mantle_getProtocolTvl'],
  'Registry Navigator': ['mantle_resolveAddress', 'mantle_validateAddress', 'mantle_resolveToken', 'mantle_getTokenInfo'],
  'Data Indexer': ['mantle_querySubgraph', 'mantle_queryIndexerSql'],
  'Readonly Debugger': ['mantle_checkRpcHealth', 'mantle_probeEndpoint'],
};

const CATEGORY_ICONS: Record<string, typeof Network> = {
  'Network Primer': Layers,
  'Portfolio Analyst': Wallet,
  'DeFi Operator': TrendingUp,
  'Registry Navigator': BookOpen,
  'Data Indexer': Server,
  'Readonly Debugger': Activity,
};

const CATEGORY_STYLES: Record<string, string> = {
  'Network Primer': 'bg-cyan-500/8 text-cyan-400 border-cyan-500/20',
  'Portfolio Analyst': 'bg-emerald-500/8 text-emerald-400 border-emerald-500/20',
  'DeFi Operator': 'bg-amber-500/8 text-amber-400 border-amber-500/20',
  'Registry Navigator': 'bg-purple-500/8 text-purple-400 border-purple-500/20',
  'Data Indexer': 'bg-blue-500/8 text-blue-400 border-blue-500/20',
  'Readonly Debugger': 'bg-rose-500/8 text-rose-400 border-rose-500/20',
};

const QUICK_ACTIONS = [
  { label: 'Chain Status', tool: 'mantle_getChainStatus', args: {}, icon: Activity },
  { label: 'RPC Health', tool: 'mantle_checkRpcHealth', args: {}, icon: Shield },
  { label: 'Lending Markets', tool: 'mantle_getLendingMarkets', args: {}, icon: TrendingUp },
  { label: 'Resolve WETH', tool: 'mantle_resolveToken', args: { symbol: 'WETH' }, icon: Coins },
];

function getCategoryForTool(name: string): string {
  for (const [cat, tools] of Object.entries(TOOL_CATEGORIES)) {
    if (tools.includes(name)) return cat;
  }
  return 'Other';
}

/* ─── JSON Syntax Highlighter ─── */
function SyntaxJSON({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);
  // Simple syntax highlighting
  const highlighted = json.replace(
    /("(?:[^"\\]|\\.)*")\s*:/g,
    '<span class="text-blue-400">$1</span>:'
  ).replace(
    /:\s*("(?:[^"\\]|\\.)*")/g,
    ': <span class="text-primary/80">$1</span>'
  ).replace(
    /:\s*(\d+\.?\d*)/g,
    ': <span class="text-yellow-400">$1</span>'
  ).replace(
    /:\s*(true|false|null)/g,
    ': <span class="text-purple-400">$1</span>'
  );

  return (
    <pre
      className="text-[11px] font-mono p-3 rounded-xl bg-muted/20 border border-border/30 overflow-x-auto whitespace-pre-wrap leading-relaxed text-muted-foreground/70"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

/* ─── Tool Card ─── */
function ToolCard({ tool }: { tool: McpTool }) {
  const [expanded, setExpanded] = useState(false);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  const category = getCategoryForTool(tool.name);
  const CatIcon = CATEGORY_ICONS[category] || Network;
  const properties = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];
  const shortName = tool.name.replace('mantle_', '');

  const invoke = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setLatency(null);
    try {
      const args: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(params)) {
        if (!val.trim()) continue;
        try { args[key] = JSON.parse(val); } catch { args[key] = val; }
      }
      const url = `/api/mcp?action=invoke&tool=${encodeURIComponent(tool.name)}&args=${encodeURIComponent(JSON.stringify(args))}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setResult(data.result); setLatency(data.latencyMs); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invocation failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={cn(
      'mantis-card-premium transition-all',
      expanded && 'ring-1 ring-primary/10',
    )}>
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 text-left">
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
          expanded ? 'bg-primary/15' : 'bg-muted/50'
        )}>
          <CatIcon className={cn('w-4 h-4', expanded ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{shortName}</span>
            <Badge variant="outline" className={cn('text-[0.55rem]', CATEGORY_STYLES[category])}>
              {category}
            </Badge>
            {Object.keys(properties).length > 0 && (
              <span className="text-[10px] text-muted-foreground/40">{Object.keys(properties).length} params</span>
            )}
          </div>
          {tool.description && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-1">{tool.description}</p>
          )}
        </div>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
        }
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border/20 space-y-4">
          {/* Full description */}
          {tool.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
          )}

          {/* Endpoint info */}
          <div className="flex items-center gap-2 text-[10px]">
            <code className="font-mono text-muted-foreground/50 bg-muted/30 px-2 py-0.5 rounded">GET</code>
            <code className="font-mono text-muted-foreground/50">/api/mcp?action=invoke&tool={tool.name}</code>
          </div>

          {/* Parameters */}
          {Object.keys(properties).length > 0 && (
            <div>
              <div className="stat-label mb-2">Parameters</div>
              <div className="space-y-2.5">
                {Object.entries(properties).map(([key, prop]) => (
                  <div key={key} className="bg-muted/15 rounded-xl p-3 border border-border/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-xs font-mono font-semibold text-foreground">{key}</span>
                      {required.includes(key) && (
                        <Badge variant="outline" className="text-[0.5rem] bg-destructive/8 text-destructive border-destructive/20 px-1 py-0">req</Badge>
                      )}
                      {prop.type && (
                        <span className="text-[0.55rem] text-muted-foreground/40 font-mono">{prop.type}</span>
                      )}
                    </div>
                    {prop.description && (
                      <p className="text-[10px] text-muted-foreground/50 mb-2">{prop.description}</p>
                    )}
                    {prop.enum ? (
                      <select
                        value={params[key] || ''}
                        onChange={e => setParams(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                      >
                        <option value="">-- select --</option>
                        {prop.enum.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder={prop.default !== undefined ? String(prop.default) : `Enter ${key}...`}
                        value={params[key] || ''}
                        onChange={e => setParams(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-1.5 text-xs font-mono placeholder:text-muted-foreground/25 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoke */}
          <button onClick={invoke} disabled={running} className="btn-glow text-xs flex items-center gap-2 disabled:opacity-50">
            {running ? <><Loader2 className="w-3 h-3 animate-spin" /> Executing...</> : <><Play className="w-3 h-3" /> Execute</>}
          </button>

          {/* Result */}
          {(result !== null || error) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                {error ? (
                  <><XCircle className="w-3.5 h-3.5 text-destructive" /><span className="stat-label text-destructive">Error</span></>
                ) : (
                  <><CheckCircle className="w-3.5 h-3.5 text-primary" /><span className="stat-label text-primary">Success</span></>
                )}
                {latency !== null && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto tabular-nums">
                    <Clock className="w-3 h-3" /> {latency}ms
                  </span>
                )}
              </div>
              <ScrollArea className="max-h-[300px]">
                {error ? (
                  <pre className="text-[11px] font-mono p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive/80 whitespace-pre-wrap">{error}</pre>
                ) : (
                  <SyntaxJSON data={result} />
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Quick Action Button ─── */
function QuickAction({ label, tool, args, icon: Icon }: { label: string; tool: string; args: Record<string, unknown>; icon: typeof Network }) {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [running, setRunning] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const invoke = async () => {
    setRunning(true);
    setError(null);
    try {
      const url = `/api/mcp?action=invoke&tool=${encodeURIComponent(tool)}&args=${encodeURIComponent(JSON.stringify(args))}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setResult(data.result as Record<string, unknown>); setLatency(data.latencyMs); setShow(true); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={invoke}
        disabled={running}
        className={cn(
          'stat-card flex items-center gap-3 w-full text-left transition-all group',
          'hover:border-primary/30 hover:bg-primary/4',
          running && 'opacity-60'
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
          {running ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Icon className="w-4 h-4 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold">{label}</span>
          <p className="text-[10px] text-muted-foreground/50 font-mono truncate">{tool}</p>
        </div>
        {latency !== null && !running && (
          <span className="text-[10px] text-primary/60 tabular-nums">{latency}ms</span>
        )}
        {!running && !latency && (
          <Play className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
        )}
      </button>
      {show && result && (
        <ScrollArea className="max-h-[200px]">
          <SyntaxJSON data={result} />
        </ScrollArea>
      )}
      {error && (
        <pre className="text-[10px] font-mono p-2 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive/70">{error}</pre>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function McpPage() {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(false);
  const [chainHealth, setChainHealth] = useState<ChainHealth | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Fetch tools list
    fetch('/api/mcp?action=tools')
      .then(r => r.json())
      .then(data => {
        if (data.tools) { setTools(data.tools); setServerOnline(true); }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Auto health check
    const start = Date.now();
    fetch('/api/mcp?action=invoke&tool=mantle_getChainStatus&args={}')
      .then(r => r.json())
      .then(data => {
        if (data.result) {
          setChainHealth({
            blockNumber: data.result.block_number,
            gasPrice: data.result.gas_price_wei,
            gasPriceGwei: data.result.gas_price_gwei,
            latencyMs: data.latencyMs || (Date.now() - start),
          });
        }
      })
      .catch(() => {});
  }, []);

  const categories = Object.keys(TOOL_CATEGORIES);

  const filteredTools = useMemo(() => {
    if (!search.trim()) return tools;
    const q = search.toLowerCase();
    return tools.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      getCategoryForTool(t.name).toLowerCase().includes(q)
    );
  }, [tools, search]);

  const getToolsForCategory = (cat: string) =>
    filteredTools.filter(t => TOOL_CATEGORIES[cat]?.includes(t.name));

  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Hero */}
        <div className="hero-card mb-6 animate-in">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">
                  <span className="gradient-text-hero">MCP Explorer</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Interactive playground for Mantle Agent Scaffold tools
                </p>
              </div>
              <Badge variant="outline" className={cn(
                'text-[0.65rem] px-3 py-1',
                serverOnline
                  ? 'border-primary/20 bg-primary/8 text-primary'
                  : 'border-destructive/20 bg-destructive/8 text-destructive'
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full mr-2', serverOnline ? 'bg-primary animate-pulse' : 'bg-destructive')} />
                {serverOnline ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>

            {/* Architecture Flow */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 overflow-x-auto">
              <span className="flex items-center gap-1 bg-muted/30 px-2.5 py-1 rounded-lg whitespace-nowrap">
                <Box className="w-3 h-3" /> MANTIS Agent
              </span>
              <ArrowRight className="w-3 h-3 text-primary/40 flex-shrink-0" />
              <span className="flex items-center gap-1 bg-primary/8 px-2.5 py-1 rounded-lg border border-primary/15 whitespace-nowrap">
                <Network className="w-3 h-3 text-primary" /> MCP Client (stdio)
              </span>
              <ArrowRight className="w-3 h-3 text-primary/40 flex-shrink-0" />
              <span className="flex items-center gap-1 bg-purple-500/8 px-2.5 py-1 rounded-lg border border-purple-500/15 whitespace-nowrap">
                <Server className="w-3 h-3 text-purple-400" /> Agent Scaffold
              </span>
              <ArrowRight className="w-3 h-3 text-primary/40 flex-shrink-0" />
              <span className="flex items-center gap-1 bg-blue-500/8 px-2.5 py-1 rounded-lg border border-blue-500/15 whitespace-nowrap">
                <Layers className="w-3 h-3 text-blue-400" /> Mantle RPC / APIs
              </span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-in stagger-1">
          <div className="stat-card">
            <div className="stat-label flex items-center gap-1 mb-1"><Network className="w-3 h-3" /> Tools</div>
            <div className="stat-value text-primary">{tools.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label flex items-center gap-1 mb-1"><Layers className="w-3 h-3" /> Skills</div>
            <div className="stat-value">{categories.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label flex items-center gap-1 mb-1"><Activity className="w-3 h-3" /> Block</div>
            <div className="stat-value tabular-nums">
              {chainHealth?.blockNumber
                ? chainHealth.blockNumber.toLocaleString()
                : <span className="text-muted-foreground/30">...</span>
              }
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label flex items-center gap-1 mb-1"><Zap className="w-3 h-3" /> Gas</div>
            <div className="stat-value tabular-nums">
              {chainHealth?.gasPriceGwei
                ? `${parseFloat(chainHealth.gasPriceGwei).toFixed(4)}`
                : <span className="text-muted-foreground/30">...</span>
              }
              <span className="text-xs text-muted-foreground ml-1 font-normal">gwei</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar: Quick Actions */}
          <div className="lg:col-span-3 animate-in stagger-2">
            <h2 className="section-header flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5" /> Quick Actions
            </h2>
            <div className="space-y-2">
              {QUICK_ACTIONS.map(qa => (
                <QuickAction key={qa.tool} {...qa} />
              ))}
            </div>

            <Separator className="my-5 bg-border/30" />

            {/* Connection Info */}
            <h2 className="section-header flex items-center gap-2 mb-3">
              <Cpu className="w-3.5 h-3.5" /> Connection
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transport</span>
                <code className="font-mono text-foreground/70">stdio</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Server</span>
                <code className="font-mono text-foreground/70 text-[10px]">agent-scaffold</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <code className="font-mono text-primary text-[10px]">mainnet</code>
              </div>
              {chainHealth && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latency</span>
                  <code className="font-mono text-foreground/70">{chainHealth.latencyMs}ms</code>
                </div>
              )}
            </div>
          </div>

          {/* Main: Tools */}
          <div className="lg:col-span-9 animate-in stagger-3">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <input
                type="text"
                placeholder="Search tools..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-muted/20 border border-border/40 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
              {search && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {filteredTools.length} results
                </span>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div className="text-center py-20">
                <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
                <p className="text-sm text-muted-foreground mt-4">Connecting to MCP server...</p>
              </div>
            )}

            {/* Tools by Category */}
            {!loading && filteredTools.length > 0 && (
              <Tabs defaultValue="All">
                <TabsList className="bg-muted/30 border border-border/50 p-1 mb-4 rounded-xl flex-wrap h-auto gap-0.5">
                  <TabsTrigger value="All" className="text-xs rounded-lg data-[state=active]:bg-primary/12 data-[state=active]:text-primary">
                    All <span className="ml-1 text-[0.6rem] text-muted-foreground/50">{filteredTools.length}</span>
                  </TabsTrigger>
                  {categories.map(cat => {
                    const count = getToolsForCategory(cat).length;
                    const CatIcon = CATEGORY_ICONS[cat] || Network;
                    return (
                      <TabsTrigger
                        key={cat}
                        value={cat}
                        className={cn('text-xs rounded-lg data-[state=active]:bg-primary/12 data-[state=active]:text-primary', count === 0 && 'opacity-30')}
                        disabled={count === 0}
                      >
                        <CatIcon className="w-3 h-3 mr-1" />
                        {cat}
                        <span className="ml-1 text-[0.6rem] text-muted-foreground/50">{count}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <TabsContent value="All" className="mt-0">
                  <div className="space-y-2.5">
                    {filteredTools.map(tool => <ToolCard key={tool.name} tool={tool} />)}
                  </div>
                </TabsContent>

                {categories.map(cat => (
                  <TabsContent key={cat} value={cat} className="mt-0">
                    <div className="space-y-2.5">
                      {getToolsForCategory(cat).map(tool => <ToolCard key={tool.name} tool={tool} />)}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}

            {/* No results */}
            {!loading && filteredTools.length === 0 && tools.length > 0 && (
              <div className="text-center py-16">
                <Search className="w-8 h-8 text-muted-foreground/20 mx-auto" />
                <p className="text-sm text-muted-foreground mt-3">No tools match &quot;{search}&quot;</p>
              </div>
            )}

            {/* Offline */}
            {!loading && tools.length === 0 && (
              <div className="text-center py-20">
                <XCircle className="w-10 h-10 text-destructive/30 mx-auto" />
                <p className="text-sm text-muted-foreground mt-4">Could not connect to MCP server</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Ensure mantle-agent-scaffold is built and accessible</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
