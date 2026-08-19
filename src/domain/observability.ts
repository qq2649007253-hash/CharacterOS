import { z } from 'zod';

export type AgentRunStatus = 'awaiting_approval' | 'completed' | 'failed' | 'rejected' | 'running';

export const evaluationRequestSchema = z.object({ characterId: z.string().uuid() });

export interface AgentRun {
  characterId: string;
  completedAt: string;
  conversationId: string;
  createdAt: string;
  error: string;
  id: string;
  input: string;
  knowledgeHits: number;
  latencyMs: number;
  memoryHits: number;
  model: string;
  output: string;
  retrievalMethod: string;
  status: AgentRunStatus;
  toolCallId: string;
}

export interface EvaluationRecord {
  characterId: string;
  createdAt: string;
  id: string;
  input: string;
  output: string;
  passed: boolean;
  reason: string;
  score: number;
  testName: string;
}
