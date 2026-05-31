import { Recommendation } from './recommendation';

/** Competency level classification. */
export type KnowledgeLevel = 'novice' | 'beginner' | 'intermediate' | 'proficient' | 'expert';

/** Score for a specific technology detected in chat sessions. */
export interface TechScore {
  technology: string;
  mentions: number;
  score: number;
  level: KnowledgeLevel;
  strengths: string[];
  gaps: string[];
}

/** Overall knowledge depth assessment. */
export interface KnowledgeScore {
  conceptualDepth: number;
  problemSolving: number;
  independenceIndex: number;
  domainKnowledge: number;
  overall: number;
  level: KnowledgeLevel;
  byTechnology: TechScore[];
}

/** Prompt quality metrics for a session. */
export interface PromptQuality {
  clarity: number;
  specificity: number;
  contextEfficiency: number;
  followUpQuality: number;
  overallScore: number;
  avgTurnsPerTask: number;
  retryRate: number;
  overContextRate: number;
}

/** Token usage efficiency metrics. */
export interface TokenEfficiency {
  totalTokens: number;
  wastedTokens: number;
  efficiencyPercent: number;
  estimatedCostUSD: number;
}

/** Complete session scoring result. */
export interface SessionScore {
  sessionId: string;
  computedAt: Date;
  knowledge: KnowledgeScore;
  promptQuality: PromptQuality;
  tokenEfficiency: TokenEfficiency;
  byTechnology: TechScore[];
  recommendations: Recommendation[];
}
