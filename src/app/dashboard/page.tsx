import Header from '@/app/components/Header';
import PortfolioView from '@/app/components/PortfolioView';
import YieldTable from '@/app/components/YieldTable';
import AgentLog from '@/app/components/AgentLog';
import ChatWindow from '@/app/components/ChatWindow';

export default function DashboardPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Hero */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            <span className="text-mantis">MANTIS</span> Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Autonomous CeDeFi Agent — OBSERVE → DECIDE → ACT
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PortfolioView />
          <YieldTable />
          <AgentLog />
          <ChatWindow />
        </div>
      </main>
    </>
  );
}
