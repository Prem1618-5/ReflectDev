/**
 * @module cliExtractor
 * @description Extracts chat sessions from Claude CLI's JSONL files.
 * Watches ~/.claude/projects/ (or %APPDATA%\Claude\projects\ on Windows)
 * for new and changed .jsonl files, parses them, and stores as ChatSessions.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession, ChatMessage, Source } from '../models/session';
import { SessionStore } from '../store/sessionStore';
import { Logger } from '../utils/logger';

/** Maximum content length per message. */
const MAX_CONTENT_LENGTH = 10_000;

/** Maximum retry attempts for file locks. */
const MAX_RETRIES = 3;

/** Initial retry delay in milliseconds. */
const INITIAL_RETRY_DELAY_MS = 500;

/** JSONL line format from Claude CLI. */
interface CLILogEntry {
  type: 'user' | 'assistant';
  message: {
    role: string;
    content: string;
  };
  ts: number;
}

/**
 * Extracts and watches Claude CLI session files.
 * Parses JSONL format files from the Claude CLI projects directory
 * and stores them as ChatSessions via the SessionStore.
 */
export class CLIExtractor implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly lastModifiedMap: Map<string, number> = new Map();
  private readonly store: SessionStore;
  private readonly logger: Logger;

  /**
   * Creates a new CLIExtractor instance and begins watching if the directory exists.
   * @param store - Session store for persisting parsed sessions.
   * @param logger - Logger instance for output channel logging.
   */
  constructor(store: SessionStore, logger: Logger) {
    this.store = store;
    this.logger = logger;

    try {
      const claudeDir = CLIExtractor.getClaudeProjectsDir();
      if (!claudeDir) {
        this.logger.info('CLI Extractor: Claude projects directory not found, skipping');
        return;
      }

      if (!fs.existsSync(claudeDir)) {
        this.logger.info(`CLI Extractor: ${claudeDir} does not exist, skipping watcher setup`);
        return;
      }

      this.setupWatcher(claudeDir);
      this.logger.info(`CLI Extractor: watching ${claudeDir}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('CLI Extractor: failed to initialize', error);
    }
  }

  /**
   * Gets the Claude CLI projects directory path based on the OS.
   * @returns The path to the Claude projects directory, or null if not determinable.
   */
  private static getClaudeProjectsDir(): string | null {
    const platform = os.platform();

    if (platform === 'win32') {
      const appData = process.env['APPDATA'];
      if (!appData) {
        return null;
      }
      return path.join(appData, 'Claude', 'projects');
    }

    // macOS and Linux
    const homeDir = os.homedir();
    return path.join(homeDir, '.claude', 'projects');
  }

  /**
   * Sets up the VS Code file system watcher on the Claude projects directory.
   * @param claudeDir - The absolute path to the Claude projects directory.
   */
  private setupWatcher(claudeDir: string): void {
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(claudeDir),
      '**/*.jsonl'
    );

    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidCreate((uri: vscode.Uri) => {
      void this.handleFileChange(uri);
    });

    watcher.onDidChange((uri: vscode.Uri) => {
      void this.handleFileChange(uri);
    });

    this.disposables.push(watcher);

    // Also scan existing files on startup
    void this.scanExistingFiles(claudeDir);
  }

  /**
   * Scans existing JSONL files in the Claude projects directory on startup.
   * @param claudeDir - The absolute path to the Claude projects directory.
   */
  private async scanExistingFiles(claudeDir: string): Promise<void> {
    try {
      const files = this.findJsonlFiles(claudeDir);
      this.logger.info(`CLI Extractor: found ${files.length} existing JSONL files`);

      for (const filePath of files) {
        const uri = vscode.Uri.file(filePath);
        await this.handleFileChange(uri);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('CLI Extractor: failed to scan existing files', error);
    }
  }

  /**
   * Recursively finds all .jsonl files in a directory.
   * @param dir - Directory to search.
   * @returns Array of absolute file paths.
   */
  private findJsonlFiles(dir: string): string[] {
    const results: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.findJsonlFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          results.push(fullPath);
        }
      }
    } catch {
      // Silently skip directories we can't read
    }

    return results;
  }

  /**
   * Handles a file create or change event.
   * Skips files that haven't changed since last parse.
   * @param uri - The URI of the changed file.
   */
  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    const filePath = uri.fsPath;

    try {
      const stat = fs.statSync(filePath);
      const lastModified = stat.mtimeMs;
      const previousModified = this.lastModifiedMap.get(filePath);

      if (previousModified !== undefined && previousModified >= lastModified) {
        return; // File hasn't changed since last parse
      }

      const content = await this.readFileWithRetry(filePath);
      if (!content) {
        return;
      }

      const session = this.parseJsonlContent(content, filePath);
      if (session && session.messages.length > 0) {
        await this.store.addSession(session);
        this.lastModifiedMap.set(filePath, lastModified);
        this.logger.info(
          `CLI Extractor: parsed session from ${path.basename(filePath)} ` +
          `(${session.messages.length} messages)`
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`CLI Extractor: error processing ${filePath}`, error);
    }
  }

  /**
   * Reads a file with exponential backoff retry for file lock scenarios.
   * @param filePath - Path to the file to read.
   * @returns The file content as a string, or null if all retries fail.
   */
  private async readFileWithRetry(filePath: string): Promise<string | null> {
    let delay = INITIAL_RETRY_DELAY_MS;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const isLockError =
          error.message.includes('EBUSY') ||
          error.message.includes('EACCES') ||
          error.message.includes('EPERM');

        if (!isLockError || attempt === MAX_RETRIES - 1) {
          this.logger.warn(
            `CLI Extractor: failed to read ${path.basename(filePath)} after ${attempt + 1} attempts`
          );
          return null;
        }

        this.logger.info(
          `CLI Extractor: file locked, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await this.sleep(delay);
        delay *= 2; // Exponential backoff
      }
    }

    return null;
  }

  /**
   * Parses JSONL content into a ChatSession.
   * Each line is a JSON object; malformed lines are silently skipped.
   * @param content - Raw JSONL file content.
   * @param filePath - File path used for session ID generation.
   * @returns Parsed ChatSession or null if no valid entries found.
   */
  private parseJsonlContent(content: string, filePath: string): ChatSession | null {
    const lines = content.split('\n').filter((line: string) => line.trim().length > 0);
    const messages: ChatMessage[] = [];
    const sessionId = path.basename(filePath, '.jsonl');

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as CLILogEntry;

        if (!entry.type || !entry.message || !entry.ts) {
          continue;
        }

        const role: 'user' | 'assistant' =
          entry.type === 'user' ? 'user' : 'assistant';

        const rawContent = typeof entry.message.content === 'string'
          ? entry.message.content
          : JSON.stringify(entry.message.content);

        const truncated = rawContent.length > MAX_CONTENT_LENGTH;

        const message: ChatMessage = {
          id: uuidv4(),
          sessionId,
          role,
          content: rawContent.slice(0, MAX_CONTENT_LENGTH),
          timestamp: new Date(entry.ts * 1000),
          tokenCount: 0,
          estimatedCostUSD: 0,
          source: 'claude-cli' as Source,
          truncated,
        };

        messages.push(message);
      } catch {
        // Skip malformed lines silently
      }
    }

    if (messages.length === 0) {
      return null;
    }

    // Sort messages by timestamp
    messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const session: ChatSession = {
      id: sessionId,
      source: 'claude-cli' as Source,
      startedAt: messages[0].timestamp,
      endedAt: messages[messages.length - 1].timestamp,
      messages,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      status: 'complete',
    };

    return session;
  }

  /**
   * Promise-based sleep utility for retry delays.
   * @param ms - Milliseconds to wait.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Disposes of all watchers and resources.
   */
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
    this.lastModifiedMap.clear();
    this.logger.info('CLI Extractor: disposed');
  }
}
