import Header from '@/app/components/Header';
import PortfolioView from '@/app/components/PortfolioView';
import YieldTable from '@/app/components/YieldTable';
import AgentLog from '@/app/components/AgentLog';
import ChatWindow from '@/app/components/ChatWindow';

export default function DashboardPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Hero Banner */}
        <div className="hero-card mb-6 animate-in">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight leading-none">
                <span className="gradient-text-hero">MANTIS</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                <span className="pulse-dot" />
                Autonomous CeDeFi Agent — OBSERVE → DECIDE → ACT
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2.5">
              <span className="badge badge-green flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--mantis-green)]" />
                Mantle Mainnet
              </span>
              <span className="badge badge-purple flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                7 Data Sources
              </span>
              <span className="badge badge-green flex items-center gap-1.5">
                MCP + Agent Skills
              </span>
            </div>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 animate-in stagger-1">
            <PortfolioView />
          </div>
          <div className="lg:col-span-7 animate-in stagger-2">
            <YieldTable />
          </div>
          <div className="lg:col-span-5 animate-in stagger-3">
            <AgentLog />
          </div>
          <div className="lg:col-span-7 animate-in stagger-4">
            <ChatWindow />
          </div>
        </div>
      </main>
    </>
  );
}
