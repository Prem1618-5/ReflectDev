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
export declare function computeVelocity(sessions: ChatSession[]): number;
