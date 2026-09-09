'use client';

import { ArrowRight, Bot, Pencil, Play, Plus, RefreshCw, Square, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import type { Character, CharacterInput } from '@characteros/contracts/character';
import { COMPANION_NAMES, LEGACY_CHARACTER_NAMES } from '@characteros/contracts/companions';
import { claimPlayback } from './VoicePlayer';
import { VOICE_ID_PATTERN, resolveOnlineVoice, voiceDisplayName, VOICE_PROFILES } from '@characteros/contracts/voice';

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
  lore: '',
  model: 'qwen2.5:7b',
  name: '',
  systemPrompt: '你是一个真诚、可靠的角色助手。请保持人设一致，不确定的事实要坦诚说明。',
  voiceId: 'zh-CN-XiaoxiaoNeural',
  voiceProfile: 'neutral',
};

export function CharacterDashboard() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showLegacy, setShowLegacy] = useState(false);
  const visibleCharacters = characters.filter((character) => showLegacy || !LEGACY_CHARACTER_NAMES.includes(character.name)).sort((a, b) => {
    const rank = (name: string) => COMPANION_NAMES.includes(name) ? COMPANION_NAMES.indexOf(name) : 100;
    return rank(a.name) - rank(b.name);
  });
  const [status, setStatus] = useState<ModelStatus>();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [voices, setVoices] = useState<string[]>([]);
  const [previewingVoice, setPreviewingVoice] = useState('');
  const previewRef = useRef<{ audio: HTMLAudioElement; url: string }>(null);
  const previewAbortRef = useRef<AbortController | null>(null);

  const loadCharacters = useCallback(async () => {
    setCharactersLoading(true);
    setLoadError('');
    try {
    const response = await fetch('/api/characters');
    if (!response.ok) throw new Error('unavailable');
    const data = (await response.json()) as { items: Character[] };
    setCharacters(data.items || []);
    } catch {
      setLoadError('暂时连接不上角色服务。你的记录仍保存在本机，可以稍后重试。');
    } finally { setCharactersLoading(false); }
  }, []);

  const checkModels = useCallback(async () => {
    try {
      const response = await fetch('/api/ollama/models', { cache: 'no-store' });
      const data = (await response.json()) as ModelStatus;
      setStatus(data);
      if (data.models?.[0]) setForm((value) => value.model ? value : ({ ...value, model: data.models[0].name }));
    } catch {
      setStatus({ error: '无法访问检测接口', latencyMs: 0, models: [], online: false });
    }
  }, []);

  const loadVoices = useCallback(async () => {
    try {
      const response = await fetch('/api/tts', { cache: 'no-store' });
      const data = (await response.json()) as { voices?: string[] };
      setVoices((data.voices || []).filter((voice) => VOICE_ID_PATTERN.test(voice)).sort());
    } catch {
      setVoices([]);
    }
  }, []);

  useEffect(() => {
    // Initial network hydration is intentionally owned by this client dashboard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCharacters();
    checkModels();
    loadVoices();
  }, [checkModels, loadCharacters, loadVoices]);

  useEffect(() => () => {
    previewAbortRef.current?.abort();
    if (previewRef.current) {
      previewRef.current.audio.pause();
      URL.revokeObjectURL(previewRef.current.url);
    }
  }, []);

  const update = <Key extends keyof CharacterInput>(key: Key, value: CharacterInput[Key]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const stopPreview = () => {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewRef.current) {
      previewRef.current.audio.pause();
      previewRef.current.audio.removeAttribute('src');
      URL.revokeObjectURL(previewRef.current.url);
      previewRef.current = null;
    }
    setPreviewingVoice('');
  };

  const previewVoice = async () => {
    const voiceId = resolveOnlineVoice(form.voiceProfile, form.voiceId);
    if (previewingVoice === voiceId) {
      stopPreview();
      return;
    }
    stopPreview();
    claimPlayback(stopPreview);
    setError('');
    setPreviewingVoice(voiceId);
    const controller = new AbortController();
    previewAbortRef.current = controller;
    try {
      const response = await fetch('/api/tts', {
        body: JSON.stringify({
          text: form.greeting.trim() || '你好，很高兴认识你。这是我的声线试听。',
          voiceId,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(95_000)]),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || '声线试听失败');
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if (!blob.type.startsWith('audio/') || blob.size < 44) throw new Error('没有收到完整的语音，请重试。');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewRef.current = { audio, url };
      const finish = () => {
        if (previewRef.current?.audio === audio) {
          URL.revokeObjectURL(url);
          previewRef.current = null;
        }
        setPreviewingVoice('');
      };
      audio.onended = finish;
      audio.onerror = finish;
      await audio.play();
    } catch (caught) {
      if (controller.signal.aborted) return;
      stopPreview();
      setError(caught instanceof Error ? caught.message : '声线试听失败');
    }
  };

  const closeForm = () => {
    stopPreview();
    setForm({ ...initialForm });
    setEditingId('');
    setShowForm(false);
    setError('');
  };

  const createCharacter = () => {
    setForm({ ...initialForm });
    setEditingId('');
    setShowForm(true);
    setError('');
  };

  const editCharacter = (character: Character) => {
    const { createdAt: _createdAt, id, updatedAt: _updatedAt, ...input } = character;
    void _createdAt;
    void _updatedAt;
    setForm({
      ...input,
      voiceId: resolveOnlineVoice(input.voiceProfile, input.voiceId),
    });
    setEditingId(id);
    setShowForm(true);
    setError('');
    window.scrollTo({ behavior: 'smooth', top: 180 });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(editingId ? `/api/characters/${editingId}` : '/api/characters', {
        body: JSON.stringify(form),
        headers: { 'Content-Type': 'application/json' },
        method: editingId ? 'PATCH' : 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (editingId ? '更新失败' : '创建失败'));
      closeForm();
      await loadCharacters();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (editingId ? '更新失败' : '创建失败'));
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
            ? (status.models.length ? '对话服务已就绪' : '尚未安装对话模型')
            : status ? '对话服务未连接，请启动本机 Ollama 后重新检测' : '正在连接对话服务…'}
          <button aria-label="重新检测" className="button" onClick={checkModels} type="button">
            <RefreshCw size={15} />
          </button>
        </div>
        <button className="button primary" onClick={() => (showForm ? closeForm() : createCharacter())} type="button">
          {showForm ? <X size={17} /> : <Plus size={17} />}
          {showForm ? (editingId ? '取消编辑' : '取消创建') : '创建角色'}
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
              <label htmlFor="voiceProfile">声线风格与语速</label>
              <select
                id="voiceProfile"
                className="input"
                onChange={(event) => update('voiceProfile', event.target.value as CharacterInput['voiceProfile'])}
                value={form.voiceProfile}
              >
                {Object.entries(VOICE_PROFILES).map(([id, profile]) => (
                  <option key={id} value={id}>{profile.label} · {profile.description}</option>
                ))}
              </select>
            </div>
            <div className="field wide">
              <label htmlFor="voiceId">具体中文女声（可逐个试听）</label>
              <div className="voice-picker">
                <select
                  id="voiceId"
                  className="input"
                  onChange={(event) => update('voiceId', event.target.value)}
                  value={resolveOnlineVoice(form.voiceProfile, form.voiceId)}
                >
                  {(voices.length ? voices : [resolveOnlineVoice(form.voiceProfile, form.voiceId)]).map((voice) => (
                    <option key={voice} value={voice}>{voiceDisplayName(voice)} · {voice}</option>
                  ))}
                </select>
                <button className="button" onClick={() => void previewVoice()} type="button">
                  {previewingVoice ? <Square size={15} /> : <Play size={15} />}
                  {previewingVoice ? '停止试听' : '试听开场白'}
                </button>
              </div>
              <span className="field-hint">建议所有角色使用同一句开场白对比，选出最接近的音色后保存。</span>
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
              <Bot size={17} /> {saving ? (editingId ? '正在保存…' : '正在创建…') : '保存角色'}
            </button>
          </div>
        </form>
      )}

      {characters.some((character) => LEGACY_CHARACTER_NAMES.includes(character.name)) ? <label className="legacy-toggle"><input type="checkbox" checked={showLegacy} onChange={(event) => setShowLegacy(event.target.checked)} /> 显示原有角色与历史对话</label> : null}
      {loadError ? <div className="card empty" role="alert"><p>{loadError}</p><button className="button" onClick={() => void loadCharacters()} type="button">重新连接</button></div> : charactersLoading ? <div className="card empty" role="status">正在整理你的角色…</div> : visibleCharacters.length ? (
        <div className="grid">
          {visibleCharacters.map((character) => (
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
                <span className="card-voice-label">
                  {VOICE_PROFILES[character.voiceProfile].label} · 私密陪伴
                </span>
                <div className="actions">
                  <Link className="button primary" href={`/chat/${character.id}`}>
                    开始对话 <ArrowRight size={16} />
                  </Link>
                  <button aria-label={`编辑${character.name}`} className="button" onClick={() => editCharacter(character)} type="button">
                    <Pencil size={16} />
                  </button>
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

