import * as vscode from 'vscode';
import { ChatSession } from '../models/session';
/** Manages chat session persistence using VS Code's globalState. */
export declare class SessionStore {
    private context;
    constructor(context: vscode.ExtensionContext);
    /** Retrieve all stored sessions, newest first. */
    getSessions(): Promise<ChatSession[]>;
    /** Add a session. Skips duplicates by id. Prepends (newest first). Trims to MAX_SESSIONS. */
    addSession(session: ChatSession): Promise<void>;
    /** Find a session by its id. */
    getSession(id: string): Promise<ChatSession | undefined>;
    /** Update a session's fields by merging partial updates. */
    updateSession(id: string, updates: Partial<ChatSession>): Promise<void>;
    /** Get sessions within a date range. */
    getSessionsInRange(start: Date, end: Date): Promise<ChatSession[]>;
    /** Delete all stored sessions. */
    clearAll(): Promise<void>;
}
