/**
 * Token counter module for ReflectDev.
 * Counts tokens in text using tiktoken (with fallback estimation)
 * and estimates USD cost based on model pricing.
 */

import { ChatSession } from '../models/session';

/** Model pricing rates per 1M tokens (input, output) in USD. */
const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'claude-sonnet': { input: 3.00, output: 15.00 },
  'claude-haiku': { input: 0.80, output: 4.00 },
  'gpt-4o': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gemini-1.5-pro': { input: 3.50, output: 10.50 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
};

/** Default rate when model is not recognized. */
const DEFAULT_RATE: Readonly<{ input: number; output: number }> = { input: 3.00, output: 15.00 };

/**
 * Count the number of tokens in a text string.
 * Uses tiktoken if available, falls back to character-based estimation (~4 chars per token).
 * @param text - The text to count tokens for.
 * @param _encoding - Optional encoding to use. Defaults to 'cl100k_base'.
 * @returns The estimated number of tokens.
 */
export function countTokens(text: string, _encoding?: 'cl100k_base' | 'o200k_base'): number {
  if (!text) {
    return 0;
  }
  try {
    // Try to use tiktoken for accurate counting
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tiktoken = require('tiktoken') as { get_encoding: (enc: string) => { encode: (t: string) => Uint32Array; free: () => void } };
    const enc = tiktoken.get_encoding(_encoding ?? 'cl100k_base');
    const tokens = enc.encode(text);
    const count = tokens.length;
    enc.free();
    return count;
  } catch {
    // Fallback: estimate ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Estimate USD cost given token counts and model name.
 * Matches the model name by substring against known pricing rates.
 * @param inputTokens - Number of input (user) tokens.
 * @param outputTokens - Number of output (assistant) tokens.
 * @param model - Model name string (e.g., 'claude-sonnet-3.5').
 * @returns Estimated cost in USD, rounded to 6 decimal places.
 */
export function estimateCostUSD(inputTokens: number, outputTokens: number, model: string): number {
  if (inputTokens === 0 && outputTokens === 0) {
    return 0;
  }

  // Find the rate for this model (match by substring)
  let rate = DEFAULT_RATE;
  const modelLower = model.toLowerCase();
  for (const [key, value] of Object.entries(MODEL_RATES)) {
    if (modelLower.includes(key)) {
      rate = value;
      break;
    }
  }

  const inputCost = (inputTokens / 1_000_000) * rate.input;
  const outputCost = (outputTokens / 1_000_000) * rate.output;
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * Compute total token counts and cost for a complete session.
 * Counts all user messages as input tokens and assistant messages as output tokens.
 * @param session - The chat session to analyze.
 * @returns An object with input token count, output token count, and estimated USD cost.
 */
export function computeSessionTokens(session: ChatSession): { input: number; output: number; costUSD: number } {
  let input = 0;
  let output = 0;

  try {
    for (const msg of session.messages) {
      const tokens = countTokens(msg.content);
      if (msg.role === 'user') {
        input += tokens;
      } else if (msg.role === 'assistant') {
        output += tokens;
      }
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ReflectDev] Error computing session tokens: ${errMsg}`);
  }

  const model = session.model ?? 'claude-sonnet';
  const costUSD = estimateCostUSD(input, output, model);

  return { input, output, costUSD };
}
