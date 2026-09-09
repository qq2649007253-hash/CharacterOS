import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
function run(command, args, extra = {}) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...extra }, shell: process.platform === 'win32' });
  children.push(child); return child;
}
const build = run('pnpm', ['build:api']);
build.on('exit', (code) => {
  if (code) return process.exit(code);
  run('node', ['services/api/dist/server.cjs']);
  run('pnpm', ['dev:web'], { CHARACTEROS_API_URL: process.env.CHARACTEROS_API_URL || `http://127.0.0.1:${process.env.API_PORT || 4318}` });
});
function stop() { for (const child of children) { if (child.exitCode === null) { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']); else child.kill(); } } }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
