'use client';
import { useState } from 'react';
import type { Character, CharacterInput } from '@characteros/contracts/character';
import { characterInputSchema } from '@characteros/contracts/character';
export function ShareCharacter({ character }: { character: Character }) {
  const [open, setOpen] = useState(false); const [token, setToken] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function change(method: string) {
    setBusy(true); setError('');
    try { const r = await fetch(`/api/characters/${character.id}/share`, { method, headers: { 'Content-Type': 'application/json' }, ...(method !== 'GET' ? { body: '{}' } : {}) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setToken(d.token || ''); } catch(e) { setError(e instanceof Error ? e.message : '分享失败'); } finally { setBusy(false); }
  }
  function exportFile() {
    const snapshot = characterInputSchema.parse(character);
    const blob = new Blob([JSON.stringify({ format: 'characteros-character-v1', character: snapshot }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${character.name.replace(/[\\/:*?"<>|]/g,'_')}.character.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="character-sharing"><button className="button" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) void change('GET'); }} type="button">分享角色</button>{open && <div className="share-panel"><p>将分享人设、背景、开场白、图片地址和声线。请确认人设中没有私人内容；聊天、记忆和知识库不会包含在内。</p><button className="button" disabled={busy} type="button" onClick={() => void change('POST')}>{token ? '更新分享（旧链接失效）' : '生成分享链接'}</button>{token && <><label className="field">分享链接<input className="input" readOnly value={`${window.location.origin}/?share=${token}`} onFocus={e => e.currentTarget.select()} /></label><button className="button" disabled={busy} onClick={() => void change('DELETE')} type="button">停止分享</button></>}<p>链接限连接同一服务的账号使用。发给其他电脑，请导出角色文件。</p><button className="button" type="button" onClick={exportFile}>导出角色文件</button><p>已导出的文件及对方添加的副本无法撤回；自定义图片地址需在对方设备可访问。</p>{error && <p className="error" role="alert">{error}</p>}</div>}</div>;
}
export function ImportCharacter({ onImported }: { onImported: () => Promise<void> }) {
  const [code, setCode] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('share') || ''); const [preview, setPreview] = useState<CharacterInput | null>(null); const [activeToken, setActiveToken] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');

  async function inspect() {
    setBusy(true); setError(''); setPreview(null); setActiveToken('');
    try { let token = code.trim(); if (token.includes('://')) token = new URL(token).searchParams.get('share') || ''; if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new Error('请输入有效的分享链接或分享码'); const r = await fetch(`/api/shares/${token}`); const d = await r.json(); if (!r.ok) throw new Error(d.error); setPreview(characterInputSchema.parse(d.character)); setActiveToken(token); } catch(e) { setError(e instanceof Error ? e.message : '读取失败'); } finally { setBusy(false); }
  }
  async function add() {
    if (!preview) return; setBusy(true); setError('');
    try { const r = await fetch(activeToken ? `/api/shares/${activeToken}` : '/api/characters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activeToken ? {} : preview) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setPreview(null); setCode(''); setActiveToken(''); await onImported(); } catch(e) { setError(e instanceof Error ? e.message : '添加失败'); } finally { setBusy(false); }
  }
  return <details className="import-panel" open={code ? true : undefined}><summary>添加朋友分享的角色</summary><p className="muted">添加后成为你的独立副本，对话从头开始。</p><div className="voice-picker"><input className="input" aria-label="角色分享链接或分享码" placeholder="粘贴分享链接或分享码" value={code} onChange={e => setCode(e.target.value)} /><button className="button" disabled={busy} onClick={() => void inspect()} type="button">预览</button></div><label className="field">或选择角色文件<input type="file" accept=".json,application/json" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setBusy(true); setError(''); setPreview(null); setActiveToken(''); try { if (file.size > 100000) throw new Error('角色文件不能超过 100 KB'); const data = JSON.parse(await file.text()); if (data.format !== 'characteros-character-v1') throw new Error('不是 CharacterOS 角色文件'); setPreview(characterInputSchema.parse(data.character)); } catch { setError('角色文件格式无效，或超过 100 KB'); } finally { setBusy(false); } }} /></label>{preview && <div className="share-panel"><h3>{preview.name}</h3><p>{preview.description}</p><p>{preview.greeting}</p><details><summary>查看完整人设</summary><p style={{ whiteSpace: 'pre-wrap' }}>{preview.systemPrompt}</p><p>{preview.lore}</p><p>模型：{preview.model} · 声线：{preview.voiceId}</p></details><button className="button primary" disabled={busy} onClick={() => void add()} type="button">添加到我的角色</button></div>}{error && <p className="error" role="alert">{error}</p>}</details>;
}
