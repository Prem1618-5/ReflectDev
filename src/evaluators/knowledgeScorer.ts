/**
 * Knowledge scorer module for ReflectDev.
 * Analyzes chat sessions to evaluate the developer's domain knowledge depth
 * across detected technologies, producing a KnowledgeScore.
 *
 * Scoring is based on:
 * - Technology keyword detection (2+ mentions → include tech)
 * - Depth signal classification (first-principles, architectural, tradeoff, generic, etc.)
 * - Weighted combination of conceptualDepth, problemSolving, independenceIndex, domainKnowledge
 */

import { ChatSession, ChatMessage } from '../models/session';
import { KnowledgeScore, KnowledgeLevel, TechScore } from '../models/score';

/** Technology keyword dictionary for detecting technologies discussed in chat. */
const TECH_KEYWORDS: Record<string, string[]> = {
  react: ['react', 'jsx', 'usestate', 'useeffect', 'component', 'hook', 'props', 'redux', 'nextjs'],
  kubernetes: ['k8s', 'kubernetes', 'pod', 'deployment', 'ingress', 'helm', 'kubectl', 'namespace', 'service'],
  python: ['python', 'pip', 'django', 'flask', 'pandas', 'numpy', 'asyncio', 'pydantic', 'fastapi'],
  typescript: ['typescript', 'interface', 'type guard', 'generics', 'enum', 'discriminated union', 'mapped type'],
  aws: ['aws', 'ec2', 's3', 'lambda', 'iam', 'vpc', 'cloudformation', 'terraform', 'eks', 'rds'],
  azure: ['azure', 'entra', 'blob', 'functions', 'container', 'cosmos', 'rbac', 'policy', 'keyvault'],
  docker: ['docker', 'dockerfile', 'compose', 'container', 'image', 'registry', 'buildx', 'layer'],
  nodejs: ['node', 'express', 'npm', 'package.json', 'require', 'module', 'stream', 'buffer'],
  sql: ['sql', 'query', 'join', 'index', 'transaction', 'postgres', 'mysql', 'schema', 'migration'],
  git: ['git', 'commit', 'branch', 'merge', 'rebase', 'pull request', 'conflict', 'stash'],
};

/** Depth signal definitions with their associated point values. */
interface DepthSignal {
  name: string;
  patterns: RegExp[];
  points: number;
}

/** Ordered depth signals from deepest understanding to most generic. */
const DEPTH_SIGNALS: DepthSignal[] = [
  {
    name: 'firstPrinciple',
    patterns: [
      /\bwhy\s+does\b.*\b(work|happen|exist|behave)\s*(internally|under\s+the\s+hood|behind\s+the\s+scenes)?\b/i,
      /\bhow\s+does\b.*\b(internally|under\s+the\s+hood|at\s+a\s+low\s+level)\b/i,
      /\bfundamental(ly)?\b/i,
      /\bfirst\s+principles?\b/i,
      /\bwhat\s+happens\s+(when|if|internally|behind)\b/i,
    ],
    points: 85,
  },
  {
    name: 'architectural',
    patterns: [
      /\b(design|architect(ure)?|pattern|should\s+i|best\s+practice|system\s+design)\b/i,
      /\b(scalab(le|ility)|maintain(able|ability)|modular(ity)?)\b/i,
      /\b(microservice|monolith|event[\s-]driven|layered|hexagonal)\b/i,
      /\btradeoff\b/i,
    ],
    points: 75,
  },
  {
    name: 'tradeoff',
    patterns: [
      /\b(\w+)\s+vs\.?\s+(\w+)\b/i,
      /\bdifference\s+between\b/i,
      /\bcompare\b/i,
      /\bpros?\s+and\s+cons?\b/i,
      /\bwhich\s+(is|should|would)\s+(better|best|faster|more)\b/i,
    ],
    points: 65,
  },
  {
    name: 'withContext',
    patterns: [
      /\b(error|exception|bug|issue|problem|fail(ing|ed|ure)?)\b/i,
      /\b(expected|actual|should|instead)\b/i,
      /\bstack\s*trace\b/i,
    ],
    points: 50,
  },
  {
    name: 'generic',
    patterns: [
      /\b(what\s+is|how\s+(do|can|to)|explain|tell\s+me|show\s+me)\b/i,
      /\bwhat\s+are\b/i,
      /\bcan\s+you\b/i,
    ],
    points: 20,
  },
];

/** Self-correction bonus patterns. */
const SELF_CORRECT_PATTERNS: RegExp[] = [
  /\bwait,?\s+actually\b/i,
  /\bI\s+was\s+wrong\b/i,
  /\bactually,?\s+(I\s+think|let\s+me|never\s*mind)\b/i,
  /\bI\s+(just\s+)?realized\b/i,
  /\bon\s+second\s+thought\b/i,
];

/**
 * Clamp a numeric value between min and max (inclusive).
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert an overall numeric score (0-100) to a KnowledgeLevel label.
 * @param score - The overall score to classify.
 * @returns The corresponding knowledge level.
 */
export function toLevel(score: number): KnowledgeLevel {
  if (score >= 86) {
    return 'expert';
  }
  if (score >= 71) {
    return 'proficient';
  }
  if (score >= 51) {
    return 'intermediate';
  }
  if (score >= 31) {
    return 'beginner';
  }
  return 'novice';
}

/**
 * Detect the highest-scoring depth signal in a message.
 * @param content - The user message content to analyze.
 * @returns The point value of the deepest signal detected, or 0 if none.
 */
function detectDepthSignal(content: string): number {
  for (const signal of DEPTH_SIGNALS) {
    for (const pattern of signal.patterns) {
      if (pattern.test(content)) {
        return signal.points;
      }
    }
  }
  return 0;
}

/**
 * Check if a message contains self-correction signals (bonus points).
 * @param content - The user message content to analyze.
 * @returns True if self-correction is detected.
 */
function hasSelfCorrection(content: string): boolean {
  return SELF_CORRECT_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Count keyword mentions for each technology in the full session text.
 * @param fullText - Combined text from all messages (lowercased).
 * @returns A map of technology name to mention count.
 */
function countTechMentions(fullText: string): Map<string, number> {
  const mentions = new Map<string, number>();

  for (const [tech, keywords] of Object.entries(TECH_KEYWORDS)) {
    let count = 0;
    for (const keyword of keywords) {
      // Use word boundary matching for single-word keywords, contains for multi-word
      if (keyword.includes(' ') || keyword.includes('.')) {
        // Multi-word or dotted keyword: count occurrences
        const idx = fullText.indexOf(keyword.toLowerCase());
        if (idx !== -1) {
          count++;
          // Check for additional occurrences
          let searchFrom = idx + keyword.length;
          while (searchFrom < fullText.length) {
            const nextIdx = fullText.indexOf(keyword.toLowerCase(), searchFrom);
            if (nextIdx === -1) {
              break;
            }
            count++;
            searchFrom = nextIdx + keyword.length;
          }
        }
      } else {
        // Single word: use regex word boundary
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = fullText.match(regex);
        if (matches) {
          count += matches.length;
        }
      }
    }
    mentions.set(tech, count);
  }

  return mentions;
}

/**
 * Score knowledge for a chat session.
 * Analyzes user messages for depth signals and technology mentions,
 * producing a comprehensive KnowledgeScore.
 *
 * @param session - The chat session to analyze.
 * @returns A KnowledgeScore with per-technology breakdown.
 */
export function scoreKnowledge(session: ChatSession): KnowledgeScore {
  try {
    const userMessages = session.messages.filter(
      (m: ChatMessage) => m.role === 'user'
    );

    if (userMessages.length === 0) {
      return {
        conceptualDepth: 0,
        problemSolving: 0,
        independenceIndex: 60,
        domainKnowledge: 0,
        overall: 18, // 0*0.3 + 0*0.3 + 60*0.2 + 0*0.2 = 12, but give small baseline
        level: 'novice',
        byTechnology: [],
      };
    }

    // Compute depth signals from user messages
    const depthScores: number[] = [];
    let selfCorrectionBonus = 0;

    for (const msg of userMessages) {
      const depth = detectDepthSignal(msg.content);
      if (depth > 0) {
        depthScores.push(depth);
      }

      if (hasSelfCorrection(msg.content)) {
        selfCorrectionBonus += 10;
      }
    }

    // Average depth score (or baseline 20 if no signals detected)
    const avgDepth = depthScores.length > 0
      ? depthScores.reduce((sum, s) => sum + s, 0) / depthScores.length
      : 20;

    // Conceptual depth: based on average depth signals + self-correction bonus
    const conceptualDepth = clamp(
      Math.round(avgDepth + Math.min(selfCorrectionBonus, 20)),
      0,
      100
    );

    // Problem solving: proportion of messages with context-level or higher signals
    const contextOrHigherCount = depthScores.filter((s) => s >= 50).length;
    const problemSolving = clamp(
      Math.round((contextOrHigherCount / userMessages.length) * 100),
      0,
      100
    );

    // Independence index: hardcoded at 60 for v1
    const independenceIndex = 60;

    // Technology detection
    const fullText = session.messages
      .map((m: ChatMessage) => m.content)
      .join(' ')
      .toLowerCase();

    const techMentions = countTechMentions(fullText);

    // Build per-technology scores (only include technologies with 2+ mentions)
    const byTechnology: TechScore[] = [];

    for (const [tech, mentions] of techMentions.entries()) {
      if (mentions >= 2) {
        // Score based on mention frequency and depth of related questions
        const mentionScore = Math.min(mentions * 5, 40);
        const techDepthBonus = depthScores.length > 0
          ? Math.round(avgDepth * 0.5)
          : 10;
        const techScore = clamp(mentionScore + techDepthBonus, 0, 100);

        byTechnology.push({
          technology: tech,
          mentions,
          score: techScore,
          level: toLevel(techScore),
          strengths: techScore >= 50 ? [`Active discussion of ${tech} concepts`] : [],
          gaps: techScore < 50 ? [`Consider deeper exploration of ${tech}`] : [],
        });
      }
    }

    // Domain knowledge: average of technology scores, or baseline if none detected
    const domainKnowledge = byTechnology.length > 0
      ? clamp(
          Math.round(
            byTechnology.reduce((sum, t) => sum + t.score, 0) / byTechnology.length
          ),
          0,
          100
        )
      : 30;

    // Overall = conceptualDepth(30%) + problemSolving(30%) + independenceIndex(20%) + domainKnowledge(20%)
    const overall = clamp(
      Math.round(
        conceptualDepth * 0.3 +
        problemSolving * 0.3 +
        independenceIndex * 0.2 +
        domainKnowledge * 0.2
      ),
      0,
      100
    );

    const level = toLevel(overall);

    return {
      conceptualDepth,
      problemSolving,
      independenceIndex,
      domainKnowledge,
      overall,
      level,
      byTechnology,
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ReflectDev] Error scoring knowledge: ${errMsg}`);

    return {
      conceptualDepth: 0,
      problemSolving: 0,
      independenceIndex: 60,
      domainKnowledge: 0,
      overall: 12,
      level: 'novice',
      byTechnology: [],
    };
  }
}
