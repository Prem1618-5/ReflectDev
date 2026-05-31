import { SessionScore } from './score';

/** Source type identifying where a chat session originated. */
export type Source =
  | 'vscode-chat'
  | 'claude-cli'
  | 'codex-cli'
  | 'gemini-cli'
  | 'terminal'
  | 'import';

/** A single message within a chat session. */
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokenCount: number;
  estimatedCostUSD: number;
  model?: string;
  source: Source;
  truncated?: boolean;
}

/** A complete chat session containing messages and metadata. */
export interface ChatSession {
  id: string;
  source: Source;
  startedAt: Date;
  endedAt?: Date;
  model?: string;
  messages: ChatMessage[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  status: 'active' | 'complete' | 'interrupted';
  score?: SessionScore;
}
