import { AsyncLocalStorage } from 'node:async_hooks';
export type User = { id: string; username: string; role: 'admin' | 'user'; disabled: number };
export const identity = new AsyncLocalStorage<User>();
export function ownerId() { const user = identity.getStore(); if (!user) throw new Error('Missing authenticated identity'); return user.id; }
