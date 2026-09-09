'use client';

import { useEffect, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';

// One playback owner across messages. Switching messages cancels pending synthesis too.
let stopActive: (() => void) | undefined;
let mediaOwner: HTMLAudioElement | undefined;
export function claimPlayback(stop: () => void, owner?: HTMLAudioElement) {
  if (owner && mediaOwner === owner) return;
  stopActive?.(); stopActive = stop; mediaOwner = owner;
}
export function VoicePlayer({ text, characterId }: { text: string; characterId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState('');
  const stopRef = useRef<(() => void) | undefined>(undefined);
  const cachedAudio = useRef<Blob | undefined>(undefined);
  useEffect(() => () => { stopRef.current?.(); cachedAudio.current = undefined; }, [text, characterId]);
  async function play() {
    if (state !== 'idle') { stopRef.current?.(); return; }
    stopActive?.();
    const controller = new AbortController();
    let audio: HTMLAudioElement | undefined;
    let objectUrl: string | undefined;
    let stopped = false;
    const stop = () => {
      stopped = true; controller.abort();
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (stopActive === stop) stopActive = undefined;
      setState('idle');
    };
    stopRef.current = stop; claimPlayback(stop);
    setError(''); setState('loading');
    try {
      let blob = cachedAudio.current;
      if (!blob) {
      const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ characterId, text }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(95_000)]) });
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || '语音暂时不可用，请稍后重试。'); }
      blob = await response.blob();
      if (stopped) return;
      if (!blob.type.startsWith('audio/') || blob.size < 44) throw new Error('没有收到完整语音，请重试。');
      cachedAudio.current = blob;
      }
      objectUrl = URL.createObjectURL(blob); audio = new Audio(objectUrl);
      audio.onended = stop;
      audio.onerror = () => { setError('这段语音播放失败，请重试。'); stop(); };
      await audio.play();
      if (!stopped) setState('playing');
    } catch (reason) {
      if (!stopped) setError(reason instanceof Error ? reason.message : '语音暂时不可用');
      stop();
    }
  }
  return <div className="voice-player"><button type="button" className="message-voice" onClick={() => void play()} aria-label={state === 'idle' ? '听这段回复' : '停止语音'}>{state === 'idle' ? <Volume2 size={14} /> : <Square size={14} />}{state === 'loading' ? '准备语音 · 点击取消' : state === 'playing' ? '停止播放' : '听这段回复'}</button>{error ? <p role="alert" className="error">{error}</p> : null}</div>;
}
