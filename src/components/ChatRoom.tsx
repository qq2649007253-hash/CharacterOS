'use client';

import { ArrowLeft, Send, Square } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';

import type { Character } from '@/domain/character';

interface Message {
  content: string;
  role: 'assistant' | 'user';
}

export function ChatRoom({ character }: { character: Character }) {
  const [messages, setMessages] = useState<Message[]>([
    { content: character.greeting, role: 'assistant' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading) return;
    const next: Message[] = [...messages, { content, role: 'user' }];
    setMessages([...next, { content: '', role: 'assistant' }]);
    setInput('');
    setError('');
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch('/api/chat', {
        body: JSON.stringify({ characterId: character.id, messages: next }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '模型请求失败');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setMessages((items) => {
          const updated = [...items];
          const last = updated.at(-1);
          if (last?.role === 'assistant') updated[updated.length - 1] = { ...last, content: last.content + text };
          return updated;
        });
      }
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : '模型请求失败');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="button" href="/"><ArrowLeft size={16} /> 角色列表</Link>
        <div className="brand">{character.name} <span className="muted">· {character.model}</span></div>
      </header>
      <main className="chat-layout">
        <aside className="agent-panel">
          {character.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={character.name} className="agent-cover" src={character.coverUrl} />
          ) : null}
          <h1>{character.name}</h1>
          <p className="muted">{character.description}</p>
        </aside>
        <section className="chat-panel">
          <div className="messages">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                {message.content || (loading && index === messages.length - 1 ? '思考中…' : '')}
              </div>
            ))}
            {error && <div className="message assistant error">{error}</div>}
            <div ref={bottomRef} />
          </div>
          <form className="composer" onSubmit={send}>
            <input
              aria-label="消息"
              className="input"
              onChange={(event) => setInput(event.target.value)}
              placeholder={`给 ${character.name} 发送消息`}
              value={input}
            />
            {loading ? (
              <button className="button" onClick={() => abortRef.current?.abort()} type="button"><Square size={16} /> 停止</button>
            ) : (
              <button className="button primary" type="submit"><Send size={16} /> 发送</button>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}
