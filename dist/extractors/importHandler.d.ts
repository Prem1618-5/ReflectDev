/**
 * @module importHandler
 * @description Handles importing chat history from Claude.ai, OpenAI/ChatGPT,
 * and ReflectDev's own JSON format. Parses files selected via VS Code file picker,
 * normalizes messages, truncates content to 10,000 chars, and stores sessions.
 */
import { SessionStore } from '../store/sessionStore';
import { Logger } from '../utils/logger';
/**
 * Static import handler for chat history files.
 * Supports Claude.ai, OpenAI/ChatGPT, and ReflectDev JSON formats.
 */
export declare class ImportHandler {
    /**
     * Opens a VS Code file picker for .json files, detects the export format,
     * parses conversations, and stores them in the session store.
     * @param store - The session store to save parsed sessions into.
     * @param logger - Logger instance for output channel logging.
     */
    static importFromFile(store: SessionStore, logger: Logger): Promise<void>;
    /**
     * Detects the format of parsed JSON data and delegates to the appropriate parser.
     * @param data - The parsed JSON data of unknown format.
     * @param logger - Logger for format detection logging.
     * @returns Array of parsed ChatSession objects.
     */
    private static detectAndParse;
    /** Type guard for Claude.ai export format. */
    private static isClaudeExport;
    /** Type guard for OpenAI/ChatGPT export format. */
    private static isOpenAIExport;
    /** Type guard for ReflectDev own export format. */
    private static isReflectDevExport;
    /**
     * Parses Claude.ai export format into ChatSession array.
     * Maps sender 'human' → role 'user', sender 'assistant' → role 'assistant'.
     */
    private static parseClaudeExport;
    /**
     * Parses OpenAI/ChatGPT export format into ChatSession array.
     * Filters out system messages and null messages, sorts by create_time.
     */
    private static parseOpenAIExport;
    /**
     * Parses ReflectDev's own export format.
     * Applies content truncation to ensure compliance with storage limits.
     */
    private static parseReflectDevExport;
}
