import React, { useState, useEffect } from 'react';
import { chatApi } from '../../api/client';
import type { Message } from '../../types/chat';
import { Send, Bot, User } from 'lucide-react';

export const ChatContainer: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    chatApi.getMessages().then(setMessages);
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const assistantMsg = await chatApi.sendMessage(input);
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto border-x border-slate-800 bg-slate-950 text-slate-100">
      <header className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-900/50">
        <Bot className="w-6 h-6 text-sky-400" />
        <h1 className="font-semibold text-lg">AI Assistant Workspace</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-[80%] ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.sender === 'user' ? 'bg-sky-600' : 'bg-slate-800'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-sky-400" />}
            </div>
            <div
              className={`p-3 rounded-2xl ${
                msg.sender === 'user'
                  ? 'bg-sky-600 text-white rounded-tr-none'
                  : 'bg-slate-900 border border-slate-800 rounded-tl-none'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <span className="text-[10px] opacity-60 mt-1 block text-right">{msg.timestamp}</span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-slate-500 text-xs flex items-center gap-2">
            <Bot className="w-3 h-3 animate-bounce" /> Thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-900/30 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-slate-950 font-medium px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
        >
          Send <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
