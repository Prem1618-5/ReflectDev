/**
 * @module dashboardPanel
 * @description Controller for the ReflectDev Dashboard WebView panel.
 * Manages a singleton panel, loads the HTML template, handles
 * message passing with the webview, and auto-refreshes every 30 seconds.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChatSession } from '../models/session';
import { SessionScore, TechScore } from '../models/score';
import { Recommendation } from '../models/recommendation';
import { SessionStore } from '../store/sessionStore';
import { scoreKnowledge } from '../evaluators/knowledgeScorer';
import { analyzePromptQuality } from '../evaluators/promptAnalyzer';
import { computeSessionTokens } from '../evaluators/tokenCounter';
import { generateRecommendations } from '../evaluators/recommendationEngine';

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
export class DashboardPanel {
  /** The single instance of DashboardPanel. */
  private static currentPanel: DashboardPanel | undefined;

  /** The VS Code WebView panel. */
  private readonly panel: vscode.WebviewPanel;

  /** Extension context for resource paths. */
  private readonly extensionContext: vscode.ExtensionContext;

  /** Session store for reading data. */
  private readonly store: SessionStore;

  /** Auto-refresh interval handle. */
  private refreshInterval: ReturnType<typeof setInterval> | undefined;

  /** Disposables to clean up. */
  private readonly disposables: vscode.Disposable[] = [];

  /** Guard to prevent re-entrant disposal. */
  private isDisposing = false;


  /**
   * Creates or shows the ReflectDev Dashboard panel.
   * @param context - The VS Code extension context.
   * @param store - The session store to read data from.
   */
  static createOrShow(
    context: vscode.ExtensionContext,
    store: SessionStore
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    // If panel already exists, reveal it
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      'reflectdevDashboard',
      'ReflectDev Dashboard',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'src', 'views', 'webview'),
          vscode.Uri.joinPath(context.extensionUri, 'dist', 'views', 'webview'),
        ],
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, context, store);
  }

  /**
   * Private constructor — use createOrShow instead.
   */
  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    store: SessionStore
  ) {
    this.panel = panel;
    this.extensionContext = context;
    this.store = store;

    // Set panel content
    this.panel.webview.html = this.getHtmlContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      (message: { type: string }) => {
        this.handleMessage(message);
      },
      undefined,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        this.dispose();
      },
      undefined,
      this.disposables
    );

    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      if (this.panel.visible) {
        void this.sendScoreData();
      }
    }, 30_000);
  }

  /**
   * Handles messages received from the webview.
   */
  private handleMessage(message: { type: string }): void {
    try {
      switch (message.type) {
        case 'requestData':
          void this.sendScoreData();
          break;
        case 'exportReport':
          void vscode.commands.executeCommand('reflectdev.exportReport');
          break;
        case 'refresh':
          void this.sendScoreData();
          break;
      }
    } catch {
      // Silently handle message errors
    }
  }

  /**
   * Computes scores and sends data payload to the webview.
   */
  private async sendScoreData(): Promise<void> {
    try {
      const sessions = await this.store.getSessions();
      const payload = DashboardPanel.buildScorePayload(sessions);
      void this.panel.webview.postMessage({
        type: 'scoreData',
        payload,
      });
    } catch {
      // Silently handle data computation errors
    }
  }

  /**
   * Builds the complete score data payload from sessions.
   * @param sessions - Array of stored chat sessions.
   * @returns The full ScoreDataPayload for the webview.
   */
  static buildScorePayload(sessions: ChatSession[]): ScoreDataPayload {
    if (sessions.length === 0) {
      return DashboardPanel.emptyPayload();
    }

    let totalKnowledge = 0;
    let totalPrompt = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

    const techMap = new Map<string, TechScore>();
    const sessionEntries: ScoreDataPayload['sessions'] = [];
    const timeline: ScoreDataPayload['timeline'] = [];

    for (const session of sessions) {
      const knowledge = scoreKnowledge(session);
      const prompt = analyzePromptQuality(session);
      const tokens = computeSessionTokens(session);

      totalKnowledge += knowledge.overall;
      totalPrompt += prompt.overallScore;
      totalInputTokens += tokens.input;
      totalOutputTokens += tokens.output;
      totalCost += tokens.costUSD;

      // Accumulate technologies
      for (const tech of knowledge.byTechnology) {
        const existing = techMap.get(tech.technology);
        if (existing) {
          existing.mentions += tech.mentions;
          existing.score = Math.round((existing.score + tech.score) / 2);
        } else {
          techMap.set(tech.technology, { ...tech });
        }
      }

      // Session entry
      const startedAt = new Date(session.startedAt);
      sessionEntries.push({
        id: session.id,
        date: startedAt.toLocaleDateString(),
        source: session.source,
        messages: session.messages.length,
        score: knowledge.overall,
        tokens: tokens.input + tokens.output,
        cost: tokens.costUSD,
        technologies: knowledge.byTechnology.map((t: TechScore) => t.technology),
      });

      // Timeline entry
      timeline.push({
        date: startedAt.toLocaleDateString(),
        score: knowledge.overall,
      });
    }

    const count = sessions.length;
    const avgKnowledge = Math.round(totalKnowledge / count);
    const avgPrompt = Math.round(totalPrompt / count);
    const totalTokens = totalInputTokens + totalOutputTokens;
    const wastedTokens = Math.round(totalTokens * 0.15);
    const efficiencyPercent = totalTokens > 0
      ? Math.round(((totalTokens - wastedTokens) / totalTokens) * 100)
      : 100;

    // Compute level from average knowledge score
    const level = DashboardPanel.toLevel(avgKnowledge);

    // Get detailed last-session data for knowledge breakdown
    const lastKnowledge = scoreKnowledge(sessions[0]);
    const lastPrompt = analyzePromptQuality(sessions[0]);

    // Build aggregate score for recommendations
    const aggregateScore: SessionScore = {
      sessionId: 'aggregate',
      computedAt: new Date(),
      knowledge: {
        ...lastKnowledge,
        overall: avgKnowledge,
      },
      promptQuality: {
        ...lastPrompt,
        overallScore: avgPrompt,
      },
      tokenEfficiency: {
        totalTokens,
        wastedTokens,
        efficiencyPercent,
        estimatedCostUSD: totalCost,
      },
      byTechnology: Array.from(techMap.values()),
      recommendations: [],
    };

    const recs = generateRecommendations(aggregateScore);

    return {
      overallScore: avgKnowledge,
      level,
      knowledge: {
        overall: avgKnowledge,
        conceptualDepth: lastKnowledge.conceptualDepth,
        problemSolving: lastKnowledge.problemSolving,
        independenceIndex: lastKnowledge.independenceIndex,
        domainKnowledge: lastKnowledge.domainKnowledge,
      },
      promptQuality: {
        overallScore: avgPrompt,
        clarity: lastPrompt.clarity,
        specificity: lastPrompt.specificity,
        contextEfficiency: lastPrompt.contextEfficiency,
        followUpQuality: lastPrompt.followUpQuality,
        avgTurnsPerTask: lastPrompt.avgTurnsPerTask,
        retryRate: lastPrompt.retryRate,
      },
      tokenEfficiency: {
        totalTokens,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        wastedTokens,
        efficiencyPercent,
        estimatedCostUSD: totalCost,
      },
      technologies: Array.from(techMap.values()).map((tech: TechScore) => ({
        technology: tech.technology,
        score: tech.score,
        level: tech.level,
        mentions: tech.mentions,
      })),
      recommendations: recs.slice(0, 5).map((rec: Recommendation) => ({
        rank: rec.rank,
        title: rec.title,
        description: rec.description,
        category: rec.category,
        effort: rec.effort,
      })),
      sessions: sessionEntries.slice(0, 20),
      timeline: timeline.reverse().slice(0, 30),
      totalSessions: count,
    };
  }

  /**
   * Returns an empty payload when no sessions exist.
   */
  private static emptyPayload(): ScoreDataPayload {
    return {
      overallScore: 0,
      level: 'novice',
      knowledge: {
        overall: 0,
        conceptualDepth: 0,
        problemSolving: 0,
        independenceIndex: 60,
        domainKnowledge: 0,
      },
      promptQuality: {
        overallScore: 0,
        clarity: 0,
        specificity: 0,
        contextEfficiency: 0,
        followUpQuality: 0,
        avgTurnsPerTask: 0,
        retryRate: 0,
      },
      tokenEfficiency: {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        wastedTokens: 0,
        efficiencyPercent: 0,
        estimatedCostUSD: 0,
      },
      technologies: [],
      recommendations: [],
      sessions: [],
      timeline: [],
      totalSessions: 0,
    };
  }

  /**
   * Converts a numeric score to a knowledge level string.
   */
  private static toLevel(score: number): string {
    if (score >= 86) return 'expert';
    if (score >= 71) return 'proficient';
    if (score >= 51) return 'intermediate';
    if (score >= 31) return 'beginner';
    return 'novice';
  }

  /**
   * Generates the HTML content for the webview panel.
   * Loads dashboard.html, injects CSS/JS URIs, CSP nonce, and CSS variables.
   */
  private getHtmlContent(): string {
    const webview = this.panel.webview;
    const nonce = DashboardPanel.generateNonce();

    // Try to load from src first, then dist
    const webviewDir = this.findWebviewDir();

    const cssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(webviewDir, 'dashboard.css'))
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(webviewDir, 'dashboard.js'))
    );

    // Try to read the HTML template
    const htmlPath = path.join(webviewDir, 'dashboard.html');

    let htmlContent: string;
    try {
      htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    } catch {
      // Return inline fallback HTML
      return this.getFallbackHtml(nonce, cssUri.toString(), jsUri.toString());
    }

    // Inject nonce, CSS URI, and JS URI into the template
    htmlContent = htmlContent
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{cssUri\}\}/g, cssUri.toString())
      .replace(/\{\{jsUri\}\}/g, jsUri.toString())
      .replace(
        /\{\{cspSource\}\}/g,
        webview.cspSource
      );

    return htmlContent;
  }

  /**
   * Finds the webview directory (tries src/views/webview then dist/views/webview).
   */
  private findWebviewDir(): string {
    const srcDir = path.join(
      this.extensionContext.extensionUri.fsPath,
      'src',
      'views',
      'webview'
    );

    if (fs.existsSync(srcDir)) {
      return srcDir;
    }

    return path.join(
      this.extensionContext.extensionUri.fsPath,
      'dist',
      'views',
      'webview'
    );
  }

  /**
   * Returns fallback HTML when the template file can't be loaded.
   */
  private getFallbackHtml(
    nonce: string,
    cssUri: string,
    jsUri: string
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com; font-src ${this.panel.webview.cspSource}; img-src ${this.panel.webview.cspSource} data:;">
  <title>ReflectDev Dashboard</title>
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <div style="text-align: center; padding: 60px;">
    <h1>ReflectDev Dashboard</h1>
    <p>Loading dashboard...</p>
    <p>If this persists, check that webview files exist in src/views/webview/</p>
  </div>
  <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }

  /**
   * Generates a random nonce string for Content Security Policy.
   */
  private static generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  /**
   * Cleans up resources when the panel is disposed.
   */
  private dispose(): void {
    if (this.isDisposing) {
      return;
    }
    this.isDisposing = true;

    DashboardPanel.currentPanel = undefined;

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
    this.panel.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}

