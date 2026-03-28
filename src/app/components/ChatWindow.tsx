'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useRef, useEffect, useState, useMemo, type FormEvent } from 'react';

const SUGGESTED_QUESTIONS = [
  'How are Aave rates on Mantle right now?',
  'Compare wrsETH vs USDC yield',
  'What if ETH drops 30%?',
  'Suggest a balanced strategy for $1000',
];

function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!message.parts) return '';
  return message.parts
    .filter(p => p.type === 'text' && p.text)
    .map(p => p.text)
    .join('');
}

export default function ChatWindow({ fullPage = false }: { fullPage?: boolean }) {
  const transport = useMemo(() => new TextStreamChatTransport({ api: '/api/chat' }), []);
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
    <div className={`mantis-card flex flex-col ${fullPage ? 'h-[calc(100vh-8rem)]' : 'h-[400px]'}`}>
      {!fullPage && (
        <h2 className="text-sm font-medium text-gray-400 mb-3">Chat with MANTIS</h2>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-10 h-10 text-mantis mb-3 opacity-50" />
            <p className="text-sm text-gray-500 mb-4">Ask MANTIS about Mantle DeFi</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[var(--card-border)] text-gray-400 hover:text-mantis hover:border-[var(--mantis-green)] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => {
          const text = getMessageText(m);
          if (!text) return null;

          return (
            <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-[var(--mantis-green)] bg-opacity-20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-mantis" />
                </div>
              )}
              <div
                className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                  m.role === 'user'
                    ? 'bg-[var(--mantis-green)] text-black'
                    : 'bg-[var(--card-border)] text-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{text}</div>
              </div>
              {m.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-gray-300" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--mantis-green)] bg-opacity-20 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-mantis animate-spin" />
            </div>
            <div className="text-sm text-gray-500">Analyzing...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Ask about yields, positions, risk..."
          className="flex-1 bg-[var(--mantis-dark)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--mantis-green)] transition-colors"
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="px-3 py-2 rounded-lg bg-[var(--mantis-green)] text-black hover:bg-[var(--mantis-green-dim)] disabled:opacity-30 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
