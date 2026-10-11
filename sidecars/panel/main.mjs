import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = join(HERE, '..', '..', 'scripts');
const DAEMON_SCRIPT = join(SCRIPTS_DIR, 'clipboard-daemon.ps1');
const GET_CLIP_SCRIPT = join(SCRIPTS_DIR, 'get-clipboard.ps1');
const APP_DATA_DIR = join(homedir(), '.gemini', 'antigravity');
const CACHE_DIR = join(APP_DATA_DIR, 'clipboard_cache');
const STATE_FILE = join(APP_DATA_DIR, 'clipboard_state.json');
const CONFIG_FILE = join(APP_DATA_DIR, 'clipboard_config.json');

mkdirSync(CACHE_DIR, { recursive: true });

function ensureDaemon() {
  if (process.platform !== 'win32') return;
  try {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-STA', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', DAEMON_SCRIPT],
      { detached: true, stdio: 'ignore', windowsHide: true }
    );
    child.unref();
  } catch (err) {
    console.error('Failed to spawn clipboard daemon:', err.message);
  }
}

ensureDaemon();
setInterval(ensureDaemon, 15000);

function getConfig() {
  if (existsSync(CONFIG_FILE)) {
    try {
      const c = JSON.parse(readFileSync(CONFIG_FILE, 'utf8').replace(/^\uFEFF/, ''));
      return {
        enabled: c.enabled !== false,
        mode: c.mode || 'pill',
        autoSendOnPaste: Boolean(c.autoSendOnPaste),
      };
    } catch {}
  }
  return { enabled: true, mode: 'pill', autoSendOnPaste: false };
}

function getState() {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, 'utf8').replace(/^\uFEFF/, ''));
    } catch {}
  }
  return { type: 'empty', updatedAt: null, files: [], pillText: '', pathText: '' };
}

function formatPill(fullPath) {
  const clean = fullPath.replace(/[\\/]+$/, '');
  const name = clean.split(/[\\/]/).pop() || clean;
  const safeLabel = name.replace(/\[/g, '(').replace(/\]/g, ')');
  const norm = clean.replace(/\\/g, '/');
  const uriPath = /^[A-Za-z]:/.test(norm) ? '/' + norm : norm;
  const escaped = uriPath
    .replace(/%/g, '%25')
    .replace(/ /g, '%20')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/;/g, '%3B')
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F');
  return `[${safeLabel}](file;file://${escaped})`;
}

const app = new SidecarApp();
const readLocal = (name) => readFileSync(join(HERE, name), 'utf8');

app.page('/', () => readLocal('index.html'));
app.page('/app.js', () => readLocal('app.js'));
app.api('/styles.css', () => new Response(readLocal('styles.css'), { contentType: 'text/css' }), 'GET');

app.api('/api/clipboard', () => ({
  config: getConfig(),
  state: getState(),
}), 'GET');

app.api('/api/refresh', () => {
  ensureDaemon();
  try {
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', GET_CLIP_SCRIPT],
      { timeout: 4000, windowsHide: true }
    );
  } catch {}
  return {
    config: getConfig(),
    state: getState(),
  };
});

app.api('/api/config', (data) => {
  const current = getConfig();
  const next = {
    enabled: data.enabled !== undefined ? Boolean(data.enabled) : current.enabled,
    mode: data.mode || current.mode,
    autoSendOnPaste: data.autoSendOnPaste !== undefined ? Boolean(data.autoSendOnPaste) : current.autoSendOnPaste,
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  return { config: next, state: getState() };
});

app.api('/api/upload', (data) => {
  const safeName = String(data.name || `pasted_${Date.now()}.bin`).replace(/[<>:"/\\|?*]/g, '_');
  const targetPath = join(CACHE_DIR, safeName);
  const buf = Buffer.from(String(data.base64 || ''), 'base64');
  writeFileSync(targetPath, buf);
  const pill = formatPill(targetPath);
  const entry = {
    path: targetPath,
    name: safeName,
    isDirectory: false,
    size: buf.length,
    lastModified: new Date().toISOString(),
    pill,
  };
  const nextState = {
    type: 'files',
    updatedAt: new Date().toISOString(),
    files: [entry],
    pillText: pill + ' ',
    pathText: targetPath,
  };
  writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2), 'utf8');
  return { state: nextState, file: entry };
});

app.run();
