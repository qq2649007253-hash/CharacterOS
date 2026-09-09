import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const target = path.join(root, '.next/standalone/apps/web');
mkdirSync(path.join(target, '.next'), { recursive: true });
cpSync(path.join(root, '.next/static'), path.join(target, '.next/static'), { recursive: true });
cpSync(path.join(root, 'public'), path.join(target, 'public'), { recursive: true });
