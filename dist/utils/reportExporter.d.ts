/**
 * @module reportExporter
 * @description Generates and exports formatted report cards (both .txt and .json)
 * summarizing developer competency scores, technology breakdowns, and recommendations.
 */
import { ChatSession } from '../models/session';
import { SessionStore } from '../store/sessionStore';
/**
 * Generates and exports a report card for the analyzed sessions.
 * Prompts the user to save a .txt file, then also saves a companion .json file.
 * @param sessions - Chat sessions to include in the report.
 * @param store - Session store (used for additional data if needed).
 */
export declare function exportReportCard(sessions: ChatSession[], store: SessionStore): Promise<void>;
