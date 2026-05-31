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
 * Generate ranked recommendations based on a session score.
 * Evaluates rules in priority order and returns the top 5 applicable
 * recommendations. At least 1 recommendation is always returned.
 *
 * @param score - The SessionScore to generate recommendations for.
 * @returns An array of Recommendation objects sorted by rank (1 = highest priority).
 */
export declare function generateRecommendations(score: SessionScore): Recommendation[];
