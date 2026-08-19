'use client';

import { Activity, CheckCircle2, Gauge, Play, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Character } from '@/domain/character';
import type { AgentRun, EvaluationRecord } from '@/domain/observability';

export function DebugDashboard() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterId, setCharacterId] = useState('');
  const [runningEvaluation, setRunningEvaluation] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [runResponse, evaluationResponse, characterResponse] = await Promise.all([
      fetch('/api/observability/runs', { cache: 'no-store' }),
      fetch('/api/evaluations', { cache: 'no-store' }),
      fetch('/api/characters', { cache: 'no-store' }),
    ]);
    const runData = (await runResponse.json()) as { runs: AgentRun[] };
    const evaluationData = (await evaluationResponse.json()) as { evaluations: EvaluationRecord[] };
    const characterData = (await characterResponse.json()) as { items: Character[] };
    setRuns(runData.runs);
    setEvaluations(evaluationData.evaluations);
    setCharacters(characterData.items);
    setCharacterId((current) => current || characterData.items[0]?.id || '');
  }, []);

  useEffect(() => {
    // Initial dashboard hydration is intentionally owned by this client view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const finished = runs.filter((run) => run.status === 'completed');
    return {
      averageLatency: finished.length ? Math.round(finished.reduce((sum, run) => sum + run.latencyMs, 0) / finished.length) : 0,
      completed: finished.length,
      failed: runs.filter((run) => run.status === 'failed').length,
      passRate: evaluations.length ? Math.round(evaluations.filter((item) => item.passed).length / evaluations.length * 100) : 0,
    };
  }, [evaluations, runs]);

  const runEvaluation = async () => {
    if (!characterId) return;
    setRunningEvaluation(true);
    setError('');
    try {
      const response = await fetch('/api/evaluations', {
        body: JSON.stringify({ characterId }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '评测运行失败');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '评测运行失败');
    } finally {
      setRunningEvaluation(false);
    }
  };

  return (
    <main className="container debug-page">
      <section className="hero compact-hero">
        <div className="eyebrow">Agent Observability</div>
        <h1>调试与评测中心</h1>
        <p>查看每轮检索、记忆、工具调用和模型执行状态，并运行角色一致性回归测试。</p>
      </section>

      <div className="metric-grid">
        <div className="metric-card"><Activity size={18} /><strong>{stats.completed}</strong><span>成功运行</span></div>
        <div className="metric-card"><XCircle size={18} /><strong>{stats.failed}</strong><span>失败运行</span></div>
        <div className="metric-card"><Gauge size={18} /><strong>{stats.averageLatency} ms</strong><span>平均延迟</span></div>
        <div className="metric-card"><CheckCircle2 size={18} /><strong>{stats.passRate}%</strong><span>评测通过率</span></div>
      </div>

      <section className="debug-section">
        <div className="debug-section-heading">
          <div><h2>角色回归评测</h2><p>身份识别、知识落地与跨角色隔离</p></div>
          <div className="debug-actions">
            <select className="input" onChange={(event) => setCharacterId(event.target.value)} value={characterId}>
              {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
            </select>
            <button className="button primary" disabled={!characterId || runningEvaluation} onClick={() => void runEvaluation()} type="button">
              <Play size={15} /> {runningEvaluation ? '评测中…' : '运行评测'}
            </button>
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="debug-list">
          {evaluations.slice(0, 12).map((evaluation) => (
            <article className="debug-row" key={evaluation.id}>
              <span className={`result-badge ${evaluation.passed ? 'pass' : 'fail'}`}>{evaluation.passed ? 'PASS' : 'FAIL'}</span>
              <div><strong>{evaluation.testName}</strong><p>{evaluation.reason}</p></div>
              <b>{evaluation.score}</b>
            </article>
          ))}
          {!evaluations.length ? <div className="empty compact-empty">还没有评测记录。</div> : null}
        </div>
      </section>

      <section className="debug-section">
        <div className="debug-section-heading">
          <div><h2>最近运行轨迹</h2><p>模型、检索、记忆、工具与错误链路</p></div>
          <button aria-label="刷新" className="button" onClick={() => void refresh()} type="button"><RefreshCw size={15} /> 刷新</button>
        </div>
        <div className="debug-list">
          {runs.map((run) => (
            <article className="run-card" key={run.id}>
              <div className="run-card-heading">
                <span className={`result-badge ${run.status === 'completed' ? 'pass' : run.status === 'failed' ? 'fail' : ''}`}>{run.status}</span>
                <strong>{run.model}</strong>
                <time>{new Date(run.createdAt).toLocaleString('zh-CN')}</time>
              </div>
              <p>{run.input}</p>
              <div className="run-meta">
                <span>耗时 {run.latencyMs} ms</span><span>知识 {run.knowledgeHits}</span><span>记忆 {run.memoryHits}</span>
                <span>检索 {run.retrievalMethod}</span><span>工具 {run.toolCallId ? '是' : '否'}</span>
              </div>
              {run.error ? <p className="error">{run.error}</p> : null}
            </article>
          ))}
          {!runs.length ? <div className="empty compact-empty">发送一条消息后，这里会出现第一条运行轨迹。</div> : null}
        </div>
      </section>
    </main>
  );
}
