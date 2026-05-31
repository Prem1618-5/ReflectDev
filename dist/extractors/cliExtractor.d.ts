/**
 * @module cliExtractor
 * @description Extracts chat sessions from Claude CLI's JSONL files.
 * Watches ~/.claude/projects/ (or %APPDATA%\Claude\projects\ on Windows)
 * for new and changed .jsonl files, parses them, and stores as ChatSessions.
 */
import * as vscode from 'vscode';
import { SessionStore } from '../store/sessionStore';
import { Logger } from '../utils/logger';
/**
 * Extracts and watches Claude CLI session files.
 * Parses JSONL format files from the Claude CLI projects directory
 * and stores them as ChatSessions via the SessionStore.
 */
export declare class CLIExtractor implements vscode.Disposable {
    private readonly disposables;
    private readonly lastModifiedMap;
    private readonly store;
    private readonly logger;
    /**
     * Creates a new CLIExtractor instance and begins watching if the directory exists.
     * @param store - Session store for persisting parsed sessions.
     * @param logger - Logger instance for output channel logging.
     */
    constructor(store: SessionStore, logger: Logger);
    /**
     * Gets the Claude CLI projects directory path based on the OS.
     * @returns The path to the Claude projects directory, or null if not determinable.
     */
    private static getClaudeProjectsDir;
    /**
     * Sets up the VS Code file system watcher on the Claude projects directory.
     * @param claudeDir - The absolute path to the Claude projects directory.
     */
    private setupWatcher;
    /**
     * Scans existing JSONL files in the Claude projects directory on startup.
     * @param claudeDir - The absolute path to the Claude projects directory.
     */
    private scanExistingFiles;
    /**
     * Recursively finds all .jsonl files in a directory.
     * @param dir - Directory to search.
     * @returns Array of absolute file paths.
     */
    private findJsonlFiles;
    /**
     * Handles a file create or change event.
     * Skips files that haven't changed since last parse.
     * @param uri - The URI of the changed file.
     */
    private handleFileChange;
    /**
     * Reads a file with exponential backoff retry for file lock scenarios.
     * @param filePath - Path to the file to read.
     * @returns The file content as a string, or null if all retries fail.
     */
    private readFileWithRetry;
    /**
     * Parses JSONL content into a ChatSession.
     * Each line is a JSON object; malformed lines are silently skipped.
     * @param content - Raw JSONL file content.
     * @param filePath - File path used for session ID generation.
     * @returns Parsed ChatSession or null if no valid entries found.
     */
    private parseJsonlContent;
    /**
     * Promise-based sleep utility for retry delays.
     * @param ms - Milliseconds to wait.
     */
    private sleep;
    /**
     * Disposes of all watchers and resources.
     */
    dispose(): void;
}
