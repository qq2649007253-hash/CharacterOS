import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import * as schema from './schema';

const dataDirectory = path.resolve(process.cwd(), 'data');
mkdirSync(dataDirectory, { recursive: true });

const sqlite = new Database(path.join(dataDirectory, 'characteros.db'));
sqlite.pragma('journal_mode = WAL');
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    cover_url TEXT NOT NULL DEFAULT '',
    greeting TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

export const database = drizzle(sqlite, { schema });
