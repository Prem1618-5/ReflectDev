/**
 * Recommendation engine for ReflectDev.
 * Generates ranked, actionable recommendations from a SessionScore
 * based on rule-based analysis of prompt quality, knowledge depth,
 * token efficiency, and learning patterns.
 *
 * Rules are evaluated in priority order; the top 5 applicable recommendations
 * are returned. At least 1 recommendation is always returned.
 */

import { SessionScore } from '../models/score';
import { Recommendation } from '../models/recommendation';

/**
 * Generate a UUID v4 string.
 * Uses the uuid package if available, otherwise falls back to crypto.randomUUID
 * or a simple implementation.
 * @returns A UUID v4 string.
 */
function generateId(): string {
  try {
    // Try uuid package first
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { v4 } = require('uuid') as { v4: () => string };
    return v4();
  } catch {
    // Fallback: use crypto.randomUUID if available (Node 19+)
    try {
      return crypto.randomUUID();
    } catch {
      // Last resort: simple random string
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
  }
}

/** A recommendation rule with its condition and recommendation factory. */
interface RecommendationRule {
  /** Condition that must be true for this rule to fire. */
  condition: (score: SessionScore) => boolean;
  /** Factory function to create the recommendation. */
  create: (score: SessionScore, rank: number) => Recommendation;
}

/** Ordered list of recommendation rules (highest priority first). */
const RULES: RecommendationRule[] = [
  // Rule 1: Poor prompt quality with excessive turns
  {
    condition: (score) =>
      score.promptQuality.overallScore < 50 && score.promptQuality.avgTurnsPerTask > 3,
    create: (_score, rank) => ({
      id: generateId(),
      rank,
      title: 'Add more context to your prompts',
      description:
        'Your prompts lack specificity, leading to multiple follow-up turns. ' +
        'Include code snippets, error messages, and expected vs actual behavior in your initial prompt.',
      category: 'prompt-habit',
      effort: 'low',
      action: {
        type: 'send-prompt',
        value: 'Show me the CLEAR prompt template: Context, Language, Expected, Actual, Requirements',
      },
    }),
  },

  // Rule 2: Over-contexted prompts
  {
    condition: (score) => score.promptQuality.overContextRate > 0.3,
    create: (_score, rank) => ({
      id: generateId(),
      rank,
      title: 'Paste only the relevant code (< 50 lines)',
      description:
        'Over 30% of your prompts include excessive context. ' +
        'Paste only the function or block that\'s relevant to your question, not entire files.',
      category: 'prompt-habit',
      effort: 'low',
      tokenSavingsPerMonth: 50000,
    }),
  },

  // Rule 3: Weak technology scores (dynamically generated per tech)
  {
    condition: (score) =>
      score.knowledge.byTechnology.some((t) => t.score < 40),
    create: (score, rank) => {
      const weakTechs = score.knowledge.byTechnology
        .filter((t) => t.score < 40)
        .map((t) => t.technology);
      const techList = weakTechs.slice(0, 3).join(', ');

      return {
        id: generateId(),
        rank,
        title: `Study ${techList} fundamentals`,
        description:
          `You're asking basic-level questions about ${techList}. ` +
          'Consider studying the official documentation or completing a tutorial to build foundational knowledge.',
        category: 'learning',
        effort: 'medium',
        action: {
          type: 'open-url',
          value: `https://www.google.com/search?q=${encodeURIComponent(weakTechs[0] + ' tutorial')}`,
        },
      };
    },
  },

  // Rule 4: High token cost
  {
    condition: (score) => score.tokenEfficiency.estimatedCostUSD > 0.50,
    create: (score, rank) => ({
      id: generateId(),
      rank,
      title: 'Use claude-haiku for simple questions — 10x cheaper',
      description:
        `This session cost $${score.tokenEfficiency.estimatedCostUSD.toFixed(2)}. ` +
        'For straightforward questions like "how do I X" or "what does Y mean", ' +
        'switch to a smaller model to save significantly on token costs.',
      category: 'cost',
      effort: 'low',
      costSavingsPerMonth: score.tokenEfficiency.estimatedCostUSD * 0.8 * 20,
    }),
  },

  // Rule 5: High retry rate
  {
    condition: (score) => score.promptQuality.retryRate > 0.2,
    create: (_score, rank) => ({
      id: generateId(),
      rank,
      title: 'Use the CLEAR template for your prompts',
      description:
        'Over 20% of your messages are retries or rewrites of previous questions. ' +
        'Use the CLEAR template: Context, Language, Expected, Actual, Requirements — ' +
        'to get better answers on the first try.',
      category: 'prompt-habit',
      effort: 'low',
      action: {
        type: 'send-prompt',
        value: 'Context: [what I\'m working on]\nLanguage: [tech stack]\nExpected: [what should happen]\nActual: [what actually happens]\nRequirements: [constraints]',
      },
    }),
  },

  // Rule 6: Proficient user encouragement
  {
    condition: (score) => score.knowledge.overall > 70,
    create: (_score, rank) => ({
      id: generateId(),
      rank,
      title: 'You\'re proficient — try explaining your solution to the AI instead of asking',
      description:
        'Your knowledge scores are strong. Try a different approach: explain your proposed solution ' +
        'to the AI and ask it to find flaws, rather than asking how to do something. ' +
        'This rubber-duck debugging technique builds deeper understanding.',
      category: 'learning',
      effort: 'medium',
    }),
  },
];

/** Default/fallback recommendations when no rules fire. */
const DEFAULT_RECOMMENDATIONS: Omit<Recommendation, 'id' | 'rank'>[] = [
  {
    title: 'Start with a clear problem statement',
    description:
      'Begin each prompt with a one-sentence summary of what you\'re trying to achieve. ' +
      'This helps the AI understand context faster and give more relevant answers.',
    category: 'prompt-habit',
    effort: 'low',
  },
  {
    title: 'Include error messages in your prompts',
    description:
      'When debugging, always paste the exact error message and stack trace. ' +
      'This eliminates guesswork and leads to faster solutions.',
    category: 'prompt-habit',
    effort: 'low',
  },
  {
    title: 'Review AI answers before applying them',
    description:
      'Take a moment to understand why a solution works before copy-pasting it. ' +
      'This builds lasting knowledge and helps you catch potential issues.',
    category: 'learning',
    effort: 'low',
  },
];

/**
 * Generate ranked recommendations based on a session score.
 * Evaluates rules in priority order and returns the top 5 applicable
 * recommendations. At least 1 recommendation is always returned.
 *
 * @param score - The SessionScore to generate recommendations for.
 * @returns An array of Recommendation objects sorted by rank (1 = highest priority).
 */
export function generateRecommendations(score: SessionScore): Recommendation[] {
  try {
    const recommendations: Recommendation[] = [];
    let currentRank = 1;

    // Evaluate each rule in priority order
    for (const rule of RULES) {
      if (recommendations.length >= 5) {
        break;
      }

      try {
        if (rule.condition(score)) {
          const rec = rule.create(score, currentRank);
          recommendations.push(rec);
          currentRank++;
        }
      } catch (ruleError: unknown) {
        const errMsg = ruleError instanceof Error ? ruleError.message : String(ruleError);
        console.error(`[ReflectDev] Error evaluating recommendation rule: ${errMsg}`);
      }
    }

    // Always return at least 1 recommendation
    if (recommendations.length === 0) {
      const fallback = DEFAULT_RECOMMENDATIONS[0];
      recommendations.push({
        id: generateId(),
        rank: 1,
        title: fallback.title,
        description: fallback.description,
        category: fallback.category,
        effort: fallback.effort,
      });
    }

    // Fill remaining slots (up to 5) with default recommendations if needed
    let defaultIdx = 0;
    while (recommendations.length < 5 && defaultIdx < DEFAULT_RECOMMENDATIONS.length) {
      const fallback = DEFAULT_RECOMMENDATIONS[defaultIdx];
      // Don't add duplicates
      const titleExists = recommendations.some((r) => r.title === fallback.title);
      if (!titleExists) {
        recommendations.push({
          id: generateId(),
          rank: currentRank++,
          title: fallback.title,
          description: fallback.description,
          category: fallback.category,
          effort: fallback.effort,
        });
      }
      defaultIdx++;
    }

    return recommendations;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ReflectDev] Error generating recommendations: ${errMsg}`);

    // Return a single generic recommendation on error
    return [
      {
        id: generateId(),
        rank: 1,
        title: 'Start with a clear problem statement',
        description: 'Begin each prompt with a one-sentence summary of what you\'re trying to achieve.',
        category: 'prompt-habit',
        effort: 'low',
      },
    ];
  }
}
