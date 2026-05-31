/** An actionable recommendation for the developer. */
export interface Recommendation {
  id: string;
  rank: number;
  title: string;
  description: string;
  category: 'prompt-habit' | 'learning' | 'efficiency' | 'cost';
  effort: 'low' | 'medium' | 'high';
  tokenSavingsPerMonth?: number;
  costSavingsPerMonth?: number;
  action?: {
    type: 'open-url' | 'send-prompt' | 'open-setting';
    value: string;
  };
}
