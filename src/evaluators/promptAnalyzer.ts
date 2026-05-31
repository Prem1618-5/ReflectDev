/**
 * Prompt quality analyzer for ReflectDev.
 * Analyzes user prompts in a chat session and produces a PromptQuality score
 * based on positive and negative signal detection.
 *
 * Scoring signals are defined in the SRS:
 * - POSITIVE: code blocks, error messages, expected/actual, tried approaches, versions, conciseness, follow-ups
 * - NEGATIVE: vague openers, missing code blocks on technical questions, excessive length, repeated patterns
 */

import { ChatSession, ChatMessage } from '../models/session';
import { PromptQuality } from '../models/score';

/** Regex patterns for detecting positive signals in user prompts. */
const PATTERNS = {
  codeBlock: /```[\s\S]*?```/,
  errorMessage: /\b(error|exception|traceback|stack\s*trace|failed|failure|throw|thrown|crash|panic|ENOENT|EACCES|TypeError|ReferenceError|SyntaxError|ValueError|KeyError|NullPointerException|segfault|abort)\b/i,
  expectedVsActual: /\b(expected\b.*\bbut\b|actual\b.*\bexpected|should\s+(be|return|output|produce|show)|instead\s+(of|got|it|I\s+get))\b/i,
  triedApproaches: /\b(I\s+tried|I\s+already|I've\s+tried|I\s+attempted|I\s+tested|I\s+checked|I\s+verified|I\s+looked\s+at|I\s+debugged)\b/i,
  versionsConstraints: /\b(v\d+|version\s*\d|node\s*\d+|react\s*\d+|python\s*3|typescript\s*[45]|npm\s*\d|webpack\s*\d|java\s*\d+|\.net\s*\d|php\s*\d|ruby\s*\d|go\s*1\.\d+)\b/i,
  followUpQuestion: /\?$/m,
  vagueOpener: /^(help\s+me|fix\s+this|can\s+you|please\s+help|I\s+need\s+help|what'?s\s+wrong|it'?s?\s+(not\s+working|broken|failing))\b/i,
  technicalTerms: /\b(function|class|method|api|endpoint|database|server|client|component|module|import|export|async|await|promise|callback|hook|state|props|query|schema|migration|deploy|container|cluster|pod)\b/i,
} as const;

/** Common words used to detect vague openers (first 5 words check). */
const COMMON_WORDS = new Set([
  'i', 'me', 'my', 'the', 'a', 'an', 'is', 'it', 'to', 'do', 'can', 'you',
  'help', 'please', 'this', 'that', 'have', 'has', 'am', 'are', 'was', 'be',
  'need', 'want', 'how', 'what', 'why', 'with', 'for', 'in', 'on', 'of',
]);

/**
 * Count words in a string.
 * @param text - The text to count words in.
 * @returns The number of words.
 */
function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

/**
 * Check if the first N words of a message are all common/vague words.
 * @param text - The message text.
 * @param n - Number of leading words to check.
 * @returns True if all first N words are common words.
 */
function hasVagueLeadingWords(text: string, n: number): boolean {
  const words = text.trim().toLowerCase().split(/\s+/).slice(0, n);
  if (words.length < n) {
    return false;
  }
  return words.every((w) => COMMON_WORDS.has(w));
}

/**
 * Compute similarity ratio between two strings using bigram overlap.
 * @param a - First string.
 * @param b - Second string.
 * @returns Similarity ratio between 0 and 1.
 */
function similarityRatio(a: string, b: string): number {
  const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const aNorm = normalize(a);
  const bNorm = normalize(b);

  if (aNorm.length === 0 || bNorm.length === 0) {
    return 0;
  }

  const getBigrams = (s: string): Set<string> => {
    const bigrams = new Set<string>();
    const words = s.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.add(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
  };

  const bigramsA = getBigrams(aNorm);
  const bigramsB = getBigrams(bNorm);

  if (bigramsA.size === 0 || bigramsB.size === 0) {
    return aNorm === bNorm ? 1 : 0;
  }

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) {
      intersection++;
    }
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Clamp a numeric value between min and max (inclusive).
 * @param value - The value to clamp.
 * @param min - Minimum allowed value.
 * @param max - Maximum allowed value.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Analyze prompt quality for a chat session.
 * Evaluates all user messages for positive and negative signals,
 * producing scores for clarity, specificity, context efficiency,
 * follow-up quality, and an overall weighted score.
 *
 * @param session - The chat session to analyze.
 * @returns A PromptQuality object with all metric scores clamped 0-100.
 */
export function analyzePromptQuality(session: ChatSession): PromptQuality {
  try {
    const userMessages = session.messages.filter(
      (m: ChatMessage) => m.role === 'user'
    );

    if (userMessages.length === 0) {
      return {
        clarity: 50,
        specificity: 50,
        contextEfficiency: 50,
        followUpQuality: 50,
        overallScore: 50,
        avgTurnsPerTask: 0,
        retryRate: 0,
        overContextRate: 0,
      };
    }

    // Accumulators for signal scores
    let clarityDelta = 0;
    let specificityDelta = 0;
    let efficiencyDelta = 0;
    let followUpDelta = 0;

    let overContextCount = 0;
    let retryCount = 0;
    let topicShifts = 1; // At least 1 topic

    for (let i = 0; i < userMessages.length; i++) {
      const msg = userMessages[i];
      const content = msg.content;
      const words = wordCount(content);

      // === POSITIVE SIGNALS ===

      // Code block → clarity +15
      if (PATTERNS.codeBlock.test(content)) {
        clarityDelta += 15;
      }

      // Error message → specificity +15
      if (PATTERNS.errorMessage.test(content)) {
        specificityDelta += 15;
      }

      // Expected vs actual → specificity +10
      if (PATTERNS.expectedVsActual.test(content)) {
        specificityDelta += 10;
      }

      // Tried approaches → specificity +10
      if (PATTERNS.triedApproaches.test(content)) {
        specificityDelta += 10;
      }

      // Versions/constraints → specificity +10
      if (PATTERNS.versionsConstraints.test(content)) {
        specificityDelta += 10;
      }

      // Under 200 words → efficiency +10
      if (words > 0 && words < 200) {
        efficiencyDelta += 10;
      }

      // Follow-up question → followUpQuality +5
      if (PATTERNS.followUpQuestion.test(content)) {
        followUpDelta += 5;
      }

      // === NEGATIVE SIGNALS ===

      // Vague opener → clarity -20
      if (PATTERNS.vagueOpener.test(content) || hasVagueLeadingWords(content, 5)) {
        clarityDelta -= 20;
      }

      // No code block but technical question → specificity -15
      if (!PATTERNS.codeBlock.test(content) && PATTERNS.technicalTerms.test(content)) {
        specificityDelta -= 15;
      }

      // Over 500 words → efficiency -20
      if (words > 500) {
        efficiencyDelta -= 20;
        overContextCount++;
      }

      // Repeated question pattern (compare with previous user message) → followUpQuality -15
      if (i > 0) {
        const prevContent = userMessages[i - 1].content;
        const sim = similarityRatio(content, prevContent);
        if (sim > 0.6) {
          followUpDelta -= 15;
          retryCount++;
        } else if (sim < 0.2) {
          // Low similarity suggests topic shift
          topicShifts++;
        }
      }
    }

    // Normalize deltas per message count to avoid inflated scores on long sessions
    const msgCount = userMessages.length;
    const normalizedClarity = clarityDelta / msgCount;
    const normalizedSpecificity = specificityDelta / msgCount;
    const normalizedEfficiency = efficiencyDelta / msgCount;
    const normalizedFollowUp = followUpDelta / msgCount;

    // Calculate final scores (baseline + normalized delta, scaled, clamped 0-100)
    const clarity = clamp(Math.round(50 + normalizedClarity * 2), 0, 100);
    const specificity = clamp(Math.round(50 + normalizedSpecificity * 2), 0, 100);
    const contextEfficiency = clamp(Math.round(50 + normalizedEfficiency * 2), 0, 100);
    const followUpQuality = clamp(Math.round(60 + normalizedFollowUp * 2), 0, 100);

    // Overall = weighted average: clarity 30%, specificity 30%, contextEfficiency 20%, followUpQuality 20%
    const overallScore = clamp(
      Math.round(
        clarity * 0.3 +
        specificity * 0.3 +
        contextEfficiency * 0.2 +
        followUpQuality * 0.2
      ),
      0,
      100
    );

    // Derived metrics
    const avgTurnsPerTask = topicShifts > 0
      ? Number((session.messages.length / topicShifts).toFixed(1))
      : session.messages.length;

    const retryRate = msgCount > 1
      ? Number((retryCount / (msgCount - 1)).toFixed(2))
      : 0;

    const overContextRate = msgCount > 0
      ? Number((overContextCount / msgCount).toFixed(2))
      : 0;

    return {
      clarity,
      specificity,
      contextEfficiency,
      followUpQuality,
      overallScore,
      avgTurnsPerTask,
      retryRate,
      overContextRate,
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ReflectDev] Error analyzing prompt quality: ${errMsg}`);

    // Return neutral scores on error
    return {
      clarity: 50,
      specificity: 50,
      contextEfficiency: 50,
      followUpQuality: 50,
      overallScore: 50,
      avgTurnsPerTask: 0,
      retryRate: 0,
      overContextRate: 0,
    };
  }
}
