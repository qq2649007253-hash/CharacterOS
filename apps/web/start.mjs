import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const entry = fileURLToPath(new URL('./.next/standalone/apps/web/server.js', import.meta.url));
const child = spawn(process.execPath, [entry], { stdio: 'inherit', env: { ...process.env, PORT: process.env.PORT || '3100', HOSTNAME: '127.0.0.1' } });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
