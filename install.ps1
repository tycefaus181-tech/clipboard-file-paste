# One-click installer for clipboard-file-paste Antigravity plugin
$ErrorActionPreference = "Stop"

$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetPluginDir = Join-Path $env:USERPROFILE ".gemini\config\plugins\clipboard-file-paste"
$configRoot = Join-Path $env:USERPROFILE ".gemini\config"

if ($sourceDir -ne $targetPluginDir) {
    New-Item -ItemType Directory -Force -Path $targetPluginDir | Out-Null
    Copy-Item -Path (Join-Path $sourceDir "*") -Destination $targetPluginDir -Recurse -Force
    Write-Host "Copied plugin files to $targetPluginDir" -ForegroundColor Green
}

# Start background clipboard daemon via WMI so it runs persistently
$daemonScript = Join-Path $targetPluginDir "scripts\clipboard-daemon.ps1"
$cmdLine = "powershell.exe -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$daemonScript`""
$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = $cmdLine
    ProcessStartupInformation = $si
} | Out-Null

Write-Host "Clipboard File Paste plugin installed and background daemon started!" -ForegroundColor Green
Write-Host "You can now press Ctrl+C on any file in Explorer and press Ctrl+V directly in the Antigravity chat box." -ForegroundColor Cyan
