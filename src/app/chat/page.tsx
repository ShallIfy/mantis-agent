import Header from '@/app/components/Header';
import ChatWindow from '@/app/components/ChatWindow';

export default function ChatPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold">
            Chat with <span className="text-mantis">MANTIS</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Ask about yields, positions, strategies, and risk on Mantle
          </p>
        </div>
        <ChatWindow fullPage />
      </main>
    </>
  );
}
