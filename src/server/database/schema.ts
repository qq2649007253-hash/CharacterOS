import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const characters = sqliteTable('characters', {
  avatarUrl: text('avatar_url').notNull().default(''),
  coverUrl: text('cover_url').notNull().default(''),
  createdAt: text('created_at').notNull(),
  description: text('description').notNull().default(''),
  greeting: text('greeting').notNull(),
  id: text('id').primaryKey(),
  lore: text('lore').notNull().default(''),
  model: text('model').notNull(),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const conversations = sqliteTable('conversations', {
  characterId: text('character_id').notNull(),
  createdAt: text('created_at').notNull(),
  id: text('id').primaryKey(),
  title: text('title').notNull().default('新对话'),
  updatedAt: text('updated_at').notNull(),
});

export const messages = sqliteTable('messages', {
  citationsJson: text('citations_json').notNull().default(''),
  content: text('content').notNull(),
  conversationId: text('conversation_id').notNull(),
  createdAt: text('created_at').notNull(),
  id: text('id').primaryKey(),
  role: text('role', { enum: ['assistant', 'user'] }).notNull(),
});

export const knowledgeDocuments = sqliteTable('knowledge_documents', {
  characterId: text('character_id').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  id: text('id').primaryKey(),
  source: text('source').notNull().default('manual'),
  title: text('title').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const knowledgeChunks = sqliteTable('knowledge_chunks', {
  characterId: text('character_id').notNull(),
  content: text('content').notNull(),
  documentId: text('document_id').notNull(),
  embeddingJson: text('embedding_json').notNull().default(''),
  id: text('id').primaryKey(),
  position: integer('position').notNull(),
  searchText: text('search_text').notNull(),
});

export const memories = sqliteTable('memories', {
  characterId: text('character_id').notNull(),
  confidence: integer('confidence').notNull().default(50),
  content: text('content').notNull(),
  conversationId: text('conversation_id').notNull(),
  createdAt: text('created_at').notNull(),
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['fact', 'preference', 'relationship', 'event'] }).notNull(),
  lastAccessedAt: text('last_accessed_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const notes = sqliteTable('notes', {
  characterId: text('character_id').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  id: text('id').primaryKey(),
  updatedAt: text('updated_at').notNull(),
});

export const toolCalls = sqliteTable('tool_calls', {
  argumentsJson: text('arguments_json').notNull(),
  characterId: text('character_id').notNull(),
  conversationId: text('conversation_id').notNull(),
  createdAt: text('created_at').notNull(),
  error: text('error').notNull().default(''),
  id: text('id').primaryKey(),
  resultJson: text('result_json').notNull().default(''),
  risk: text('risk', { enum: ['low', 'high'] }).notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'rejected', 'failed'] }).notNull(),
  toolName: text('tool_name').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const agentRuns = sqliteTable('agent_runs', {
  characterId: text('character_id').notNull(),
  completedAt: text('completed_at').notNull().default(''),
  conversationId: text('conversation_id').notNull(),
  createdAt: text('created_at').notNull(),
  error: text('error').notNull().default(''),
  id: text('id').primaryKey(),
  input: text('input').notNull(),
  knowledgeHits: integer('knowledge_hits').notNull().default(0),
  latencyMs: integer('latency_ms').notNull().default(0),
  memoryHits: integer('memory_hits').notNull().default(0),
  model: text('model').notNull(),
  output: text('output').notNull().default(''),
  retrievalMethod: text('retrieval_method').notNull().default('none'),
  status: text('status', { enum: ['running', 'awaiting_approval', 'completed', 'rejected', 'failed'] }).notNull(),
  toolCallId: text('tool_call_id').notNull().default(''),
});

export const evaluations = sqliteTable('evaluations', {
  characterId: text('character_id').notNull(),
  createdAt: text('created_at').notNull(),
  id: text('id').primaryKey(),
  input: text('input').notNull(),
  output: text('output').notNull(),
  passed: integer('passed', { mode: 'boolean' }).notNull(),
  reason: text('reason').notNull(),
  score: integer('score').notNull(),
  testName: text('test_name').notNull(),
});
