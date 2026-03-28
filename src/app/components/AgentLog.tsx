'use client';

import { useState, useEffect } from 'react';
import { Play, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface LogEntry {
  cycleId: string;
  timestamp: number;
  decision: {
    analysis: { summary: string; risk_level: string };
    decision: { action: string; confidence: number; urgency: string; reasoning: string };
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

  const runCycle = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/agent/run', { method: 'POST' });
      const data = await res.json();
      if (data.cycleId) {
        setLogs(prev => [data, ...prev].slice(0, 20));
      }
    } catch {
      // silently fail
    } finally {
      setRunning(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/agent/logs');
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch {
      // silently fail
    }
  };

  // Fetch logs on mount
  useEffect(() => { fetchLogs(); }, []);

  const actionColors: Record<string, string> = {
    hold: 'text-gray-400',
    suggest: 'text-yellow-400',
    execute: 'text-mantis',
    alert: 'text-red-400',
  };

  const actionIcons: Record<string, typeof CheckCircle> = {
    hold: CheckCircle,
    suggest: AlertCircle,
    execute: Play,
    alert: AlertCircle,
  };

  return (
    <div className="mantis-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400">Agent Activity</h2>
        <button
          onClick={runCycle}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--mantis-green)] text-black hover:bg-[var(--mantis-green-dim)] disabled:opacity-50 transition-colors"
        >
          {running ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...</>
          ) : (
            <><Play className="w-3.5 h-3.5" /> Run Cycle</>
          )}
        </button>
      </div>

      {logs.length === 0 && !running && (
        <div className="text-sm text-gray-500 text-center py-8">
          No agent cycles yet. Click &quot;Run Cycle&quot; to start.
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {logs.map(entry => {
          const Icon = actionIcons[entry.decision.decision.action] || CheckCircle;
          const isExpanded = expanded === entry.cycleId;

          return (
            <div
              key={entry.cycleId}
              className="border border-[var(--card-border)] rounded-lg p-3 cursor-pointer hover:border-[var(--mantis-green)] hover:border-opacity-30 transition-colors"
              onClick={() => setExpanded(isExpanded ? null : entry.cycleId)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${actionColors[entry.decision.decision.action]}`} />
                  <span className={`text-xs font-medium uppercase ${actionColors[entry.decision.decision.action]}`}>
                    {entry.decision.decision.action}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
              </div>

              <p className="text-sm mt-1.5 text-gray-300">{entry.decision.user_message}</p>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-[var(--card-border)] text-xs space-y-2">
                  <div>
                    <span className="text-gray-500">Summary: </span>
                    <span>{entry.decision.analysis.summary}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Reasoning: </span>
                    <span>{entry.decision.decision.reasoning}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Confidence: </span>
                    <span>{(entry.decision.decision.confidence * 100).toFixed(0)}%</span>
                    <span className="text-gray-500 ml-3">Risk: </span>
                    <span>{entry.decision.analysis.risk_level}</span>
                  </div>
                  <div className="flex gap-4 text-gray-500">
                    <span>Observe: {entry.phases.observe.durationMs}ms</span>
                    <span>Decide: {entry.phases.decide.durationMs}ms</span>
                    <span>Act: {entry.phases.act.durationMs}ms</span>
                  </div>
                  {entry.phases.act.violations.length > 0 && (
                    <div className="text-red-400">
                      Safety violations: {entry.phases.act.violations.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
