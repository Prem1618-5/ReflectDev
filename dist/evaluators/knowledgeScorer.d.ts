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
import { ChatSession } from '../models/session';
import { KnowledgeScore, KnowledgeLevel } from '../models/score';
/**
 * Convert an overall numeric score (0-100) to a KnowledgeLevel label.
 * @param score - The overall score to classify.
 * @returns The corresponding knowledge level.
 */
export declare function toLevel(score: number): KnowledgeLevel;
/**
 * Score knowledge for a chat session.
 * Analyzes user messages for depth signals and technology mentions,
 * producing a comprehensive KnowledgeScore.
 *
 * @param session - The chat session to analyze.
 * @returns A KnowledgeScore with per-technology breakdown.
 */
export declare function scoreKnowledge(session: ChatSession): KnowledgeScore;
