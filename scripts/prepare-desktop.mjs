import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const projectRoot = process.cwd();
const tracingRoot = path.join(projectRoot, 'apps/web/.next/standalone');
const standaloneRoot = path.join(tracingRoot, 'apps/web');
const staticSource = path.join(projectRoot, 'apps/web/.next/static');
const staticTarget = path.join(standaloneRoot, '.next', 'static');
const runtimeDirectory = path.join(projectRoot, 'apps/desktop/runtime');
const packagedServerDirectory = path.join(runtimeDirectory, 'app-server');
const packagedModulesDirectory = path.join(packagedServerDirectory, 'server_modules');
const standalonePnpmDirectory = path.join(tracingRoot, 'node_modules', '.pnpm');
const safeRemove = (target) => {
  const relative = path.relative(projectRoot, path.resolve(target));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe cleanup target');
  rmSync(target, { force: true, recursive: true });
};

if (!existsSync(path.join(standaloneRoot, 'server.js'))) {
  throw new Error('没有找到 Next.js standalone 输出，请先运行 pnpm build');
}

safeRemove(staticTarget);
mkdirSync(path.dirname(staticTarget), { recursive: true });
cpSync(staticSource, staticTarget, { recursive: true });

mkdirSync(runtimeDirectory, { recursive: true });
copyFileSync(process.execPath, path.join(runtimeDirectory, 'node.exe'));

safeRemove(packagedServerDirectory);
cpSync(standaloneRoot, packagedServerDirectory, {
  filter(source) {
    const relative = path.relative(standaloneRoot, source);
    return relative !== 'node_modules'
      && !relative.startsWith(`node_modules${path.sep}`)
      && relative !== path.join('.next', 'node_modules')
      && !relative.startsWith(`${path.join('.next', 'node_modules')}${path.sep}`);
  },
  recursive: true,
});

mkdirSync(packagedModulesDirectory, { recursive: true });
const tracedModuleSource = (source) => {
  if (!lstatSync(source).isSymbolicLink()) return source;
  const resolved = path.resolve(path.dirname(source), readlinkSync(source));
  const marker = `${path.sep}.pnpm${path.sep}`;
  const markerIndex = resolved.indexOf(marker);
  if (markerIndex === -1) return resolved;
  const traced = path.join(standalonePnpmDirectory, resolved.slice(markerIndex + marker.length));
  return existsSync(traced) ? traced : resolved;
};
const copyModule = (source, destination) => {
  const entry = lstatSync(source);
  if (entry.isDirectory() && path.basename(source).startsWith('@')) {
    mkdirSync(destination, { recursive: true });
    for (const child of readdirSync(source)) {
      copyModule(path.join(source, child), path.join(destination, child));
    }
    return;
  }
  cpSync(tracedModuleSource(source), destination, { dereference: true, force: true, recursive: true });
};
const moduleRoots = [
  path.join(tracingRoot, 'node_modules'),
  path.join(tracingRoot, 'node_modules', '.pnpm', 'node_modules'),
  path.join(standaloneRoot, 'node_modules'),
  path.join(standaloneRoot, 'node_modules', '.pnpm', 'node_modules'),
  path.join(standaloneRoot, '.next', 'node_modules'),
];
for (const moduleRoot of moduleRoots) {
  if (!existsSync(moduleRoot)) continue;
  for (const entry of readdirSync(moduleRoot, { withFileTypes: true })) {
    if (entry.name === '.pnpm') continue;
    copyModule(path.join(moduleRoot, entry.name), path.join(packagedModulesDirectory, entry.name));
  }
}

copyFileSync(
  path.join(projectRoot, 'scripts', 'seed-characters.mjs'),
  path.join(packagedServerDirectory, 'seed-characters.mjs'),
);
copyFileSync(path.join(projectRoot, 'scripts/seed-companions.mjs'), path.join(packagedServerDirectory, 'seed-companions.mjs'));
cpSync(path.join(projectRoot, 'apps/web/public'), path.join(packagedServerDirectory, 'public'), { recursive: true });
const apiTarget = path.join(runtimeDirectory, 'api-server');
safeRemove(apiTarget);
mkdirSync(apiTarget, { recursive: true });
copyFileSync(path.join(projectRoot, 'services/api/dist/server.cjs'), path.join(apiTarget, 'server.cjs'));
// Native SQLite is loaded by the bundled Node runtime, not Electron's ABI.
const require = createRequire(import.meta.url);
const copied = new Set();
function copyDependency(name, resolver) {
  if (copied.has(name)) return;
  copied.add(name);
  const source = path.dirname(resolver.resolve(`${name}/package.json`));
  cpSync(source, path.join(apiTarget, 'node_modules', name), { recursive: true, dereference: true });
  const manifest = JSON.parse(readFileSync(path.join(source, 'package.json'), 'utf8'));
  const childResolver = createRequire(path.join(source, 'package.json'));
  for (const dependency of Object.keys(manifest.dependencies || {})) copyDependency(dependency, childResolver);
}
copyDependency('better-sqlite3', require);

console.log('CharacterOS 桌面运行文件已准备完成。');
