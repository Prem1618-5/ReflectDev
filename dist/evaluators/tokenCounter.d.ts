/**
 * Token counter module for ReflectDev.
 * Counts tokens in text using tiktoken (with fallback estimation)
 * and estimates USD cost based on model pricing.
 */
import { ChatSession } from '../models/session';
/**
 * Count the number of tokens in a text string.
 * Uses tiktoken if available, falls back to character-based estimation (~4 chars per token).
 * @param text - The text to count tokens for.
 * @param _encoding - Optional encoding to use. Defaults to 'cl100k_base'.
 * @returns The estimated number of tokens.
 */
export declare function countTokens(text: string, _encoding?: 'cl100k_base' | 'o200k_base'): number;
/**
 * Estimate USD cost given token counts and model name.
 * Matches the model name by substring against known pricing rates.
 * @param inputTokens - Number of input (user) tokens.
 * @param outputTokens - Number of output (assistant) tokens.
 * @param model - Model name string (e.g., 'claude-sonnet-3.5').
 * @returns Estimated cost in USD, rounded to 6 decimal places.
 */
export declare function estimateCostUSD(inputTokens: number, outputTokens: number, model: string): number;
/**
 * Compute total token counts and cost for a complete session.
 * Counts all user messages as input tokens and assistant messages as output tokens.
 * @param session - The chat session to analyze.
 * @returns An object with input token count, output token count, and estimated USD cost.
 */
export declare function computeSessionTokens(session: ChatSession): {
    input: number;
    output: number;
    costUSD: number;
};
