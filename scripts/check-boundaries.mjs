import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
async function scan(directory, rule) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await scan(target, rule);
    else if (/\.tsx?$/.test(entry.name)) assert(!rule.test(await readFile(target, 'utf8')), `Dependency boundary violated: ${target}`);
  }
}
await scan('apps/web/src', /(?:from\s*|import\s*\()['"](?:@\/server|.*services\/api|better-sqlite3|drizzle-orm)/);
await scan('services/api/src', /(?:from\s*|import\s*\()['"](?:next(?:\/|['"])|.*apps\/web)/);
await scan('packages/contracts/src', /(?:from\s*|import\s*\()['"](?:next|react|@\/server|better-sqlite3)/);
console.log('Web, API and shared contract boundaries passed.');
