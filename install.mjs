#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const home = os.homedir();
const configRoot = path.join(home, '.gemini', 'config');
const targetDir = path.join(configRoot, 'plugins', 'clipboard-file-paste');

if (path.resolve(here) !== path.resolve(targetDir)) {
  fs.cpSync(here, targetDir, { recursive: true, force: true });
  console.log('Installed plugin to:', targetDir);
}

const daemonScript = path.join(targetDir, 'scripts', 'clipboard-daemon.ps1');
if (process.platform === 'win32' && fs.existsSync(daemonScript)) {
  const cmdLine = `powershell.exe -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "${daemonScript}"`;
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }; Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${cmdLine.replace(/'/g, "''")}'; ProcessStartupInformation = $si } | Out-Null`,
    ],
    { windowsHide: true }
  );
  console.log('Started background clipboard daemon.');
}
