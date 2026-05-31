/**
 * Tests for the ReflectDev knowledge scorer module.
 */

import { scoreKnowledge, toLevel } from './knowledgeScorer';
import { ChatSession, ChatMessage, Source } from '../models/session';

/** Helper to build a test session from user messages (with default assistant replies). */
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

describe('knowledgeScorer', () => {
  describe('toLevel', () => {
    it('returns expert for score >= 86', () => {
      expect(toLevel(86)).toBe('expert');
      expect(toLevel(100)).toBe('expert');
    });

    it('returns proficient for score 71-85', () => {
      expect(toLevel(71)).toBe('proficient');
      expect(toLevel(85)).toBe('proficient');
    });

    it('returns intermediate for score 51-70', () => {
      expect(toLevel(51)).toBe('intermediate');
      expect(toLevel(70)).toBe('intermediate');
    });

    it('returns beginner for score 31-50', () => {
      expect(toLevel(31)).toBe('beginner');
      expect(toLevel(50)).toBe('beginner');
    });

    it('returns novice for score < 31', () => {
      expect(toLevel(30)).toBe('novice');
      expect(toLevel(0)).toBe('novice');
    });
  });

  describe('scoreKnowledge', () => {
    it('scores a deep question higher than a generic one', () => {
      const deepSession = makeSession([
        'Why does React reconciliation work internally with the virtual DOM?',
        'What happens under the hood when React detects a state change?',
        'How does the diffing algorithm handle deeply nested component trees?',
      ]);

      const genericSession = makeSession([
        'What is React?',
        'How do I install React?',
        'Explain React to me.',
      ]);

      const deepScore = scoreKnowledge(deepSession);
      const genericScore = scoreKnowledge(genericSession);

      expect(deepScore.conceptualDepth).toBeGreaterThan(genericScore.conceptualDepth);
      expect(deepScore.overall).toBeGreaterThan(genericScore.overall);
    });

    it('includes azure in byTechnology when Azure terms are used', () => {
      const azureSession = makeSession([
        'How do I set up Azure RBAC policies for my keyvault?',
        'I need to configure Azure Entra ID with cosmos DB access.',
        'What is the best practice for Azure blob storage security?',
      ]);

      const score = scoreKnowledge(azureSession);
      const azureTech = score.byTechnology.find((t) => t.technology === 'azure');

      expect(azureTech).toBeDefined();
      expect(azureTech?.mentions).toBeGreaterThanOrEqual(2);
    });

    it('extracts react technology when React terms are discussed', () => {
      const reactSession = makeSession([
        'How do I use useState in a React component?',
        'My useEffect hook is firing on every render in my React app.',
        'Should I use Redux or useContext for state management in React?',
      ]);

      const score = scoreKnowledge(reactSession);
      const reactTech = score.byTechnology.find((t) => t.technology === 'react');

      expect(reactTech).toBeDefined();
      expect(reactTech?.mentions).toBeGreaterThanOrEqual(2);
    });

    it('returns valid score ranges for all fields', () => {
      const session = makeSession([
        'How do I configure Kubernetes deployments?',
        'What is the difference between a pod and a deployment?',
      ]);

      const score = scoreKnowledge(session);

      expect(score.conceptualDepth).toBeGreaterThanOrEqual(0);
      expect(score.conceptualDepth).toBeLessThanOrEqual(100);
      expect(score.problemSolving).toBeGreaterThanOrEqual(0);
      expect(score.problemSolving).toBeLessThanOrEqual(100);
      expect(score.independenceIndex).toBe(60);
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
      expect(['novice', 'beginner', 'intermediate', 'proficient', 'expert']).toContain(score.level);
    });

    it('handles empty session gracefully', () => {
      const emptySession: ChatSession = {
        id: 'empty',
        source: 'import',
        startedAt: new Date(),
        messages: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUSD: 0,
        status: 'complete',
      };

      const score = scoreKnowledge(emptySession);
      expect(score.level).toBe('novice');
      expect(score.byTechnology).toHaveLength(0);
    });

    it('awards self-correction bonus', () => {
      const withCorrection = makeSession([
        'Wait, actually I was wrong about how React hooks work. Let me rethink this.',
        'I just realized the useEffect dependency array needs to include the function reference.',
      ]);

      const withoutCorrection = makeSession([
        'How do React hooks work?',
        'Tell me about the useEffect dependency array.',
      ]);

      const scoreWith = scoreKnowledge(withCorrection);
      const scoreWithout = scoreKnowledge(withoutCorrection);

      expect(scoreWith.conceptualDepth).toBeGreaterThanOrEqual(scoreWithout.conceptualDepth);
    });
  });
});
