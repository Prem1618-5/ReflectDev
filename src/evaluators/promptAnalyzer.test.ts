/**
 * Tests for the ReflectDev prompt quality analyzer.
 */

import { analyzePromptQuality } from './promptAnalyzer';
import { ChatSession, ChatMessage, Source } from '../models/session';

/** Helper to build a test session from user messages. */
function makeSession(
  userContents: string[],
  assistantContent: string = 'Here is the answer to your question.'
): ChatSession {
  const messages: ChatMessage[] = [];
  let msgIdx = 0;

  for (const content of userContents) {
    messages.push({
      id: `msg-${msgIdx++}`,
      sessionId: 'test-session',
      role: 'user',
      content,
      timestamp: new Date(),
      tokenCount: 0,
      estimatedCostUSD: 0,
      source: 'import' as Source,
    });
    messages.push({
      id: `msg-${msgIdx++}`,
      sessionId: 'test-session',
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date(),
      tokenCount: 0,
      estimatedCostUSD: 0,
      source: 'import' as Source,
    });
  }

  return {
    id: 'test-session',
    source: 'import' as Source,
    startedAt: new Date(),
    messages,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUSD: 0,
    status: 'complete',
  };
}

describe('promptAnalyzer', () => {
  describe('analyzePromptQuality', () => {
    it('scores a vague prompt lower than a specific prompt with code block and error message', () => {
      const vagueSession = makeSession([
        'help me fix this',
        'it is not working',
        'can you help me please',
      ]);

      const specificSession = makeSession([
        'I\'m getting a TypeError: Cannot read property \'map\' of undefined in my React component.\n\n```tsx\nconst MyComponent = ({ items }) => {\n  return items.map(item => <div key={item.id}>{item.name}</div>);\n};\n```\n\nExpected the list to render but got a blank page. I tried adding a default value but it didn\'t help. Using React 18.2.',
      ]);

      const vagueScore = analyzePromptQuality(vagueSession);
      const specificScore = analyzePromptQuality(specificSession);

      expect(specificScore.overallScore).toBeGreaterThan(vagueScore.overallScore);
      expect(specificScore.specificity).toBeGreaterThan(vagueScore.specificity);
    });

    it('scores a prompt with a code block higher than one without', () => {
      const withCodeBlock = makeSession([
        'How do I fix this function?\n\n```javascript\nfunction add(a, b) {\n  return a + b;\n}\n```',
      ]);

      const withoutCodeBlock = makeSession([
        'How do I fix this function that adds two numbers?',
      ]);

      const withCodeScore = analyzePromptQuality(withCodeBlock);
      const withoutCodeScore = analyzePromptQuality(withoutCodeBlock);

      expect(withCodeScore.clarity).toBeGreaterThanOrEqual(withoutCodeScore.clarity);
    });

    it('returns valid score ranges (0-100) for all fields', () => {
      const session = makeSession([
        'What is React?',
        'How does useState work?',
      ]);

      const score = analyzePromptQuality(session);

      expect(score.clarity).toBeGreaterThanOrEqual(0);
      expect(score.clarity).toBeLessThanOrEqual(100);
      expect(score.specificity).toBeGreaterThanOrEqual(0);
      expect(score.specificity).toBeLessThanOrEqual(100);
      expect(score.contextEfficiency).toBeGreaterThanOrEqual(0);
      expect(score.contextEfficiency).toBeLessThanOrEqual(100);
      expect(score.followUpQuality).toBeGreaterThanOrEqual(0);
      expect(score.followUpQuality).toBeLessThanOrEqual(100);
      expect(score.overallScore).toBeGreaterThanOrEqual(0);
      expect(score.overallScore).toBeLessThanOrEqual(100);
    });

    it('returns neutral scores for a session with no user messages', () => {
      const session: ChatSession = {
        id: 'empty-session',
        source: 'import',
        startedAt: new Date(),
        messages: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUSD: 0,
        status: 'complete',
      };

      const score = analyzePromptQuality(session);
      expect(score.overallScore).toBe(50);
    });

    it('calculates retryRate > 0 for repeated questions', () => {
      const session = makeSession([
        'How do I deploy to Kubernetes?',
        'How do I deploy to Kubernetes?',
        'How do I deploy to Kubernetes?',
      ]);

      const score = analyzePromptQuality(session);
      expect(score.retryRate).toBeGreaterThan(0);
    });
  });
});
