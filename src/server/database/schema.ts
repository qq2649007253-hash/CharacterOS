import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const characters = sqliteTable('characters', {
  avatarUrl: text('avatar_url').notNull().default(''),
  coverUrl: text('cover_url').notNull().default(''),
  createdAt: text('created_at').notNull(),
  description: text('description').notNull().default(''),
  greeting: text('greeting').notNull(),
  id: text('id').primaryKey(),
  model: text('model').notNull(),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  updatedAt: text('updated_at').notNull(),
});
