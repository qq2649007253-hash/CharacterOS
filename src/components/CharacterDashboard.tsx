'use client';

import { ArrowRight, Bot, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';

import type { Character, CharacterInput } from '@/domain/character';

interface ModelStatus {
  error?: string;
  latencyMs: number;
  models: Array<{ name: string }>;
  online: boolean;
}

const initialForm: CharacterInput = {
  avatarUrl: '',
  coverUrl: '',
  description: '',
  greeting: '你好，很高兴认识你。',
  model: 'qwen2.5:7b',
  name: '',
  systemPrompt: '你是一个真诚、可靠的角色助手。请保持人设一致，不确定的事实要坦诚说明。',
};

export function CharacterDashboard() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [status, setStatus] = useState<ModelStatus>();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  const loadCharacters = useCallback(async () => {
    const response = await fetch('/api/characters');
    const data = (await response.json()) as { items: Character[] };
    setCharacters(data.items);
  }, []);

  const checkModels = useCallback(async () => {
    try {
      const response = await fetch('/api/ollama/models', { cache: 'no-store' });
      const data = (await response.json()) as ModelStatus;
      setStatus(data);
      if (data.models[0] && !form.model) setForm((value) => ({ ...value, model: data.models[0].name }));
    } catch {
      setStatus({ error: '无法访问检测接口', latencyMs: 0, models: [], online: false });
    }
  }, [form.model]);

  useEffect(() => {
    // Initial network hydration is intentionally owned by this client dashboard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCharacters();
    checkModels();
  }, [checkModels, loadCharacters]);

  const update = (key: keyof CharacterInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/characters', {
        body: JSON.stringify(form),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '创建失败');
      setForm(initialForm);
      setShowForm(false);
      await loadCharacters();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('确定删除这个角色吗？')) return;
    await fetch(`/api/characters/${id}`, { method: 'DELETE' });
    await loadCharacters();
  };

  return (
    <>
      <div className="toolbar">
        <div className="status">
          <span className={`dot ${status?.online ? 'online' : ''}`} />
          {status?.online
            ? `Ollama 在线 · ${status.models.length} 个模型 · ${status.latencyMs} ms`
            : status?.error || '正在检测 Ollama'}
          <button aria-label="重新检测" className="button" onClick={checkModels} type="button">
            <RefreshCw size={15} />
          </button>
        </div>
        <button className="button primary" onClick={() => setShowForm((value) => !value)} type="button">
          {showForm ? <X size={17} /> : <Plus size={17} />}
          {showForm ? '取消创建' : '创建角色'}
        </button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={submit} style={{ marginBottom: 22 }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="name">角色名称</label>
              <input id="name" className="input" maxLength={64} onChange={(e) => update('name', e.target.value)} required value={form.name} />
            </div>
            <div className="field">
              <label htmlFor="model">Ollama 模型</label>
              <select id="model" className="input" onChange={(e) => update('model', e.target.value)} value={form.model}>
                {(status?.models.length ? status.models : [{ name: 'qwen2.5:7b' }]).map((model) => (
                  <option key={model.name} value={model.name}>{model.name}</option>
                ))}
              </select>
            </div>
            <div className="field wide">
              <label htmlFor="description">一句话介绍</label>
              <input id="description" className="input" maxLength={240} onChange={(e) => update('description', e.target.value)} value={form.description} />
            </div>
            <div className="field">
              <label htmlFor="avatar">头像地址</label>
              <input id="avatar" className="input" onChange={(e) => update('avatarUrl', e.target.value)} placeholder="https://..." value={form.avatarUrl} />
            </div>
            <div className="field">
              <label htmlFor="cover">封面地址</label>
              <input id="cover" className="input" onChange={(e) => update('coverUrl', e.target.value)} placeholder="https://..." value={form.coverUrl} />
            </div>
            <div className="field wide">
              <label htmlFor="greeting">开场白</label>
              <textarea id="greeting" className="input" onChange={(e) => update('greeting', e.target.value)} required value={form.greeting} />
            </div>
            <div className="field wide">
              <label htmlFor="prompt">系统人设</label>
              <textarea id="prompt" className="input" onChange={(e) => update('systemPrompt', e.target.value)} required value={form.systemPrompt} />
            </div>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="button primary" disabled={saving} type="submit">
              <Bot size={17} /> {saving ? '正在创建…' : '保存角色'}
            </button>
          </div>
        </form>
      )}

      {characters.length ? (
        <div className="grid">
          {characters.map((character) => (
            <article className="card character-card" key={character.id}>
              {character.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={character.name} src={character.coverUrl} />
              ) : (
                <div style={{ height: 330, background: 'linear-gradient(145deg,#34265f,#101a36)' }} />
              )}
              <div className="character-overlay">
                <h2>{character.name}</h2>
                <p>{character.description || character.model}</p>
                <div className="actions">
                  <Link className="button primary" href={`/chat/${character.id}`}>
                    开始对话 <ArrowRight size={16} />
                  </Link>
                  <button aria-label="删除角色" className="button danger" onClick={() => remove(character.id)} type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card empty">还没有角色。创建第一个角色，让它通过本地模型开始对话。</div>
      )}
    </>
  );
}
