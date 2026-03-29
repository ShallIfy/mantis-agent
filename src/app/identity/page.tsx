'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Header from '@/app/components/Header';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, CheckCircle, Cpu, Link2, Shield, Layers, Zap, Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface IdentityData {
  registry: string;
  reputationRegistry: string;
  chain: string;
  totalRegisteredAgents: number;
  mantisMetadata: {
    type: string;
    name: string;
    description: string;
    image: string;
    services: Array<{
      name: string;
      endpoint: string;
      version: string;
      skills: string[];
      domains: string[];
    }>;
    x402Support: boolean;
    active: boolean;
    supportedTrust: string[];
    supportedProtocols: string[];
    techStack: {
      ai: string;
      chain: string;
      mcp: string;
      dataFeeds: string[];
    };
  };
  registrationCost: string;
  standard: string;
}

function Copyable({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label || 'Value'} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-2 group text-left max-w-full">
      <code className="text-xs font-mono text-muted-foreground truncate group-hover:text-foreground transition-colors">{value}</code>
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary flex-shrink-0 transition-colors" />}
    </button>
  );
}

export default function IdentityPage() {
  const [data, setData] = useState<IdentityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calldata, setCalldata] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/identity')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Generate calldata (simple approach - use metadata URL)
  useEffect(() => {
    if (data) {
      // The registration calldata would register with the metadata JSON URL
      const metadataUrl = 'https://raw.githubusercontent.com/ShallIfy/mantis-agent/main/public/agent-metadata.json';
      // Simple ABI encode: register(string)
      // function selector: first 4 bytes of keccak256("register(string)")
      setCalldata(`register("${metadataUrl}")`);
    }
  }, [data]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          <div className="text-center py-20">
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
            <p className="text-sm text-muted-foreground mt-4">Loading agent identity...</p>
          </div>
        </main>
      </>
    );
  }

  if (!data) return null;
  const meta = data.mantisMetadata;

  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Hero */}
        <div className="hero-card mb-6 animate-in">
          <div className="relative z-10 flex items-center gap-5">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-primary/20 flex-shrink-0">
              <Image src="/mantis-logo.png" alt="MANTIS" fill className="object-cover" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="gradient-text-hero">{meta.name}</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{meta.description}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary text-[0.6rem]">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />
                  Active
                </Badge>
                <Badge variant="outline" className="border-blue-500/20 bg-blue-500/8 text-blue-400 text-[0.6rem]">{data.standard}</Badge>
                <Badge variant="outline" className="border-purple-500/20 bg-purple-500/8 text-purple-400 text-[0.6rem]">MCP</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Identity Card */}
          <div className="lg:col-span-5 space-y-5">
            <div className="mantis-card-premium mantis-glow animate-in stagger-1">
              <h2 className="section-header flex items-center gap-2 mb-4">
                <Shield className="w-3.5 h-3.5" /> Agent Identity
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">Autonomous CeDeFi Agent</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Chain</span>
                  <span className="font-medium">{data.chain}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Standard</span>
                  <span className="font-medium">{data.standard}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Protocols</span>
                  <div className="flex gap-1">
                    {meta.supportedProtocols.map(p => (
                      <Badge key={p} variant="outline" className="text-[0.6rem] border-purple-500/20 bg-purple-500/8 text-purple-400">{p}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Trust</span>
                  <div className="flex gap-1">
                    {meta.supportedTrust.map(t => (
                      <Badge key={t} variant="outline" className="text-[0.6rem] border-blue-500/20 bg-blue-500/8 text-blue-400">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">x402 Support</span>
                  <span className="text-muted-foreground/60">{meta.x402Support ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            {/* Registry Info */}
            <div className="mantis-card-premium animate-in stagger-3">
              <h2 className="section-header flex items-center gap-2 mb-4">
                <Layers className="w-3.5 h-3.5" /> On-chain Registry
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="stat-label mb-1">Identity Registry</div>
                  <Copyable value={data.registry} label="Registry address" />
                </div>
                <div>
                  <div className="stat-label mb-1">Reputation Registry</div>
                  <Copyable value={data.reputationRegistry} label="Reputation address" />
                </div>
                <Separator className="bg-border/30" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="stat-label mb-1">Total Agents</div>
                    <div className="text-xl font-bold text-primary tabular-nums">{data.totalRegisteredAgents}</div>
                  </div>
                  <div>
                    <div className="stat-label mb-1">Registration Cost</div>
                    <div className="text-sm font-medium text-muted-foreground">{data.registrationCost}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7 space-y-5">
            {/* Services */}
            <div className="animate-in stagger-2">
              <h2 className="section-header flex items-center gap-2 mb-3">
                <Link2 className="w-3.5 h-3.5" /> Services
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meta.services.map(service => (
                  <div key={service.name} className="mantis-card-premium border-l-[3px] border-l-primary/40">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold">{service.name}</h3>
                      <Badge variant="outline" className="ml-auto text-[0.6rem] border-primary/20 bg-primary/8 text-primary">v{service.version}</Badge>
                    </div>
                    <div className="mb-3">
                      <div className="stat-label mb-1">Endpoint</div>
                      <Copyable value={service.endpoint} label="Endpoint" />
                    </div>
                    <div className="mb-2">
                      <div className="stat-label mb-1.5">Skills</div>
                      <div className="flex flex-wrap gap-1">
                        {service.skills.map(skill => (
                          <Badge key={skill} variant="outline" className="text-[0.55rem] border-primary/20 bg-primary/5 text-primary/80">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="stat-label mb-1.5">Domains</div>
                      <div className="flex gap-1">
                        {service.domains.map(domain => (
                          <Badge key={domain} variant="outline" className="text-[0.55rem] border-blue-500/20 bg-blue-500/5 text-blue-400/80">{domain}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech Stack */}
            <div className="animate-in stagger-3">
              <h2 className="section-header flex items-center gap-2 mb-3">
                <Cpu className="w-3.5 h-3.5" /> Tech Stack
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="stat-card">
                  <div className="stat-label flex items-center gap-1 mb-2">
                    <Cpu className="w-3 h-3" /> AI Model
                  </div>
                  <div className="text-xs font-semibold leading-snug">{meta.techStack.ai}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label flex items-center gap-1 mb-2">
                    <Layers className="w-3 h-3" /> Chain
                  </div>
                  <div className="text-xs font-semibold leading-snug">{meta.techStack.chain}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label flex items-center gap-1 mb-2">
                    <Database className="w-3 h-3" /> MCP
                  </div>
                  <div className="text-xs font-semibold leading-snug">{meta.techStack.mcp}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label flex items-center gap-1 mb-2">
                    <Zap className="w-3 h-3" /> Data Feeds
                  </div>
                  <div className="text-xs font-semibold leading-snug">{meta.techStack.dataFeeds.length} sources</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {meta.techStack.dataFeeds.map(f => (
                      <span key={f} className="text-[0.55rem] text-muted-foreground">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Registration Calldata */}
            <div className="mantis-card-premium animate-in stagger-4">
              <h2 className="section-header flex items-center gap-2 mb-3">
                <Shield className="w-3.5 h-3.5" /> Registration
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                Call <code className="text-primary text-[0.7rem]">register(agentURI)</code> on the Identity Registry contract to register MANTIS on-chain.
              </p>
              <div className="bg-muted/30 border border-border/50 rounded-xl p-3">
                <div className="stat-label mb-1.5">Metadata URI</div>
                <Copyable value="https://raw.githubusercontent.com/ShallIfy/mantis-agent/main/public/agent-metadata.json" label="Metadata URI" />
              </div>
              {calldata && (
                <div className="bg-muted/30 border border-border/50 rounded-xl p-3 mt-2">
                  <div className="stat-label mb-1.5">Function Call</div>
                  <Copyable value={calldata} label="Calldata" />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
