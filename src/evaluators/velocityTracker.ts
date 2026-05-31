/**
 * Velocity tracker for ReflectDev.
 * Tracks learning velocity by comparing recent session knowledge scores
 * against earlier sessions, producing a score delta that indicates
 * improvement or regression.
 */

import { ChatSession } from '../models/session';

/**
 * Compute learning velocity across sessions.
 * Compares the average knowledge score of the 5 most recent sessions
 * against the previous 5 sessions to determine the learning trend.
 *
 * @param sessions - Array of sessions ordered newest-first.
 * @returns Score delta (positive = improving, negative = declining, 0 = no data or stable).
 */
export function computeVelocity(sessions: ChatSession[]): number {
  try {
    if (sessions.length < 2) {
      return 0;
    }

    // Compare last 5 sessions' average score to previous 5
    const recent = sessions.slice(0, 5);
    const previous = sessions.slice(5, 10);

    if (previous.length === 0) {
      return 0;
    }

    const recentAvg =
      recent.reduce(
        (sum: number, s: ChatSession) => sum + (s.score?.knowledge.overall ?? 50),
        0
      ) / recent.length;

    const previousAvg =
      previous.reduce(
        (sum: number, s: ChatSession) => sum + (s.score?.knowledge.overall ?? 50),
        0
      ) / previous.length;

    return Math.round(recentAvg - previousAvg);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ReflectDev] Error computing velocity: ${errMsg}`);
    return 0;
  }
}
