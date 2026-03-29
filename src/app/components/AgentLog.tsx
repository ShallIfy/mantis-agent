'use client';

import { useState, useEffect } from 'react';
import { Play, Clock, CheckCircle, AlertCircle, Loader2, Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LogEntry {
  cycleId: string;
  timestamp: number;
  decision: {
    thinking?: string;
    analysis: { summary: string; risk_level?: string; [key: string]: unknown };
    decision: { action: string; confidence: number; urgency?: string; reasoning: string } | string;
    user_message: string;
  };
  phases: {
    observe: { durationMs: number };
    decide: { durationMs: number };
    act: { durationMs: number; safetyPassed: boolean; violations: string[] };
  };
}

export default function AgentLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState<string | null>(null);

  const getAction = (entry: LogEntry) => {
    const d = entry.decision.decision;
    return typeof d === 'string' ? d : d?.action || 'hold';
  };
  const getReasoning = (entry: LogEntry) => {
    const d = entry.decision.decision;
    return typeof d === 'string' ? d : d?.reasoning || '';
  };
  const getConfidence = (entry: LogEntry) => {
    const d = entry.decision.decision;
    return typeof d === 'string' ? 0 : d?.confidence || 0;
  };

  const runCycle = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/agent/run', { method: 'POST' });
      const data = await res.json();
      if (data.cycleId) {
        setLogs(prev => [data, ...prev].slice(0, 20));
        const action = typeof data.decision?.decision === 'string'
          ? data.decision.decision
          : data.decision?.decision?.action || 'hold';
        toast.success(`Cycle complete: ${action.toUpperCase()}`, {
          description: data.decision?.user_message?.slice(0, 80),
        });
      }
    } catch {
      toast.error('Agent cycle failed');
    } finally {
      setRunning(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/agent/logs');
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch { /* */ }
  };

  useEffect(() => { fetchLogs(); }, []);

  const actionColors: Record<string, string> = {
    hold: 'border-l-primary/50 bg-primary/4',
    suggest: 'border-l-yellow-500/50 bg-yellow-500/4',
    execute: 'border-l-blue-500/50 bg-blue-500/4',
    alert: 'border-l-destructive/50 bg-destructive/4',
  };

  return (
    <div className="mantis-card-premium space-y-0">
      {/* Header + CTA */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <span className="section-header">Agent Activity</span>
        </div>
        <button
          onClick={runCycle}
          disabled={running}
          className={cn(
            'btn-glow text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
            running && 'animate-pulse'
          )}
        >
          {running ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...</>
          ) : (
            <><Play className="w-3.5 h-3.5" /> Run Cycle</>
          )}
        </button>
      </div>

      {/* Empty State */}
      {logs.length === 0 && !running && (
        <div className="text-center py-14">
          <div className="inline-block" style={{ animation: 'float 3s ease-in-out infinite' }}>
            <Cpu className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground mt-4">No agent cycles yet</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Click &quot;Run Cycle&quot; to trigger OBSERVE → DECIDE → ACT</p>
        </div>
      )}

      {/* Running State */}
      {running && logs.length === 0 && (
        <div className="text-center py-14">
          <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
          <p className="text-sm text-primary mt-4 font-medium">Agent thinking...</p>
          <p className="text-xs text-muted-foreground mt-1">Analyzing 7 data sources with extended reasoning</p>
        </div>
      )}

      {/* Log Entries */}
      <ScrollArea className="max-h-[380px]">
        <div className="space-y-2.5">
          {logs.map(entry => {
            const action = getAction(entry);
            const isExpanded = expanded === entry.cycleId;
            const isThinkingShown = showThinking === entry.cycleId;
            const totalMs = entry.phases.observe.durationMs + entry.phases.decide.durationMs + entry.phases.act.durationMs;
            const observePct = (entry.phases.observe.durationMs / totalMs) * 100;
            const decidePct = (entry.phases.decide.durationMs / totalMs) * 100;
            const actPct = (entry.phases.act.durationMs / totalMs) * 100;

            return (
              <div
                key={entry.cycleId}
                className={cn(
                  'border border-border/40 rounded-2xl p-4 cursor-pointer transition-all hover:border-border/80',
                  'border-l-[3px]',
                  actionColors[action] || 'border-l-primary/50'
                )}
                onClick={() => setExpanded(isExpanded ? null : entry.cycleId)}
              >
                {/* Top Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {entry.phases.act.safetyPassed
                      ? <CheckCircle className="w-4 h-4 text-primary/60" />
                      : <AlertCircle className="w-4 h-4 text-destructive/60" />
                    }
                    <Badge variant="outline" className={cn(
                      'text-[0.6rem] font-bold',
                      action === 'hold' && 'bg-primary/8 text-primary border-primary/20',
                      action === 'suggest' && 'bg-yellow-500/8 text-yellow-400 border-yellow-500/20',
                      action === 'execute' && 'bg-blue-500/8 text-blue-400 border-blue-500/20',
                      action === 'alert' && 'bg-destructive/8 text-destructive border-destructive/20',
                    )}>
                      {action.toUpperCase()}
                    </Badge>
                    {entry.decision.thinking && (
                      <Badge variant="outline" className="bg-purple-500/8 text-purple-400 border-purple-500/20 text-[0.6rem]">
                        THINKING
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="tabular-nums font-medium">{(totalMs / 1000).toFixed(1)}s</span>
                    <Clock className="w-3 h-3" />
                    <span className="tabular-nums">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Phase Progress Bar */}
                <div className="phase-bar mt-3 rounded-full">
                  <div className="phase-bar-observe rounded-l-full" style={{ width: `${observePct}%` }} />
                  <div className="phase-bar-decide" style={{ width: `${decidePct}%` }} />
                  <div className="phase-bar-act rounded-r-full" style={{ width: `${actPct}%` }} />
                </div>

                {/* Message */}
                <p className="text-sm mt-3 text-foreground/70 leading-relaxed line-clamp-2">{entry.decision.user_message}</p>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border/30 text-xs space-y-3">
                    <div>
                      <span className="text-muted-foreground font-medium">Summary: </span>
                      <span className="text-foreground/70">{entry.decision.analysis?.summary}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium">Reasoning: </span>
                      <span className="text-foreground/70">{getReasoning(entry)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span>
                        <span className="text-muted-foreground">Confidence: </span>
                        <span className="text-primary font-semibold">{(getConfidence(entry) * 100).toFixed(0)}%</span>
                      </span>
                      <span>
                        <span className="text-muted-foreground">Risk: </span>
                        <span className="text-foreground/70">{entry.decision.analysis?.risk_level || 'N/A'}</span>
                      </span>
                    </div>

                    {/* Phase Timing */}
                    <div className="flex gap-4 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500/60" />
                        Observe {entry.phases.observe.durationMs}ms
                      </span>
                      <span className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-purple-400/60" />
                        Decide {entry.phases.decide.durationMs}ms
                      </span>
                      <span className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-primary/60" />
                        Act {entry.phases.act.durationMs}ms
                      </span>
                    </div>

                    {entry.phases.act.violations.length > 0 && (
                      <Badge variant="destructive" className="bg-destructive/8 text-destructive border-destructive/20 text-[0.6rem]">
                        Safety: {entry.phases.act.violations.join(', ')}
                      </Badge>
                    )}

                    {/* Chain of Thought */}
                    {entry.decision.thinking && (
                      <div className="mt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowThinking(isThinkingShown ? null : entry.cycleId); }}
                          className="text-purple-400 hover:text-purple-300 text-[11px] flex items-center gap-1.5 font-medium transition-colors"
                        >
                          {isThinkingShown ? '▼' : '▶'} Chain of Thought ({(entry.decision.thinking.length / 1000).toFixed(1)}K chars)
                        </button>
                        {isThinkingShown && (
                          <pre className="mt-2 p-3 bg-purple-950/20 border border-purple-900/20 rounded-xl text-[11px] text-purple-300/70 whitespace-pre-wrap max-h-[250px] overflow-y-auto leading-relaxed">
                            {entry.decision.thinking}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
