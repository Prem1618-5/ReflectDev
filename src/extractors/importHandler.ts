/**
 * @module importHandler
 * @description Handles importing chat history from Claude.ai, OpenAI/ChatGPT,
 * and ReflectDev's own JSON format. Parses files selected via VS Code file picker,
 * normalizes messages, truncates content to 10,000 chars, and stores sessions.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession, ChatMessage, Source } from '../models/session';
import { SessionStore } from '../store/sessionStore';
import { Logger } from '../utils/logger';

/** Maximum characters stored per message content. */
const MAX_CONTENT_LENGTH = 10_000;

// ─── Local type definitions for import formats ─────────────────────────────

/** Claude.ai export format. */
interface ClaudeExport {
  conversations: ClaudeConversation[];
}

interface ClaudeConversation {
  uuid: string;
  name: string;
  created_at: string;
  chat_messages: ClaudeChatMessage[];
}

interface ClaudeChatMessage {
  uuid: string;
  text: string;
  sender: 'human' | 'assistant';
  created_at: string;
}

/** OpenAI/ChatGPT export format. */
interface OpenAIConversation {
  id: string;
  title: string;
  mapping: Record<string, OpenAINode>;
}

interface OpenAINode {
  message: OpenAIMessage | null;
}

interface OpenAIMessage {
  author: { role: 'user' | 'assistant' | 'system' };
  content: { parts?: string[] };
  create_time: number | null;
}

/** ReflectDev own export format. */
interface ReflectDevExport {
  version: string;
  sessions: ChatSession[];
}

/**
 * Static import handler for chat history files.
 * Supports Claude.ai, OpenAI/ChatGPT, and ReflectDev JSON formats.
 */
export class ImportHandler {
  /**
   * Opens a VS Code file picker for .json files, detects the export format,
   * parses conversations, and stores them in the session store.
   * @param store - The session store to save parsed sessions into.
   * @param logger - Logger instance for output channel logging.
   */
  static async importFromFile(store: SessionStore, logger: Logger): Promise<void> {
    try {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        canSelectFolders: false,
        canSelectFiles: true,
        filters: { 'JSON Files': ['json'] },
        title: 'Select Chat Export File',
      });

      if (!uris || uris.length === 0) {
        return;
      }

      const filePath = uris[0].fsPath;
      logger.info(`Import: reading file ${filePath}`);

      let raw: string;
      try {
        raw = fs.readFileSync(filePath, 'utf-8');
      } catch (readErr) {
        const errorMessage = readErr instanceof Error ? readErr.message : String(readErr);
        logger.error('Import: failed to read file', new Error(errorMessage));
        void vscode.window.showErrorMessage('ReflectDev: Could not read the selected file.');
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        const errorMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
        logger.error('Import: JSON parse failed', new Error(errorMessage));
        void vscode.window.showErrorMessage('ReflectDev: File is not valid JSON.');
        return;
      }

      const sessions = ImportHandler.detectAndParse(parsed, logger);

      if (sessions.length === 0) {
        logger.warn('Import: no conversations found in file');
        void vscode.window.showWarningMessage(
          'ReflectDev: No conversations found in this file.'
        );
        return;
      }

      let added = 0;
      for (const session of sessions) {
        await store.addSession(session);
        added++;
      }

      void vscode.window.showInformationMessage(
        `ReflectDev: Imported ${added} conversation${added !== 1 ? 's' : ''}.`
      );
      logger.info(`Import: successfully imported ${added} sessions from ${filePath}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Import: unexpected error during import', error);
      void vscode.window.showErrorMessage(
        `ReflectDev: Import failed — ${error.message}`
      );
    }
  }

  /**
   * Detects the format of parsed JSON data and delegates to the appropriate parser.
   * @param data - The parsed JSON data of unknown format.
   * @param logger - Logger for format detection logging.
   * @returns Array of parsed ChatSession objects.
   */
  private static detectAndParse(data: unknown, logger: Logger): ChatSession[] {
    // Detect Claude.ai export: { conversations: [...] }
    if (ImportHandler.isClaudeExport(data)) {
      logger.info('Import: detected Claude.ai export format');
      return ImportHandler.parseClaudeExport(data);
    }

    // Detect OpenAI/ChatGPT export: Array with mapping property
    if (ImportHandler.isOpenAIExport(data)) {
      logger.info('Import: detected OpenAI/ChatGPT export format');
      return ImportHandler.parseOpenAIExport(data);
    }

    // Detect ReflectDev own format: { version, sessions: [...] }
    if (ImportHandler.isReflectDevExport(data)) {
      logger.info('Import: detected ReflectDev export format');
      return ImportHandler.parseReflectDevExport(data);
    }

    logger.warn('Import: unrecognized file format');
    return [];
  }

  // ─── Format detection type guards ───────────────────────────────────────

  /** Type guard for Claude.ai export format. */
  private static isClaudeExport(data: unknown): data is ClaudeExport {
    return (
      typeof data === 'object' &&
      data !== null &&
      'conversations' in data &&
      Array.isArray((data as ClaudeExport).conversations)
    );
  }

  /** Type guard for OpenAI/ChatGPT export format. */
  private static isOpenAIExport(data: unknown): data is OpenAIConversation[] {
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }
    const first = data[0] as Record<string, unknown>;
    return typeof first === 'object' && first !== null && 'mapping' in first;
  }

  /** Type guard for ReflectDev own export format. */
  private static isReflectDevExport(data: unknown): data is ReflectDevExport {
    return (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      'sessions' in data &&
      Array.isArray((data as ReflectDevExport).sessions)
    );
  }

  // ─── Format-specific parsers ───────────────────────────────────────────

  /**
   * Parses Claude.ai export format into ChatSession array.
   * Maps sender 'human' → role 'user', sender 'assistant' → role 'assistant'.
   */
  private static parseClaudeExport(data: ClaudeExport): ChatSession[] {
    const sessions: ChatSession[] = [];

    for (const conv of data.conversations) {
      try {
        const messages: ChatMessage[] = (conv.chat_messages || []).map(
          (msg: ClaudeChatMessage): ChatMessage => {
            const content = String(msg.text || '');
            const truncated = content.length > MAX_CONTENT_LENGTH;

            return {
              id: msg.uuid || uuidv4(),
              sessionId: conv.uuid,
              role: msg.sender === 'human' ? 'user' : 'assistant',
              content: content.slice(0, MAX_CONTENT_LENGTH),
              timestamp: new Date(msg.created_at),
              tokenCount: 0,
              estimatedCostUSD: 0,
              source: 'import' as Source,
              truncated,
            };
          }
        );

        const session: ChatSession = {
          id: conv.uuid,
          source: 'import' as Source,
          startedAt: new Date(conv.created_at),
          endedAt: messages.length > 0
            ? messages[messages.length - 1].timestamp
            : undefined,
          messages,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCostUSD: 0,
          status: 'complete',
        };

        sessions.push(session);
      } catch {
        // Skip malformed conversations silently
      }
    }

    return sessions;
  }

  /**
   * Parses OpenAI/ChatGPT export format into ChatSession array.
   * Filters out system messages and null messages, sorts by create_time.
   */
  private static parseOpenAIExport(conversations: OpenAIConversation[]): ChatSession[] {
    const sessions: ChatSession[] = [];

    for (const conv of conversations) {
      try {
        const nodes = Object.values(conv.mapping)
          .filter(
            (node: OpenAINode): node is OpenAINode & { message: OpenAIMessage } =>
              node.message !== null &&
              node.message !== undefined &&
              node.message.author.role !== 'system'
          )
          .sort((a, b) => {
            const timeA = a.message.create_time ?? 0;
            const timeB = b.message.create_time ?? 0;
            return timeA - timeB;
          });

        const sessionId = conv.id || uuidv4();
        const messages: ChatMessage[] = nodes.map(
          (node): ChatMessage => {
            const msg = node.message;
            const parts = msg.content.parts ?? [];
            const content = parts.join('\n');
            const truncated = content.length > MAX_CONTENT_LENGTH;
            const role: 'user' | 'assistant' =
              msg.author.role === 'user' ? 'user' : 'assistant';

            return {
              id: uuidv4(),
              sessionId,
              role,
              content: content.slice(0, MAX_CONTENT_LENGTH),
              timestamp: new Date((msg.create_time ?? 0) * 1000),
              tokenCount: 0,
              estimatedCostUSD: 0,
              source: 'import' as Source,
              truncated,
            };
          }
        );

        const session: ChatSession = {
          id: sessionId,
          source: 'import' as Source,
          startedAt: messages.length > 0 ? messages[0].timestamp : new Date(),
          endedAt: messages.length > 0
            ? messages[messages.length - 1].timestamp
            : undefined,
          messages,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCostUSD: 0,
          status: 'complete',
        };

        sessions.push(session);
      } catch {
        // Skip malformed conversations silently
      }
    }

    return sessions;
  }

  /**
   * Parses ReflectDev's own export format.
   * Applies content truncation to ensure compliance with storage limits.
   */
  private static parseReflectDevExport(data: ReflectDevExport): ChatSession[] {
    return data.sessions.map((session: ChatSession): ChatSession => ({
      ...session,
      startedAt: new Date(session.startedAt),
      endedAt: session.endedAt ? new Date(session.endedAt) : undefined,
      messages: session.messages.map(
        (msg: ChatMessage): ChatMessage => {
          const truncated = msg.content.length > MAX_CONTENT_LENGTH;
          return {
            ...msg,
            content: msg.content.slice(0, MAX_CONTENT_LENGTH),
            timestamp: new Date(msg.timestamp),
            truncated: truncated || msg.truncated,
          };
        }
      ),
    }));
  }
}
