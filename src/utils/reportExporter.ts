/**
 * @module reportExporter
 * @description Generates and exports formatted report cards (both .txt and .json)
 * summarizing developer competency scores, technology breakdowns, and recommendations.
 */

import * as vscode from 'vscode';
import { ChatSession } from '../models/session';
import { SessionScore, KnowledgeLevel } from '../models/score';
import { Recommendation } from '../models/recommendation';
import { SessionStore } from '../store/sessionStore';
import { scoreKnowledge } from '../evaluators/knowledgeScorer';
import { analyzePromptQuality } from '../evaluators/promptAnalyzer';
import { computeSessionTokens } from '../evaluators/tokenCounter';
import { generateRecommendations } from '../evaluators/recommendationEngine';

/** Line separator used in the text report. */
const SEPARATOR = '────────────────────────────────────────────';

/**
 * Maps knowledge levels to human-readable labels.
 */
function levelLabel(level: KnowledgeLevel): string {
  const labels: Record<KnowledgeLevel, string> = {
    novice: '🔴 Novice',
    beginner: '🟠 Beginner',
    intermediate: '🟡 Intermediate',
    proficient: '🟢 Proficient',
    expert: '🏆 Expert',
  };
  return labels[level];
}

/**
 * Computes an aggregate SessionScore from an array of sessions.
 * @param sessions - Chat sessions to aggregate scores from.
 * @returns Aggregated SessionScore.
 */
function computeAggregateScore(sessions: ChatSession[]): SessionScore {
  if (sessions.length === 0) {
    return {
      sessionId: 'aggregate',
      computedAt: new Date(),
      knowledge: {
        conceptualDepth: 0,
        problemSolving: 0,
        independenceIndex: 60,
        domainKnowledge: 0,
        overall: 0,
        level: 'novice',
        byTechnology: [],
      },
      promptQuality: {
        clarity: 0,
        specificity: 0,
        contextEfficiency: 0,
        followUpQuality: 0,
        overallScore: 0,
        avgTurnsPerTask: 0,
        retryRate: 0,
        overContextRate: 0,
      },
      tokenEfficiency: {
        totalTokens: 0,
        wastedTokens: 0,
        efficiencyPercent: 0,
        estimatedCostUSD: 0,
      },
      byTechnology: [],
      recommendations: [],
    };
  }

  let totalKnowledge = 0;
  let totalPrompt = 0;
  let totalTokens = 0;
  let totalCost = 0;

  const allRecommendations: Recommendation[] = [];

  for (const session of sessions) {
    const knowledge = scoreKnowledge(session);
    const prompt = analyzePromptQuality(session);
    const tokens = computeSessionTokens(session);

    totalKnowledge += knowledge.overall;
    totalPrompt += prompt.overallScore;
    totalTokens += tokens.input + tokens.output;
    totalCost += tokens.costUSD;
  }

  const count = sessions.length;
  const lastSession = sessions[0]; // Sessions are newest-first

  const knowledge = scoreKnowledge(lastSession);
  const prompt = analyzePromptQuality(lastSession);
  const tokenInfo = computeSessionTokens(lastSession);

  const efficiencyPercent = totalTokens > 0
    ? Math.round(((totalTokens - Math.round(totalTokens * 0.15)) / totalTokens) * 100)
    : 100;

  const aggregateScore: SessionScore = {
    sessionId: 'aggregate',
    computedAt: new Date(),
    knowledge: {
      ...knowledge,
      overall: Math.round(totalKnowledge / count),
    },
    promptQuality: {
      ...prompt,
      overallScore: Math.round(totalPrompt / count),
    },
    tokenEfficiency: {
      totalTokens,
      wastedTokens: Math.round(totalTokens * 0.15),
      efficiencyPercent,
      estimatedCostUSD: totalCost,
    },
    byTechnology: knowledge.byTechnology,
    recommendations: [],
  };

  // Generate recommendations based on aggregate score
  aggregateScore.recommendations = generateRecommendations(aggregateScore);
  allRecommendations.push(...aggregateScore.recommendations);

  return aggregateScore;
}

/**
 * Generates and exports a report card for the analyzed sessions.
 * Prompts the user to save a .txt file, then also saves a companion .json file.
 * @param sessions - Chat sessions to include in the report.
 * @param store - Session store (used for additional data if needed).
 */
export async function exportReportCard(
  sessions: ChatSession[],
  store: SessionStore
): Promise<void> {
  try {
    if (sessions.length === 0) {
      void vscode.window.showWarningMessage(
        'ReflectDev: No sessions to export. Import some chat history first.'
      );
      return;
    }

    const score = computeAggregateScore(sessions);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    // ─── Generate text report ──────────────────────────────────────

    const textLines: string[] = [
      SEPARATOR,
      'REFLECTDEV STUDENT REPORT CARD',
      `Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      `Sessions analyzed: ${sessions.length}`,
      SEPARATOR,
      '',
      `OVERALL SCORE        ${score.knowledge.overall} / 100   ${levelLabel(score.knowledge.level)}`,
      `PROMPT QUALITY       ${score.promptQuality.overallScore} / 100`,
      `TOKEN EFFICIENCY     ${score.tokenEfficiency.efficiencyPercent} / 100`,
      `TOTAL TOKENS USED    ${score.tokenEfficiency.totalTokens.toLocaleString()}`,
      `ESTIMATED COST       $${score.tokenEfficiency.estimatedCostUSD.toFixed(4)}`,
      '',
      SEPARATOR,
      'KNOWLEDGE BREAKDOWN',
      `  Conceptual Depth:    ${score.knowledge.conceptualDepth} / 100`,
      `  Problem Solving:     ${score.knowledge.problemSolving} / 100`,
      `  Independence Index:  ${score.knowledge.independenceIndex} / 100`,
      `  Domain Knowledge:    ${score.knowledge.domainKnowledge} / 100`,
      '',
      SEPARATOR,
      'PROMPT QUALITY BREAKDOWN',
      `  Clarity:             ${score.promptQuality.clarity} / 100`,
      `  Specificity:         ${score.promptQuality.specificity} / 100`,
      `  Context Efficiency:  ${score.promptQuality.contextEfficiency} / 100`,
      `  Follow-up Quality:   ${score.promptQuality.followUpQuality} / 100`,
      `  Avg Turns/Task:      ${score.promptQuality.avgTurnsPerTask.toFixed(1)}`,
      `  Retry Rate:          ${(score.promptQuality.retryRate * 100).toFixed(0)}%`,
      '',
      SEPARATOR,
      'TECHNOLOGY BREAKDOWN',
    ];

    if (score.byTechnology.length > 0) {
      for (const tech of score.byTechnology) {
        textLines.push(
          `  ${tech.technology.padEnd(16)} ${String(tech.score).padStart(3)} / 100   ${levelLabel(tech.level)}`
        );
      }
    } else {
      textLines.push('  No technologies detected yet.');
    }

    textLines.push('');
    textLines.push(SEPARATOR);
    textLines.push('TOP 5 ACTIONS');

    const topRecs = score.recommendations.slice(0, 5);
    if (topRecs.length > 0) {
      topRecs.forEach((rec: Recommendation, index: number) => {
        textLines.push(
          `  ${index + 1}. ${rec.title} (${rec.effort})`
        );
        textLines.push(`     ${rec.description}`);
      });
    } else {
      textLines.push('  Keep up the great work! No urgent actions at this time.');
    }

    textLines.push('');
    textLines.push(SEPARATOR);
    textLines.push('SESSION SUMMARY');

    const recentSessions = sessions.slice(0, 10);
    for (const session of recentSessions) {
      const sessionDate = new Date(session.startedAt).toLocaleDateString();
      const msgCount = session.messages.length;
      textLines.push(
        `  ${sessionDate}  |  ${session.source.padEnd(10)}  |  ${String(msgCount).padStart(3)} msgs  |  $${session.totalCostUSD.toFixed(4)}`
      );
    }

    textLines.push('');
    textLines.push(SEPARATOR);
    textLines.push('Generated by ReflectDev — AI Chat Evaluator for VS Code');
    textLines.push(SEPARATOR);

    const textContent = textLines.join('\n');

    // ─── Generate JSON report ─────────────────────────────────────

    const jsonReport = {
      generatedAt: now.toISOString(),
      sessions: sessions.length,
      overallScore: score.knowledge.overall,
      level: score.knowledge.level,
      promptQuality: {
        overall: score.promptQuality.overallScore,
        clarity: score.promptQuality.clarity,
        specificity: score.promptQuality.specificity,
        contextEfficiency: score.promptQuality.contextEfficiency,
        followUpQuality: score.promptQuality.followUpQuality,
        avgTurnsPerTask: score.promptQuality.avgTurnsPerTask,
        retryRate: score.promptQuality.retryRate,
      },
      tokenEfficiency: {
        totalTokens: score.tokenEfficiency.totalTokens,
        wastedTokens: score.tokenEfficiency.wastedTokens,
        efficiencyPercent: score.tokenEfficiency.efficiencyPercent,
        estimatedCostUSD: score.tokenEfficiency.estimatedCostUSD,
      },
      byTechnology: score.byTechnology.map((tech) => ({
        technology: tech.technology,
        score: tech.score,
        level: tech.level,
        mentions: tech.mentions,
      })),
      recommendations: score.recommendations.slice(0, 5).map((rec: Recommendation) => ({
        rank: rec.rank,
        title: rec.title,
        description: rec.description,
        category: rec.category,
        effort: rec.effort,
      })),
    };

    // ─── Show save dialog ────────────────────────────────────────

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`reflectdev-report-${dateStr}.txt`),
      filters: {
        'Text Report': ['txt'],
        'JSON Report': ['json'],
      },
      title: 'Save ReflectDev Report Card',
    });

    if (!saveUri) {
      return;
    }

    const savePath = saveUri.fsPath;
    const isJson = savePath.endsWith('.json');

    // Write the selected format
    const contentToSave = isJson
      ? JSON.stringify(jsonReport, null, 2)
      : textContent;

    await vscode.workspace.fs.writeFile(
      saveUri,
      Buffer.from(contentToSave, 'utf-8')
    );

    // Also write the companion format
    const companionPath = isJson
      ? savePath.replace(/\.json$/, '.txt')
      : savePath.replace(/\.txt$/, '.json');

    const companionContent = isJson
      ? textContent
      : JSON.stringify(jsonReport, null, 2);

    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(companionPath),
      Buffer.from(companionContent, 'utf-8')
    );

    void vscode.window.showInformationMessage(
      `ReflectDev: Report saved to ${savePath}`
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    void vscode.window.showErrorMessage(
      `ReflectDev: Failed to export report — ${error.message}`
    );
  }
}
