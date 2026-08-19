import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import * as schema from './schema';

const dataDirectory = path.resolve(process.cwd(), 'data');
mkdirSync(dataDirectory, { recursive: true });

const sqlite = new Database(path.join(dataDirectory, 'characteros.db'));
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    cover_url TEXT NOT NULL DEFAULT '',
    greeting TEXT NOT NULL,
    lore TEXT NOT NULL DEFAULT '',
    system_prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '新对话',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('assistant', 'user')),
    content TEXT NOT NULL,
    citations_json TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    content TEXT NOT NULL,
    search_text TEXT NOT NULL,
    embedding_json TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('fact', 'preference', 'relationship', 'event')),
    content TEXT NOT NULL,
    confidence INTEGER NOT NULL DEFAULT 50,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_accessed_at TEXT NOT NULL,
    FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS tool_calls (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    arguments_json TEXT NOT NULL,
    risk TEXT NOT NULL CHECK(risk IN ('low', 'high')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'rejected', 'failed')),
    result_json TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS conversations_character_idx ON conversations(character_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS knowledge_chunks_character_idx ON knowledge_chunks(character_id);
  CREATE INDEX IF NOT EXISTS memories_character_idx ON memories(character_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS notes_character_idx ON notes(character_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS tool_calls_conversation_idx ON tool_calls(conversation_id, created_at);
`);

const characterColumns = sqlite.pragma('table_info(characters)') as Array<{ name: string }>;
if (!characterColumns.some((column) => column.name === 'lore')) {
  sqlite.exec("ALTER TABLE characters ADD COLUMN lore TEXT NOT NULL DEFAULT ''");
}

const messageColumns = sqlite.pragma('table_info(messages)') as Array<{ name: string }>;
if (!messageColumns.some((column) => column.name === 'citations_json')) {
  sqlite.exec("ALTER TABLE messages ADD COLUMN citations_json TEXT NOT NULL DEFAULT ''");
}

const knowledgeChunkColumns = sqlite.pragma('table_info(knowledge_chunks)') as Array<{ name: string }>;
if (!knowledgeChunkColumns.some((column) => column.name === 'embedding_json')) {
  sqlite.exec("ALTER TABLE knowledge_chunks ADD COLUMN embedding_json TEXT NOT NULL DEFAULT ''");
}

export const database = drizzle(sqlite, { schema });
