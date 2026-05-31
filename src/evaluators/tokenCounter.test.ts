/**
 * Tests for the ReflectDev token counter module.
 */

import { countTokens, estimateCostUSD, computeSessionTokens } from './tokenCounter';
import { ChatSession, ChatMessage, Source } from '../models/session';

/** Helper to build a test session from simple message pairs. */
const makeSession = (
  messages: { role: 'user' | 'assistant'; content: string }[],
  model?: string
): ChatSession => ({
  id: 'test-session',
  source: 'import' as Source,
  startedAt: new Date(),
  messages: messages.map((m, i): ChatMessage => ({
    id: `msg-${i}`,
    sessionId: 'test-session',
    role: m.role,
    content: m.content,
    timestamp: new Date(),
    tokenCount: 0,
    estimatedCostUSD: 0,
    source: 'import' as Source,
  })),
  model,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostUSD: 0,
  status: 'complete',
});

describe('tokenCounter', () => {
  describe('countTokens', () => {
    it('returns a number > 0 for non-empty string', () => {
      const count = countTokens('Hello, world! This is a test string.');
      expect(count).toBeGreaterThan(0);
    });

    it('returns 0 for empty string', () => {
      expect(countTokens('')).toBe(0);
    });

    it('handles long text without error', () => {
      const longText = 'word '.repeat(1000);
      const count = countTokens(longText);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('estimateCostUSD', () => {
    it('returns 0 for 0 tokens', () => {
      expect(estimateCostUSD(0, 0, 'claude-sonnet')).toBe(0);
    });

    it('returns a positive cost for non-zero tokens', () => {
      const cost = estimateCostUSD(1000, 1000, 'claude-sonnet');
      expect(cost).toBeGreaterThan(0);
    });

    it('matches correct model rate by substring', () => {
      const haikuCost = estimateCostUSD(1_000_000, 0, 'claude-haiku-3.5');
      // Haiku input rate is $0.80 per 1M tokens
      expect(haikuCost).toBeCloseTo(0.80, 2);
    });

    it('uses default rate for unknown models', () => {
      const cost = estimateCostUSD(1_000_000, 0, 'unknown-model-xyz');
      // Default input rate is $3.00 per 1M tokens
      expect(cost).toBeCloseTo(3.00, 2);
    });
  });

  describe('computeSessionTokens', () => {
    it('returns correct totals for a session', () => {
      const session = makeSession([
        { role: 'user', content: 'How do I use React hooks?' },
        {
          role: 'assistant',
          content:
            'React hooks are functions that let you use state and other React features in function components. The most common hooks are useState and useEffect.',
        },
      ]);
      const result = computeSessionTokens(session);
      expect(result.input).toBeGreaterThan(0);
      expect(result.output).toBeGreaterThan(0);
      expect(result.costUSD).toBeGreaterThan(0);
    });

    it('returns zero totals for empty session', () => {
      const session = makeSession([]);
      const result = computeSessionTokens(session);
      expect(result.input).toBe(0);
      expect(result.output).toBe(0);
      expect(result.costUSD).toBe(0);
    });

    it('uses session model for cost estimation', () => {
      const session = makeSession(
        [
          { role: 'user', content: 'Test message with some content for token counting' },
          { role: 'assistant', content: 'Response message with some content for token counting' },
        ],
        'gpt-4o-mini'
      );
      const result = computeSessionTokens(session);
      expect(result.costUSD).toBeGreaterThan(0);
    });
  });
});
