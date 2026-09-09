import { build } from 'esbuild';
import { readdir, writeFile } from 'node:fs/promises';
const files = [];
async function walk(dir) {
  for (const item of await readdir(new URL(dir, import.meta.url), { withFileTypes: true })) {
    if (item.isDirectory()) await walk(`${dir}/${item.name}`);
    else if (item.name === 'route.ts') files.push(`${dir}/route.ts`);
  }
}
await walk('./src/routes');
files.sort((a, b) => a.includes('[') - b.includes('[') || b.length - a.length);
await writeFile(new URL('./src/routes.generated.ts', import.meta.url), files.map((f, i) => `import * as r${i} from '${f.replace('./src/', './').replace('.ts', '')}';`).join('\n') + '\nexport const routes = [\n' + files.map((f, i) => `{ path: '/api${f.replace('./src/routes', '').replace('/route.ts', '')}', handlers: r${i} }`).join(',\n') + '\n];\n');
await build({ entryPoints: ['src/main.ts'], bundle: true, outfile: 'dist/server.cjs', platform: 'node', format: 'cjs', target: 'node22', external: ['better-sqlite3'], tsconfig: 'tsconfig.json' });
