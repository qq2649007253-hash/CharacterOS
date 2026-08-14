'use client';

import { ArrowLeft, BookOpen, Brain, MessageSquarePlus, Plus, Send, Square } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';

import type { Character } from '@/domain/character';
import type { Conversation, PersistedMessage } from '@/domain/conversation';
import type { KnowledgeDocument } from '@/domain/knowledge';

type Message = Pick<PersistedMessage, 'content' | 'role'>;

export function ChatRoom({ character }: { character: Character }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState('');
  const [contextStats, setContextStats] = useState({ knowledge: 0, memories: 0 });
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [memories, setMemories] = useState<Array<{ content: string; id: string; kind: string }>>([]);
  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [knowledgeContent, setKnowledgeContent] = useState('');
  const abortRef = useRef<AbortController>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const loadConversation = async (id: string) => {
    setRestoring(true);
    const response = await fetch(`/api/conversations/${id}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('恢复会话失败');
    const data = (await response.json()) as { messages: PersistedMessage[] };
    setConversationId(id);
    setMessages(data.messages.map(({ content, role }) => ({ content, role })));
    setRestoring(false);
  };

  const createConversation = async () => {
    const response = await fetch('/api/conversations', {
      body: JSON.stringify({ characterId: character.id }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok) throw new Error('创建会话失败');
    const data = (await response.json()) as { conversation: Conversation };
    setConversations((items) => [data.conversation, ...items]);
    await loadConversation(data.conversation.id);
  };

  const refreshContextData = async () => {
    const [knowledgeResponse, memoryResponse] = await Promise.all([
      fetch(`/api/characters/${character.id}/knowledge`, { cache: 'no-store' }),
      fetch(`/api/characters/${character.id}/memories`, { cache: 'no-store' }),
    ]);
    if (knowledgeResponse.ok) {
      const data = (await knowledgeResponse.json()) as { documents: KnowledgeDocument[] };
      setDocuments(data.documents);
    }
    if (memoryResponse.ok) {
      const data = (await memoryResponse.json()) as { memories: Array<{ content: string; id: string; kind: string }> };
      setMemories(data.memories);
    }
  };

  const addKnowledge = async (event: FormEvent) => {
    event.preventDefault();
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) return;
    const response = await fetch(`/api/characters/${character.id}/knowledge`, {
      body: JSON.stringify({ content: knowledgeContent, title: knowledgeTitle }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok) {
      setError('添加知识资料失败');
      return;
    }
    setKnowledgeTitle('');
    setKnowledgeContent('');
    await refreshContextData();
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const initialize = async () => {
      try {
        const response = await fetch(`/api/conversations?characterId=${encodeURIComponent(character.id)}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('读取会话失败');
        const data = (await response.json()) as { conversations: Conversation[] };
        setConversations(data.conversations);
        await refreshContextData();
        if (data.conversations[0]) await loadConversation(data.conversations[0].id);
        else await createConversation();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '读取会话失败');
        setRestoring(false);
      }
    };
    void initialize();
    // 初始化只执行一次；这些函数依赖当前角色且在该页面生命周期内不变化。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading || !conversationId) return;
    setMessages((items) => [...items, { content, role: 'user' }, { content: '', role: 'assistant' }]);
    setInput('');
    setError('');
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch('/api/chat', {
        body: JSON.stringify({ characterId: character.id, content, conversationId }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '模型请求失败');
      }
      setContextStats({
        knowledge: Number(response.headers.get('X-Knowledge-Hits') || 0),
        memories: Number(response.headers.get('X-Memory-Hits') || 0),
      });
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
      setConversations((items) => items.map((item) => (
        item.id === conversationId && item.title === '新对话'
          ? { ...item, title: content.replace(/\s+/g, ' ').slice(0, 24) }
          : item
      )));
      await refreshContextData();
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
          <button className="button primary full-button" onClick={() => void createConversation()} type="button">
            <MessageSquarePlus size={16} /> 新对话
          </button>
          <div className="conversation-list">
            {conversations.map((conversation) => (
              <button
                className={`conversation-item ${conversation.id === conversationId ? 'active' : ''}`}
                key={conversation.id}
                onClick={() => void loadConversation(conversation.id)}
                type="button"
              >
                {conversation.title}
              </button>
            ))}
          </div>
          <div className="context-status">
            <span><BookOpen size={14} /> 本轮知识 {contextStats.knowledge} 条 · 共 {documents.length} 份</span>
            <span><Brain size={14} /> 本轮记忆 {contextStats.memories} 条 · 共 {memories.length} 条</span>
          </div>
          <details className="context-details">
            <summary><BookOpen size={14} /> 管理知识库</summary>
            <div className="context-items">
              {documents.map((document) => <span key={document.id}>{document.title}</span>)}
            </div>
            <form className="mini-form" onSubmit={addKnowledge}>
              <input className="input" onChange={(event) => setKnowledgeTitle(event.target.value)} placeholder="资料标题" value={knowledgeTitle} />
              <textarea className="input" onChange={(event) => setKnowledgeContent(event.target.value)} placeholder="粘贴角色设定、世界观或剧情资料" value={knowledgeContent} />
              <button className="button" type="submit"><Plus size={14} /> 添加资料</button>
            </form>
          </details>
          <details className="context-details">
            <summary><Brain size={14} /> 查看长期记忆</summary>
            <div className="memory-items">
              {memories.length ? memories.map((memory) => <span key={memory.id}>[{memory.kind}] {memory.content}</span>) : <span>还没有形成长期记忆</span>}
            </div>
          </details>
        </aside>
        <section className="chat-panel">
          <div className="messages">
            {restoring ? <div className="message assistant">正在恢复会话…</div> : null}
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
              disabled={restoring}
              onChange={(event) => setInput(event.target.value)}
              placeholder={`给 ${character.name} 发送消息`}
              value={input}
            />
            {loading ? (
              <button className="button" onClick={() => abortRef.current?.abort()} type="button"><Square size={16} /> 停止</button>
            ) : (
              <button className="button primary" disabled={restoring} type="submit"><Send size={16} /> 发送</button>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}
