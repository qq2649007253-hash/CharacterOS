import type { Character } from '@/domain/character';
import { toolDecisionSchema, type ToolName } from '@/domain/tool';
import { ollamaService } from '@/server/services/ollamaService';
import { toolService } from '@/server/services/toolService';

const toolHintPattern = /便签|备忘|几点|时间|日期/;

const fallbackDecision = (content: string) => {
  if (/查看|列出|有哪些|显示/.test(content) && /便签|备忘/.test(content)) {
    return { arguments: {}, tool: 'list_notes' as ToolName, type: 'tool' as const };
  }
  if (/几点|当前时间|现在.*时间|今天.*日期/.test(content)) {
    return { arguments: { timezone: 'Asia/Shanghai' }, tool: 'get_current_time' as ToolName, type: 'tool' as const };
  }
  const noteMatch = content.match(/(?:创建|保存|添加|记下|记录)(?:一条)?(?:便签|备忘)?[：:\s]*(.+)$/);
  if (noteMatch?.[1]) {
    return { arguments: { content: noteMatch[1].trim() }, tool: 'create_note' as ToolName, type: 'tool' as const };
  }
  const deleteMatch = content.match(/(?:删除|移除)(?:便签|备忘)?[：:\s]*([0-9a-f-]{36})/i);
  if (deleteMatch?.[1]) {
    return { arguments: { noteId: deleteMatch[1] }, tool: 'delete_note' as ToolName, type: 'tool' as const };
  }
  return { type: 'respond' as const };
};

export const toolPlannerService = {
  async decide(character: Character, content: string, signal?: AbortSignal) {
    if (!toolHintPattern.test(content)) return { type: 'respond' as const };
    const definitions = toolService.definitions();
    const prompt = [
      '你是 Agent 工具路由器。判断用户是否明确要求调用一个工具。',
      '只输出 JSON，不要解释。普通聊天输出 {"type":"respond"}。',
      '工具调用输出 {"type":"tool","tool":"工具名","arguments":{...}}。',
      '不要把“记住我的偏好”当作创建便签；只有明确提到便签、备忘或记下事项时才创建便签。',
      `可用工具：${JSON.stringify(definitions)}`,
      `用户输入：${content}`,
    ].join('\n');
    try {
      const raw = await ollamaService.complete(character.model, [{ content: prompt, role: 'user' }], signal);
      const parsed = toolDecisionSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {}
    return fallbackDecision(content);
  },
};
