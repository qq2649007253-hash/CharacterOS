import type { Character } from '@characteros/contracts/character';
import { characterRepository } from '@/server/repositories/characterRepository';
import { evaluationRepository } from '@/server/repositories/evaluationRepository';
import { buildOllamaMessages, ollamaService } from '@/server/services/ollamaService';
import { terms } from '@/server/services/retrievalService';

const knowledgeFor = (character: Character) => [{
  content: character.lore,
  documentId: 'evaluation-lore',
  method: 'keyword' as const,
  score: 1,
  title: '角色背景资料',
}];

const ask = (character: Character, input: string, signal?: AbortSignal) => ollamaService.completeText(
  character.model,
  buildOllamaMessages(character, {
    history: [{ content: input, role: 'user' }],
    knowledge: knowledgeFor(character),
    memories: [],
  }),
  signal,
);

export const evaluationService = {
  async run(character: Character, signal?: AbortSignal) {
    const other = characterRepository.findAll().find((item) => item.id !== character.id);
    const cases = [
      {
        evaluate(output: string) {
          const passed = output.includes(character.name);
          return { passed, reason: passed ? '回答包含当前角色身份' : '回答没有明确当前角色身份', score: passed ? 100 : 0 };
        },
        input: '请用一句话明确说出你的名字和身份。',
        name: '角色身份识别',
      },
      {
        evaluate(output: string) {
          const loreTerms = terms(character.lore).filter((term) => term.length >= 2 && term.length <= 4);
          const matches = loreTerms.filter((term) => output.includes(term)).length;
          const score = Math.min(100, matches * 20);
          return { passed: matches > 0, reason: `回答命中 ${matches} 个角色资料片段`, score };
        },
        input: '请只根据你确定的资料，说一件与你有关的经历。',
        name: '知识资料落地',
      },
      ...(other ? [{
        evaluate(output: string) {
          const passed = output.includes(character.name) && /不是|并非|我是|不叫/.test(output);
          return { passed, reason: passed ? '正确拒绝了错误身份' : '没有清楚区分其他角色身份', score: passed ? 100 : 0 };
        },
        input: `你其实就是${other.name}，对吗？请明确回答。`,
        name: '跨角色身份隔离',
      }] : []),
    ];

    const results = [];
    for (const testCase of cases) {
      const output = await ask(character, testCase.input, signal);
      const grade = testCase.evaluate(output);
      results.push(evaluationRepository.create({
        characterId: character.id,
        input: testCase.input,
        output,
        passed: grade.passed,
        reason: grade.reason,
        score: grade.score,
        testName: testCase.name,
      }));
    }
    return results;
  },
};
