/**
 * @module sidebarProvider
 * @description Provides a TreeView for the ReflectDev sidebar, showing
 * live scores, last session info, recommendations, and recent sessions.
 * Implements vscode.TreeDataProvider for the reflectdev-sidebar view.
 */

import * as vscode from 'vscode';
import { ChatSession } from '../models/session';
import { SessionScore, KnowledgeLevel, TechScore } from '../models/score';
import { Recommendation } from '../models/recommendation';
import { SessionStore } from '../store/sessionStore';
import { scoreKnowledge } from '../evaluators/knowledgeScorer';
import { analyzePromptQuality } from '../evaluators/promptAnalyzer';
import { computeSessionTokens } from '../evaluators/tokenCounter';
import { generateRecommendations } from '../evaluators/recommendationEngine';

/**
 * A tree item for the ReflectDev sidebar.
 * Extends vscode.TreeItem with optional children for building the tree hierarchy.
 */
export class ReflectDevItem extends vscode.TreeItem {
  /** Child items for tree expansion. */
  children?: ReflectDevItem[];

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    children?: ReflectDevItem[]
  ) {
    super(label, collapsibleState);
    this.children = children;
  }
}

/**
 * Maps knowledge levels to emoji + label display strings.
 */
function levelBadge(level: KnowledgeLevel): string {
  const badges: Record<KnowledgeLevel, string> = {
    novice: '🔴 Novice',
    beginner: '🟠 Beginner',
    intermediate: '🟡 Intermediate',
    proficient: '🟢 Proficient',
    expert: '🏆 Expert',
  };
  return badges[level];
}

/**
 * Formats a date to a short human-readable string.
 */
function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Computes a SessionScore for a given ChatSession by running all evaluators.
 */
function computeScoreForSession(session: ChatSession): SessionScore {
  const knowledge = scoreKnowledge(session);
  const promptQuality = analyzePromptQuality(session);
  const tokenInfo = computeSessionTokens(session);

  const tokenEfficiency = {
    totalTokens: tokenInfo.input + tokenInfo.output,
    wastedTokens: Math.round((tokenInfo.input + tokenInfo.output) * 0.15),
    efficiencyPercent: 0,
    estimatedCostUSD: tokenInfo.costUSD,
  };
  tokenEfficiency.efficiencyPercent = tokenEfficiency.totalTokens > 0
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
 * Computes an aggregate SessionScore from multiple sessions.
 */
function computeAggregateScore(sessions: ChatSession[]): SessionScore | null {
  if (sessions.length === 0) {
    return null;
  }

  let totalKnowledgeOverall = 0;
  let totalPromptOverall = 0;
  let totalTokens = 0;
  let totalWasted = 0;
  let totalCost = 0;
  const techMap = new Map<string, TechScore>();

  for (const session of sessions) {
    const score = computeScoreForSession(session);

    totalKnowledgeOverall += score.knowledge.overall;
    totalPromptOverall += score.promptQuality.overallScore;
    totalTokens += score.tokenEfficiency.totalTokens;
    totalWasted += score.tokenEfficiency.wastedTokens;
    totalCost += score.tokenEfficiency.estimatedCostUSD;

    for (const tech of score.byTechnology) {
      const existing = techMap.get(tech.technology);
      if (existing) {
        existing.mentions += tech.mentions;
        existing.score = Math.round((existing.score + tech.score) / 2);
      } else {
        techMap.set(tech.technology, { ...tech });
      }
    }
  }

  const count = sessions.length;
  const lastSessionScore = computeScoreForSession(sessions[0]);

  const aggregateScore: SessionScore = {
    sessionId: 'aggregate',
    computedAt: new Date(),
    knowledge: {
      ...lastSessionScore.knowledge,
      overall: Math.round(totalKnowledgeOverall / count),
    },
    promptQuality: {
      ...lastSessionScore.promptQuality,
      overallScore: Math.round(totalPromptOverall / count),
    },
    tokenEfficiency: {
      totalTokens,
      wastedTokens: totalWasted,
      efficiencyPercent: totalTokens > 0
        ? Math.round(((totalTokens - totalWasted) / totalTokens) * 100)
        : 100,
      estimatedCostUSD: totalCost,
    },
    byTechnology: Array.from(techMap.values()),
    recommendations: [],
  };

  aggregateScore.recommendations = generateRecommendations(aggregateScore);
  return aggregateScore;
}

/**
 * Provides tree data for the ReflectDev sidebar view.
 * Shows score summary, last session details, recommendations, and recent sessions.
 */
export class SidebarProvider implements vscode.TreeDataProvider<ReflectDevItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();

  /** Event to signal tree data has changed. */
  readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

  private readonly store: SessionStore;

  /**
   * Creates a new SidebarProvider.
   * @param store - SessionStore to read sessions from.
   */
  constructor(store: SessionStore) {
    this.store = store;
  }

  /**
   * Refreshes the tree view by firing the onDidChangeTreeData event.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Returns the tree item representation for a given element.
   * @param element - The ReflectDevItem to get the tree item for.
   * @returns The tree item.
   */
  getTreeItem(element: ReflectDevItem): vscode.TreeItem {
    return element;
  }

  /**
   * Returns the children for a given element, or root items if no element provided.
   * @param element - The parent element, or undefined for root items.
   * @returns Array of child ReflectDevItems.
   */
  async getChildren(element?: ReflectDevItem): Promise<ReflectDevItem[]> {
    if (element) {
      return element.children ?? [];
    }

    try {
      const sessions = await this.store.getSessions();

      if (sessions.length === 0) {
        return this.buildEmptyState();
      }

      return this.buildScoreTree(sessions);
    } catch {
      return this.buildEmptyState();
    }
  }

  /**
   * Builds the "no sessions" empty state with an import action.
   */
  private buildEmptyState(): ReflectDevItem[] {
    const emptyItem = new ReflectDevItem(
      '📥 No sessions yet — click here to import',
      vscode.TreeItemCollapsibleState.None
    );
    emptyItem.command = {
      command: 'reflectdev.importChat',
      title: 'Import Chat History',
    };
    emptyItem.tooltip = 'Click to import your Claude.ai or ChatGPT export file';
    return [emptyItem];
  }

  /**
   * Builds the full score tree with all sections.
   * @param sessions - All stored chat sessions (newest first).
   */
  private buildScoreTree(sessions: ChatSession[]): ReflectDevItem[] {
    const items: ReflectDevItem[] = [];

    const aggregate = computeAggregateScore(sessions);
    if (!aggregate) {
      return this.buildEmptyState();
    }

    // ─── 📊 Today's Score ─────────────────────────────────────────

    const overallScore = aggregate.knowledge.overall;
    const level = levelBadge(aggregate.knowledge.level);

    const scoreChildren: ReflectDevItem[] = [
      this.createLeafItem(
        `Prompt Quality: ${aggregate.promptQuality.overallScore}/100`
      ),
      this.createLeafItem(
        `Token Efficiency: ${aggregate.tokenEfficiency.efficiencyPercent}%`
      ),
      this.createLeafItem(
        `Knowledge Depth: ${aggregate.knowledge.overall}/100`
      ),
    ];

    const scoreItem = new ReflectDevItem(
      `📊 Today's Score: ${overallScore}/100 ${level}`,
      vscode.TreeItemCollapsibleState.Expanded,
      scoreChildren
    );
    items.push(scoreItem);

    // ─── 🕐 Last Session ──────────────────────────────────────────

    const lastSession = sessions[0];
    const lastSessionScore = computeScoreForSession(lastSession);
    const lastDate = formatDate(new Date(lastSession.startedAt));
    const msgCount = lastSession.messages.length;
    const totalTokensLast = lastSessionScore.tokenEfficiency.totalTokens;
    const costLast = lastSessionScore.tokenEfficiency.estimatedCostUSD;

    const lastSessionChildren: ReflectDevItem[] = [
      this.createLeafItem(`Messages: ${msgCount}`),
      this.createLeafItem(`Tokens used: ${totalTokensLast.toLocaleString()}`),
      this.createLeafItem(`Cost: $${costLast.toFixed(4)}`),
    ];

    const lastSessionItem = new ReflectDevItem(
      `🕐 Last Session: ${lastDate}`,
      vscode.TreeItemCollapsibleState.Collapsed,
      lastSessionChildren
    );
    items.push(lastSessionItem);

    // ─── 💡 Top Recommendations ───────────────────────────────────

    const recs = aggregate.recommendations.slice(0, 3);
    const recChildren: ReflectDevItem[] = recs.map(
      (rec: Recommendation): ReflectDevItem => {
        const item = this.createLeafItem(`💡 ${rec.title}`);
        item.tooltip = rec.description;

        if (rec.action?.type === 'send-prompt') {
          item.command = {
            command: 'workbench.action.chat.open',
            title: 'Open Chat',
          };
        }

        return item;
      }
    );

    const recsItem = new ReflectDevItem(
      `💡 Top Recommendations (${recs.length})`,
      vscode.TreeItemCollapsibleState.Collapsed,
      recChildren
    );
    items.push(recsItem);

    // ─── 📋 Recent Sessions ──────────────────────────────────────

    const recentSessions = sessions.slice(0, 5);
    const recentChildren: ReflectDevItem[] = recentSessions.map(
      (session: ChatSession): ReflectDevItem => {
        const sessionScore = computeScoreForSession(session);
        const date = formatDate(new Date(session.startedAt));
        const overall = sessionScore.knowledge.overall;

        return this.createLeafItem(
          `Session ${date} — Score ${overall}/100`
        );
      }
    );

    const recentItem = new ReflectDevItem(
      '📋 Recent Sessions',
      vscode.TreeItemCollapsibleState.Collapsed,
      recentChildren
    );
    items.push(recentItem);

    return items;
  }

  /**
   * Creates a leaf item (no children, not expandable).
   * @param label - The display label for the item.
   */
  private createLeafItem(label: string): ReflectDevItem {
    return new ReflectDevItem(label, vscode.TreeItemCollapsibleState.None);
  }
}
