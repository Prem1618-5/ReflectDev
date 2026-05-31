/**
 * Prompt quality analyzer for ReflectDev.
 * Analyzes user prompts in a chat session and produces a PromptQuality score
 * based on positive and negative signal detection.
 *
 * Scoring signals are defined in the SRS:
 * - POSITIVE: code blocks, error messages, expected/actual, tried approaches, versions, conciseness, follow-ups
 * - NEGATIVE: vague openers, missing code blocks on technical questions, excessive length, repeated patterns
 */
import { ChatSession } from '../models/session';
import { PromptQuality } from '../models/score';
/**
 * Analyze prompt quality for a chat session.
 * Evaluates all user messages for positive and negative signals,
 * producing scores for clarity, specificity, context efficiency,
 * follow-up quality, and an overall weighted score.
 *
 * @param session - The chat session to analyze.
 * @returns A PromptQuality object with all metric scores clamped 0-100.
 */
export declare function analyzePromptQuality(session: ChatSession): PromptQuality;
