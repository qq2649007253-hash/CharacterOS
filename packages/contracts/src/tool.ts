import { z } from 'zod';

export const toolNames = ['get_current_time', 'list_notes', 'create_note', 'delete_note'] as const;
export type ToolName = (typeof toolNames)[number];
export type ToolRisk = 'high' | 'low';
export type ToolCallStatus = 'completed' | 'failed' | 'pending' | 'rejected' | 'running';

export const toolDecisionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('respond') }),
  z.object({
    arguments: z.record(z.string(), z.unknown()),
    tool: z.enum(toolNames),
    type: z.literal('tool'),
  }),
]);

export const toolApprovalSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export interface ToolCallRecord {
  argumentsJson: string;
  characterId: string;
  conversationId: string;
  createdAt: string;
  error: string;
  id: string;
  resultJson: string;
  risk: ToolRisk;
  status: ToolCallStatus;
  toolName: string;
  updatedAt: string;
}
