/* eslint-disable @typescript-eslint/no-require-imports */

const { spawn, spawnSync } = require('node:child_process');
const { createWriteStream, existsSync, mkdirSync } = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const { app, BrowserWindow, dialog, Menu, shell } = require('electron');

const development = process.argv.includes('--dev') || !app.isPackaged;
let mainWindow;
let serverProcess;
let quitting = false;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const findAvailablePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 3100;
    server.close(() => resolve(port));
  });
});

const requestJson = (url) => new Promise((resolve, reject) => {
  const request = http.get(url, { timeout: 2_000 }, (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => {
      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error(`HTTP ${response.statusCode || 0}`));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
  request.once('timeout', () => request.destroy(new Error('请求超时')));
  request.once('error', reject);
});

const waitForServer = async (baseUrl, timeout = 120_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (serverProcess?.exitCode !== null) throw new Error('本地服务提前退出');
    try {
      await requestJson(`${baseUrl}/api/characters`);
      return;
    } catch {
      await delay(500);
    }
  }
  throw new Error('本地服务启动超时');
};

const pipeServerLogs = (child) => {
  const logDirectory = path.join(app.getPath('userData'), 'logs');
  mkdirSync(logDirectory, { recursive: true });
  const log = createWriteStream(path.join(logDirectory, 'characteros-server.log'), { flags: 'a' });
  child.stdout?.pipe(log, { end: false });
  child.stderr?.pipe(log, { end: false });
  child.once('close', () => log.end());
};

const startServer = async (port) => {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const serverDirectory = development ? projectRoot : path.join(process.resourcesPath, 'app-server');
  const dataDirectory = development
    ? path.join(projectRoot, 'data')
    : path.join(app.getPath('userData'), 'data');
  mkdirSync(dataDirectory, { recursive: true });

  const environment = {
    ...process.env,
    CHARACTEROS_DATA_DIR: dataDirectory,
    HOSTNAME: '127.0.0.1',
    NEXT_TELEMETRY_DISABLED: '1',
    ...(!development ? { NODE_PATH: path.join(serverDirectory, 'server_modules') } : {}),
    PORT: String(port),
  };

  if (development) {
    serverProcess = spawn(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `pnpm exec next dev --turbo -p ${port} -H 127.0.0.1`],
      { cwd: projectRoot, env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
  } else {
    const runtime = path.join(process.resourcesPath, 'runtime', 'node.exe');
    const serverEntry = path.join(serverDirectory, 'server.js');
    if (!existsSync(runtime) || !existsSync(serverEntry)) throw new Error('桌面运行文件不完整，请重新安装 CharacterOS');
    serverProcess = spawn(runtime, [serverEntry], {
      cwd: serverDirectory,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  }

  pipeServerLogs(serverProcess);
  serverProcess.once('exit', (code) => {
    if (quitting) return;
    dialog.showErrorBox('CharacterOS 本地服务已停止', `服务退出代码：${code ?? '未知'}。请重新启动应用。`);
    app.quit();
  });
};

const seedDefaultCharacters = async (baseUrl) => {
  const payload = await requestJson(`${baseUrl}/api/characters`);
  if (Array.isArray(payload.items) && payload.items.length > 0) return;

  const projectRoot = path.resolve(__dirname, '..', '..');
  const seedScript = development
    ? path.join(projectRoot, 'scripts', 'seed-characters.mjs')
    : path.join(process.resourcesPath, 'app-server', 'seed-characters.mjs');
  const runtime = development ? (process.env.CHARACTEROS_NODE || 'node') : path.join(process.resourcesPath, 'runtime', 'node.exe');

  await new Promise((resolve, reject) => {
    const child = spawn(runtime, [seedScript], {
      cwd: development ? projectRoot : path.dirname(seedScript),
      env: { ...process.env, CHARACTEROS_URL: baseUrl },
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`默认角色初始化失败：${code}`)));
  });
};

const createWindow = async (baseUrl) => {
  mainWindow = new BrowserWindow({
    backgroundColor: '#070b18',
    height: 900,
    minHeight: 700,
    minWidth: 1040,
    show: false,
    title: 'CharacterOS',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    width: 1440,
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(baseUrl)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) void shell.openExternal(url);
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  await mainWindow.loadURL(baseUrl);
};

const stopServer = () => {
  if (!serverProcess?.pid || serverProcess.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(serverProcess.pid), '/t', '/f'], { windowsHide: true });
  } else {
    serverProcess.kill('SIGTERM');
  }
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });

  app.on('before-quit', () => {
    quitting = true;
    stopServer();
  });
  app.on('window-all-closed', () => app.quit());

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.characteros.desktop');
    try {
      const port = await findAvailablePort();
      const baseUrl = `http://127.0.0.1:${port}`;
      await startServer(port);
      await waitForServer(baseUrl, development ? 180_000 : 90_000);
      try {
        await seedDefaultCharacters(baseUrl);
      } catch (error) {
        console.error(error);
      }
      await createWindow(baseUrl);
    } catch (error) {
      dialog.showErrorBox('CharacterOS 启动失败', error instanceof Error ? error.message : String(error));
      app.quit();
    }
  });
}
