import type { Message } from '../types/chat';

const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    sender: 'assistant',
    content: 'Hello! I am your AI Assistant. How can I help you build today?',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
];

export const chatApi = {
  async getMessages(): Promise<Message[]> {
    return MOCK_MESSAGES;
  },

  async sendMessage(content: string): Promise<Message> {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      id: Date.now().toString(),
      sender: 'assistant',
      content: `[Stub Response] Received: "${content}". Backend is currently offline.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  },
};