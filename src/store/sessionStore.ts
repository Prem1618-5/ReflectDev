import * as vscode from 'vscode';
import { ChatSession } from '../models/session';

const SESSIONS_KEY = 'reflectdev.sessions';
const MAX_SESSIONS = 500;

/** Manages chat session persistence using VS Code's globalState. */
export class SessionStore {
  constructor(private context: vscode.ExtensionContext) {}

  /** Retrieve all stored sessions, newest first. */
  async getSessions(): Promise<ChatSession[]> {
    try {
      return this.context.globalState.get<ChatSession[]>(SESSIONS_KEY, []);
    } catch (err) {
      console.error('SessionStore.getSessions failed:', err);
      return [];
    }
  }

  /** Add a session. Skips duplicates by id. Prepends (newest first). Trims to MAX_SESSIONS. */
  async addSession(session: ChatSession): Promise<void> {
    try {
      const sessions = await this.getSessions();
      if (sessions.find(s => s.id === session.id)) {
        return;
      }
      sessions.unshift(session);
      const trimmed = sessions.slice(0, MAX_SESSIONS);
      await this.context.globalState.update(SESSIONS_KEY, trimmed);
    } catch (err) {
      console.error('SessionStore.addSession failed:', err);
    }
  }

  /** Find a session by its id. */
  async getSession(id: string): Promise<ChatSession | undefined> {
    try {
      const sessions = await this.getSessions();
      return sessions.find(s => s.id === id);
    } catch (err) {
      console.error('SessionStore.getSession failed:', err);
      return undefined;
    }
  }

  /** Update a session's fields by merging partial updates. */
  async updateSession(id: string, updates: Partial<ChatSession>): Promise<void> {
    try {
      const sessions = await this.getSessions();
      const index = sessions.findIndex(s => s.id === id);
      if (index === -1) {
        return;
      }
      sessions[index] = { ...sessions[index], ...updates };
      await this.context.globalState.update(SESSIONS_KEY, sessions);
    } catch (err) {
      console.error('SessionStore.updateSession failed:', err);
    }
  }

  /** Get sessions within a date range. */
  async getSessionsInRange(start: Date, end: Date): Promise<ChatSession[]> {
    try {
      const sessions = await this.getSessions();
      return sessions.filter(s => {
        const started = new Date(s.startedAt);
        return started >= start && started <= end;
      });
    } catch (err) {
      console.error('SessionStore.getSessionsInRange failed:', err);
      return [];
    }
  }

  /** Delete all stored sessions. */
  async clearAll(): Promise<void> {
    try {
      await this.context.globalState.update(SESSIONS_KEY, []);
    } catch (err) {
      console.error('SessionStore.clearAll failed:', err);
    }
  }
}
