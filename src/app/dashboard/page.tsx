import Header from '@/app/components/Header';
import StatsBar from '@/app/components/StatsBar';
import PortfolioView from '@/app/components/PortfolioView';
import YieldTable from '@/app/components/YieldTable';
import AgentLog from '@/app/components/AgentLog';

export default function DashboardPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-8">
        {/* Stats Bar */}
        <StatsBar />

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5">
          <div className="lg:col-span-5 lg:h-[520px] animate-in stagger-1">
            <PortfolioView />
          </div>
          <div className="lg:col-span-7 lg:h-[520px] animate-in stagger-2">
            <YieldTable />
          </div>
          <div className="lg:col-span-12 animate-in stagger-3">
            <AgentLog />
          </div>
        </div>

      </main>
    </>
  );
}
