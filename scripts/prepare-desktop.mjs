import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readlinkSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const standaloneRoot = path.join(projectRoot, '.next', 'standalone');
const staticSource = path.join(projectRoot, '.next', 'static');
const staticTarget = path.join(standaloneRoot, '.next', 'static');
const runtimeDirectory = path.join(projectRoot, 'desktop', 'runtime');
const packagedServerDirectory = path.join(runtimeDirectory, 'app-server');
const packagedModulesDirectory = path.join(packagedServerDirectory, 'server_modules');
const standalonePnpmDirectory = path.join(standaloneRoot, 'node_modules', '.pnpm');

if (!existsSync(path.join(standaloneRoot, 'server.js'))) {
  throw new Error('没有找到 Next.js standalone 输出，请先运行 pnpm build');
}

rmSync(staticTarget, { force: true, recursive: true });
mkdirSync(path.dirname(staticTarget), { recursive: true });
cpSync(staticSource, staticTarget, { recursive: true });

mkdirSync(runtimeDirectory, { recursive: true });
copyFileSync(process.execPath, path.join(runtimeDirectory, 'node.exe'));

rmSync(packagedServerDirectory, { force: true, recursive: true });
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

console.log('CharacterOS 桌面运行文件已准备完成。');
