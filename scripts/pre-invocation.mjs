// PreInvocation Hook for clipboard-file-paste plugin.
// Ensures the background clipboard daemon is running and injects any currently
// copied clipboard file(s) as an ephemeralMessage on the first invocation step.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const DAEMON_SCRIPT = join(HERE, 'clipboard-daemon.ps1');
const STATE_FILE = join(homedir(), '.gemini', 'antigravity', 'clipboard_state.json');
const PID_FILE = join(homedir(), '.gemini', 'antigravity', 'clipboard_daemon.pid');

function ensureDaemonRunning() {
  if (process.platform !== 'win32') return;
  try {
    if (existsSync(PID_FILE)) {
      const pid = Number(readFileSync(PID_FILE, 'utf8').replace(/^\uFEFF/, '').trim());
      if (pid > 0) {
        try {
          process.kill(pid, 0);
          return; // Already running!
        } catch {}
      }
    }
    const cmd = `powershell.exe -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "${DAEMON_SCRIPT}"`;
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${cmd.replace(/'/g, "''")}' } | Out-Null`,
      ],
      { timeout: 4000, windowsHide: true, stdio: 'ignore' }
    );
  } catch {}
}

async function main() {
  ensureDaemonRunning();

  let inputRaw = '';
  for await (const chunk of process.stdin) {
    inputRaw += chunk;
  }

  let payload = {};
  try {
    payload = JSON.parse(inputRaw || '{}');
  } catch {}

  // Only inject on the initial model call of a turn (invocationNum === 1)
  if (payload.invocationNum && payload.invocationNum > 1) {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  if (!existsSync(STATE_FILE)) {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  try {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf8').replace(/^\uFEFF/, ''));
    if (state && Array.isArray(state.files) && state.files.length > 0) {
      const ageMs = Date.now() - new Date(state.updatedAt || 0).getTime();
      // Inject if clipboard files were copied within the last 30 minutes
      if (ageMs >= 0 && ageMs < 30 * 60 * 1000) {
        const listStr = state.files
          .map((f) => `- \`${f.path}\` (${f.isDirectory ? 'Directory' : `${f.size} bytes`})`)
          .join('\n');
        const msg =
          `[Clipboard File Paste Plugin]: The user currently has the following ${state.type === 'image' ? 'clipboard screenshot' : 'file(s)'} in their Windows clipboard:\n` +
          `${listStr}\n` +
          `If the user's message refers to a pasted/copied file, screenshot, or "this file", read or process these path(s) directly using view_file or run_command without asking the user for the file path.`;
        process.stdout.write(
          JSON.stringify({
            injectSteps: [{ ephemeralMessage: msg }],
          })
        );
        return;
      }
    }
  } catch {}

  process.stdout.write(JSON.stringify({}));
}

main();
