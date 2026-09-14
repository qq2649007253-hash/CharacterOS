'use client';

import { ArrowLeft, BookOpen, Brain, Check, MessageSquarePlus, Plus, Send, Square, Wrench, X } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';

import type { Character } from '@characteros/contracts/character';
import { AccountMenu } from './AuthGate';
import { VoicePlayer } from './VoicePlayer';
import type { ConversationPage, Conversation, MessageCitation, PersistedMessage } from '@characteros/contracts/conversation';
import type { KnowledgeDocument } from '@characteros/contracts/knowledge';
import type { ToolCallRecord } from '@characteros/contracts/tool';

type Message = Pick<PersistedMessage, 'citationsJson' | 'content' | 'role'>;

const parseCitations = (value: string): MessageCitation[] => {
  try { return value ? JSON.parse(value) as MessageCitation[] : []; } catch { return []; }
};

const decodeCitationsHeader = (value: string | null) => {
  if (!value) return '';
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return ''; }
};

export function ChatRoom({ character }: { character: Character }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState('');
  const pageRef = useRef<AbortController | null>(null);
  useEffect(() => () => pageRef.current?.abort(), []);
  const loadMore = async () => {
    if (!nextCursor || pageRef.current) return;
    const controller = new AbortController(); pageRef.current = controller;
    setLoadingMore(true); setPageError('');
    try {
      const params = new URLSearchParams({ characterId: character.id, limit: '20', cursor: nextCursor });
      const response = await fetch('/api/conversations?' + params, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('加载失败，请重试');
      const data: ConversationPage = await response.json();
      if (controller.signal.aborted) return;
      setConversations(items => { const ids = new Set(items.map(item => item.id)); return [...items, ...data.conversations.filter(item => !ids.has(item.id))]; });
      setNextCursor(data.nextCursor);
    } catch { if (!controller.signal.aborted) setPageError('历史对话加载失败，请重试。'); }
    finally { if (!controller.signal.aborted) setLoadingMore(false); if (pageRef.current === controller) pageRef.current = null; }
  };
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
  const [knowledgeIndex, setKnowledgeIndex] = useState({ embedded: 0, model: 'embeddinggemma', total: 0 });
  const [indexingKnowledge, setIndexingKnowledge] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [processingToolCall, setProcessingToolCall] = useState('');
  const abortRef = useRef<AbortController>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const restoreRef = useRef<AbortController | null>(null);
  const creatingRef = useRef(false);
  useEffect(() => () => { abortRef.current?.abort(); restoreRef.current?.abort(); }, []);
  const loadConversation = async (id: string) => {
    if (abortRef.current) return;
    restoreRef.current?.abort();
    const controller = new AbortController();
    restoreRef.current = controller;
    setRestoring(true);
    setError('');
    try {
    const response = await fetch(`/api/conversations/${id}`, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('恢复会话失败');
    const data = (await response.json()) as { messages: PersistedMessage[]; toolCalls: ToolCallRecord[] };
    if (controller.signal.aborted) return;
    setConversationId(id);
    setMessages(data.messages.map(({ citationsJson, content, role }) => ({ citationsJson, content, role })));
    setToolCalls(data.toolCalls);
    } catch {
      if (!controller.signal.aborted) setError('暂时无法读取这段对话，请重新选择会话再试。');
    } finally {
      if (restoreRef.current === controller) { setRestoring(false); restoreRef.current = null; }
    }
  };

  const createConversation = async () => {
    if (creatingRef.current || abortRef.current) return;
    creatingRef.current = true;
    setRestoring(true);
    try {
    const response = await fetch('/api/conversations', {
      body: JSON.stringify({ characterId: character.id }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok) throw new Error('创建会话失败');
    const data = (await response.json()) as { conversation: Conversation };
    setConversations((items) => [data.conversation, ...items]);
    await loadConversation(data.conversation.id);
    } catch { setError('新对话暂时无法创建，请稍后再试。'); }
    finally { creatingRef.current = false; setRestoring(false); }
  };

  const refreshContextData = async () => {
    const [knowledgeResponse, memoryResponse] = await Promise.all([
      fetch(`/api/characters/${character.id}/knowledge`, { cache: 'no-store' }),
      fetch(`/api/characters/${character.id}/memories`, { cache: 'no-store' }),
    ]);
    if (knowledgeResponse.ok) {
      const data = (await knowledgeResponse.json()) as {
        documents: KnowledgeDocument[];
        index: { embedded: number; model: string; total: number };
      };
      setDocuments(data.documents);
      setKnowledgeIndex(data.index);
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

  const rebuildKnowledgeIndex = async () => {
    setIndexingKnowledge(true);
    setError('');
    try {
      const response = await fetch(`/api/characters/${character.id}/knowledge/index`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '向量索引创建失败，请先在 Ollama 安装 embeddinggemma');
      await refreshContextData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '向量索引创建失败');
    } finally {
      setIndexingKnowledge(false);
    }
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const initialize = async () => {
      try {
        const response = await fetch(`/api/conversations?characterId=${encodeURIComponent(character.id)}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('读取会话失败');
        const data = (await response.json()) as ConversationPage;
        setConversations(data.conversations);
        setNextCursor(data.nextCursor);
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const reviewToolCall = async (id: string, action: 'approve' | 'reject') => {
    setProcessingToolCall(id);
    setError('');
    try {
      const response = await fetch(`/api/tool-calls/${id}`, {
        body: JSON.stringify({ action }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '审批操作失败');
      await loadConversation(conversationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '审批操作失败');
    } finally {
      setProcessingToolCall('');
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading || restoring || abortRef.current || !conversationId) return;
    setMessages((items) => [
      ...items,
      { citationsJson: '', content, role: 'user' },
      { citationsJson: '', content: '', role: 'assistant' },
    ]);
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
      const responseCitations = decodeCitationsHeader(response.headers.get('X-Knowledge-Sources'));
      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = (await response.json()) as {
          message: string;
          toolCall?: ToolCallRecord;
          type?: string;
        };
        setMessages((items) => {
          const updated = [...items];
          updated[updated.length - 1] = { citationsJson: '', content: data.message, role: 'assistant' };
          return updated;
        });
        if (data.toolCall) setToolCalls((items) => [...items, data.toolCall as ToolCallRecord]);
        setConversations((items) => items.map((item) => (
          item.id === conversationId && item.title === '新对话'
            ? { ...item, title: content.replace(/\s+/g, ' ').slice(0, 24) }
            : item
        )));
        return;
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
          if (last?.role === 'assistant') updated[updated.length - 1] = {
            ...last,
            citationsJson: responseCitations,
            content: last.content + text,
          };
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
        <div className="topbar-actions">
          <AccountMenu /><div className="chat-title">{character.name} <span className="muted">· 陪你慢慢聊</span></div>
        </div>
      </header>
      <main className="chat-layout">
        <aside className="agent-panel">
          {character.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={character.name} className="agent-cover" src={character.coverUrl} />
          ) : null}
          <h1>{character.name}</h1>
          <p className="muted">{character.description}</p>
          <button className="button primary full-button" disabled={loading || restoring} onClick={() => void createConversation()} type="button">
            <MessageSquarePlus size={16} /> 新对话
          </button>
          <div className="conversation-list">
            {conversations.map((conversation) => (
              <button
                className={`conversation-item ${conversation.id === conversationId ? 'active' : ''}`}
                disabled={loading || restoring}
                key={conversation.id}
                onClick={() => void loadConversation(conversation.id)}
                type="button"
              >
                {conversation.title}
              </button>
            ))}
          </div>
          {nextCursor && <button className="button full-button" disabled={loadingMore || loading || restoring} onClick={() => void loadMore()} type="button">{loadingMore ? '正在加载…' : '加载更多对话'}</button>}
          {pageError && <p className="error" role="alert">{pageError}</p>}
          {!nextCursor && conversations.length > 0 && <p className="index-status">已显示全部对话</p>}
          <div className="context-status">
            <span><BookOpen size={14} /> 本轮知识 {contextStats.knowledge} 条 · 共 {documents.length} 份</span>
            <span><Brain size={14} /> 本轮记忆 {contextStats.memories} 条 · 共 {memories.length} 条</span>
          </div>
          <details className="context-details">
            <summary><BookOpen size={14} /> 管理知识库</summary>
            <div className="context-items">
              {documents.map((document) => <span key={document.id}>{document.title}</span>)}
            </div>
            <p className="index-status">向量索引 {knowledgeIndex.embedded}/{knowledgeIndex.total} · {knowledgeIndex.model}</p>
            <button className="button" disabled={indexingKnowledge} onClick={() => void rebuildKnowledgeIndex()} type="button">
              {indexingKnowledge ? '正在索引…' : '重建向量索引'}
            </button>
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
          <p className="voice-disclosure">在线朗读会将待朗读文字发送给微软；文字聊天与记忆仍保存在本机。</p>
          <div className="messages">
            {restoring ? <div className="message assistant">正在恢复会话…</div> : null}
            {messages.map((message, index) => {
              return (
                <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="message-content">{message.content || (loading && index === messages.length - 1 ? '思考中…' : '')}</div>
                {parseCitations(message.citationsJson).length ? (
                  <div className="message-citations">
                    {parseCitations(message.citationsJson).map((citation) => (
                      <span key={citation.documentId}>来源：{citation.title} · {citation.score.toFixed(2)}</span>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.content && !(loading && index === messages.length - 1) ? (
                  <div className="message-actions">
                    <VoicePlayer key={`${character.id}-${conversationId}-${index}`} characterId={character.id} text={message.content} />

                  </div>
                ) : null}

                </div>
              );
            })}
            {toolCalls.map((toolCall) => {
              let arguments_: Record<string, unknown> = {};
              try { arguments_ = JSON.parse(toolCall.argumentsJson) as Record<string, unknown>; } catch {}
              return (
                <div className={`tool-call-card ${toolCall.status}`} key={toolCall.id}>
                  <div className="tool-call-heading">
                    <span><Wrench size={15} /> {toolCall.toolName}</span>
                    <strong>{toolCall.status}</strong>
                  </div>
                  <code>{JSON.stringify(arguments_, null, 2)}</code>
                  {toolCall.resultJson ? <p>执行结果：{toolCall.resultJson}</p> : null}
                  {toolCall.error ? <p className="error">错误：{toolCall.error}</p> : null}
                  {toolCall.status === 'pending' ? (
                    <div className="tool-call-actions">
                      <button
                        className="button primary"
                        disabled={processingToolCall === toolCall.id}
                        onClick={() => void reviewToolCall(toolCall.id, 'approve')}
                        type="button"
                      ><Check size={15} /> 批准执行</button>
                      <button
                        className="button danger"
                        disabled={processingToolCall === toolCall.id}
                        onClick={() => void reviewToolCall(toolCall.id, 'reject')}
                        type="button"
                      ><X size={15} /> 拒绝</button>
                    </div>
                  ) : null}
                </div>
              );
            })}
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
              <button className="button primary" disabled={restoring || !input.trim() || !conversationId} type="submit"><Send size={16} /> 发送</button>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}

