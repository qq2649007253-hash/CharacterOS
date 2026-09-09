import { z } from 'zod';

import type { ToolName, ToolRisk } from '@characteros/contracts/tool';
import { noteRepository } from '@/server/repositories/noteRepository';

const emptySchema = z.object({});
const toolDefinitions = {
  create_note: {
    description: '创建一条持久化便签。该操作会写入数据，必须由用户批准。',
    risk: 'high' as ToolRisk,
    schema: z.object({ content: z.string().trim().min(1).max(500) }),
  },
  delete_note: {
    description: '根据便签 ID 删除一条便签。该操作不可直接恢复，必须由用户批准。',
    risk: 'high' as ToolRisk,
    schema: z.object({ noteId: z.string().uuid() }),
  },
  get_current_time: {
    description: '读取当前日期与时间，不修改任何数据。',
    risk: 'low' as ToolRisk,
    schema: z.object({ timezone: z.string().trim().min(1).max(80).default('Asia/Shanghai') }),
  },
  list_notes: {
    description: '读取当前角色保存的全部便签，不修改任何数据。',
    risk: 'low' as ToolRisk,
    schema: emptySchema,
  },
} satisfies Record<ToolName, { description: string; risk: ToolRisk; schema: z.ZodType }>;

export const toolService = {
  definitions() {
    return Object.entries(toolDefinitions).map(([name, definition]) => ({
      description: definition.description,
      name: name as ToolName,
      risk: definition.risk,
    }));
  },

  async execute(name: ToolName, rawArguments: Record<string, unknown>, characterId: string) {
    const definition = toolDefinitions[name];
    const arguments_ = definition.schema.parse(rawArguments) as Record<string, unknown>;
    switch (name) {
      case 'get_current_time': {
        const timezone = arguments_.timezone as string;
        try {
          return {
            timezone,
            value: new Intl.DateTimeFormat('zh-CN', {
              dateStyle: 'full',
              timeStyle: 'long',
              timeZone: timezone,
            }).format(new Date()),
          };
        } catch {
          throw new Error('无效的时区名称');
        }
      }
      case 'list_notes':
        return { notes: noteRepository.list(characterId) };
      case 'create_note':
        return { note: noteRepository.create(characterId, arguments_.content as string) };
      case 'delete_note': {
        const note = noteRepository.findById(arguments_.noteId as string);
        if (!note || note.characterId !== characterId) throw new Error('便签不存在或不属于当前角色');
        noteRepository.delete(note.id);
        return { deletedNote: note };
      }
    }
  },

  parseArguments(name: ToolName, rawArguments: Record<string, unknown>) {
    return toolDefinitions[name].schema.parse(rawArguments) as Record<string, unknown>;
  },

  risk(name: ToolName) {
    return toolDefinitions[name].risk;
  },
};
