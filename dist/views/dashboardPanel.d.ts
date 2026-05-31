/**
 * @module dashboardPanel
 * @description Controller for the ReflectDev Dashboard WebView panel.
 * Manages a singleton panel, loads the HTML template, handles
 * message passing with the webview, and auto-refreshes every 30 seconds.
 */
import * as vscode from 'vscode';
import { ChatSession } from '../models/session';
import { SessionStore } from '../store/sessionStore';
/** Data payload sent to the webview for rendering. */
interface ScoreDataPayload {
    overallScore: number;
    level: string;
    knowledge: {
        overall: number;
        conceptualDepth: number;
        problemSolving: number;
        independenceIndex: number;
        domainKnowledge: number;
    };
    promptQuality: {
        overallScore: number;
        clarity: number;
        specificity: number;
        contextEfficiency: number;
        followUpQuality: number;
        avgTurnsPerTask: number;
        retryRate: number;
    };
    tokenEfficiency: {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        wastedTokens: number;
        efficiencyPercent: number;
        estimatedCostUSD: number;
    };
    technologies: Array<{
        technology: string;
        score: number;
        level: string;
        mentions: number;
    }>;
    recommendations: Array<{
        rank: number;
        title: string;
        description: string;
        category: string;
        effort: string;
    }>;
    sessions: Array<{
        id: string;
        date: string;
        source: string;
        messages: number;
        score: number;
        tokens: number;
        cost: number;
        technologies: string[];
    }>;
    timeline: Array<{
        date: string;
        score: number;
    }>;
    totalSessions: number;
}
/**
 * Manages the ReflectDev Dashboard WebView panel.
 * Uses singleton pattern — only one dashboard panel exists at a time.
 */
export declare class DashboardPanel {
    /** The single instance of DashboardPanel. */
    private static currentPanel;
    /** The VS Code WebView panel. */
    private readonly panel;
    /** Extension context for resource paths. */
    private readonly extensionContext;
    /** Session store for reading data. */
    private readonly store;
    /** Auto-refresh interval handle. */
    private refreshInterval;
    /** Disposables to clean up. */
    private readonly disposables;
    /** Guard to prevent re-entrant disposal. */
    private isDisposing;
    /**
     * Creates or shows the ReflectDev Dashboard panel.
     * @param context - The VS Code extension context.
     * @param store - The session store to read data from.
     */
    static createOrShow(context: vscode.ExtensionContext, store: SessionStore): void;
    /**
     * Private constructor — use createOrShow instead.
     */
    private constructor();
    /**
     * Handles messages received from the webview.
     */
    private handleMessage;
    /**
     * Computes scores and sends data payload to the webview.
     */
    private sendScoreData;
    /**
     * Builds the complete score data payload from sessions.
     * @param sessions - Array of stored chat sessions.
     * @returns The full ScoreDataPayload for the webview.
     */
    static buildScorePayload(sessions: ChatSession[]): ScoreDataPayload;
    /**
     * Returns an empty payload when no sessions exist.
     */
    private static emptyPayload;
    /**
     * Converts a numeric score to a knowledge level string.
     */
    private static toLevel;
    /**
     * Generates the HTML content for the webview panel.
     * Loads dashboard.html, injects CSS/JS URIs, CSP nonce, and CSS variables.
     */
    private getHtmlContent;
    /**
     * Finds the webview directory (tries src/views/webview then dist/views/webview).
     */
    private findWebviewDir;
    /**
     * Returns fallback HTML when the template file can't be loaded.
     */
    private getFallbackHtml;
    /**
     * Generates a random nonce string for Content Security Policy.
     */
    private static generateNonce;
    /**
     * Cleans up resources when the panel is disposed.
     */
    private dispose;
}
export {};
