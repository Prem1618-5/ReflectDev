/**
 * @module extension
 * @description Entry point for the ReflectDev VS Code extension.
 * Registers commands, creates the sidebar TreeView, initializes the session store,
 * and optionally starts the CLI extractor. Status bar shows immediately for fast
 * activation; all heavy work is deferred via setImmediate.
 */

import * as vscode from 'vscode';
import { SessionStore } from './store/sessionStore';
import { ImportHandler } from './extractors/importHandler';
import { SidebarProvider } from './views/sidebarProvider';
import { DashboardPanel } from './views/dashboardPanel';
import { CLIExtractor } from './extractors/cliExtractor';
import { Logger } from './utils/logger';
import { exportReportCard } from './utils/reportExporter';
import { scoreKnowledge } from './evaluators/knowledgeScorer';
import { analyzePromptQuality } from './evaluators/promptAnalyzer';
import { computeSessionTokens } from './evaluators/tokenCounter';
import { generateRecommendations } from './evaluators/recommendationEngine';
import { SessionScore } from './models/score';
import { ChatSession } from './models/session';

/**
 * Computes a full SessionScore for a given ChatSession.
 * @param session - The chat session to score.
 * @returns Complete SessionScore with knowledge, prompt, token, and recommendation data.
 */
function computeFullScore(session: ChatSession): SessionScore {
  const knowledge = scoreKnowledge(session);
  const promptQuality = analyzePromptQuality(session);
  const tokenInfo = computeSessionTokens(session);

  const tokenEfficiency = {
    totalTokens: tokenInfo.input + tokenInfo.output,
    wastedTokens: Math.round((tokenInfo.input + tokenInfo.output) * 0.15),
    efficiencyPercent: 0,
    estimatedCostUSD: tokenInfo.costUSD,
  };
  tokenEfficiency.efficiencyPercent =
    tokenEfficiency.totalTokens > 0
      ? Math.round(
          ((tokenEfficiency.totalTokens - tokenEfficiency.wastedTokens) /
            tokenEfficiency.totalTokens) *
            100
        )
      : 100;

  const score: SessionScore = {
    sessionId: session.id,
    computedAt: new Date(),
    knowledge,
    promptQuality,
    tokenEfficiency,
    byTechnology: knowledge.byTechnology,
    recommendations: [],
  };

  score.recommendations = generateRecommendations(score);
  return score;
}

/**
 * Activates the ReflectDev extension.
 * Shows status bar immediately, then defers heavy initialization.
 * @param context - The VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
  const logger = new Logger('ReflectDev');
  logger.info('Activating ReflectDev...');

  // ─── Status Bar (show immediately for fast activation) ──────────────
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.text = '$(eye) ReflectDev';
  statusBar.tooltip = 'ReflectDev is loading...';
  statusBar.command = 'reflectdev.openDashboard';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // ─── Defer heavy work to avoid blocking VS Code startup ─────────────
  void Promise.resolve().then(async () => {

    try {
      const store = new SessionStore(context);
      const sidebarProvider = new SidebarProvider(store);

      // Register sidebar TreeView
      const treeView = vscode.window.createTreeView('reflectdev-sidebar', {
        treeDataProvider: sidebarProvider,
        showCollapseAll: true,
      });
      context.subscriptions.push(treeView);

      // ─── Register Commands ──────────────────────────────────────────

      // Open Dashboard
      context.subscriptions.push(
        vscode.commands.registerCommand('reflectdev.openDashboard', () => {
          try {
            DashboardPanel.createOrShow(context, store);
          } catch (err) {
            logger.error('Failed to open dashboard', err as Error);
          }
        })
      );

      // Import Chat History
      context.subscriptions.push(
        vscode.commands.registerCommand('reflectdev.importChat', async () => {
          try {
            await ImportHandler.importFromFile(store, logger);

            // Score all unscored sessions after import
            const sessions = await store.getSessions();
            for (const session of sessions) {
              if (!session.score) {
                const score = computeFullScore(session);
                await store.updateSession(session.id, { score });
              }
            }

            sidebarProvider.refresh();
            logger.info('Import and scoring complete');
          } catch (err) {
            logger.error('Import failed', err as Error);
          }
        })
      );

      // Export Report Card
      context.subscriptions.push(
        vscode.commands.registerCommand('reflectdev.exportReport', async () => {
          try {
            const sessions = await store.getSessions();
            await exportReportCard(sessions, store);
          } catch (err) {
            logger.error('Export failed', err as Error);
          }
        })
      );

      // Clear All Data
      context.subscriptions.push(
        vscode.commands.registerCommand('reflectdev.clearData', async () => {
          try {
            const confirm = await vscode.window.showWarningMessage(
              'ReflectDev: Delete all stored data? This cannot be undone.',
              'Delete',
              'Cancel'
            );
            if (confirm === 'Delete') {
              await store.clearAll();
              sidebarProvider.refresh();
              void vscode.window.showInformationMessage(
                'ReflectDev: All data has been cleared.'
              );
              logger.info('All data cleared by user');
            }
          } catch (err) {
            logger.error('Clear data failed', err as Error);
          }
        })
      );

      // ─── CLI Extractor (optional) ──────────────────────────────────

      const config = vscode.workspace.getConfiguration('reflectdev');
      const claudeCLIEnabled = config.get<boolean>('sources.claudeCLI', true);

      if (claudeCLIEnabled) {
        try {
          const cliExtractor = new CLIExtractor(store, logger);
          context.subscriptions.push(cliExtractor);
          logger.info('Claude CLI extractor started');
        } catch (err) {
          logger.warn(`CLI extractor skipped: ${(err as Error).message}`);
        }
      }

      // ─── Activation Complete ───────────────────────────────────────

      statusBar.text = '$(eye) ReflectDev 🟢';
      statusBar.tooltip = 'ReflectDev is active. Click to open dashboard.';
      logger.info('ReflectDev activated successfully.');
    } catch (err) {
      statusBar.text = '$(eye) ReflectDev ⚠️';
      statusBar.tooltip = 'ReflectDev encountered an error during activation.';
      logger.error('Activation failed', err as Error);
    }
  });
}

/**
 * Deactivates the ReflectDev extension.
 * Cleanup is handled automatically by context.subscriptions.
 */
export function deactivate(): void {
  // All disposables registered via context.subscriptions are
  // automatically cleaned up by VS Code on deactivation.
}
