# Antigravity Clipboard File Paste Daemon
# Monitors Windows Clipboard (CF_HDROP / FileDropList) and automatically injects
# Antigravity's native ContextScopeItem text ([name](file;file:///...)) alongside
# the original FileDropList so Ctrl+V in the Antigravity chat input box directly
# pastes @file context pills!

$ErrorActionPreference = "SilentlyContinue"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$win32Code = @"
using System;
using System.Runtime.InteropServices;
public static class Win32Clipboard {
    [DllImport("user32.dll")]
    public static extern uint GetClipboardSequenceNumber();
}
"@
Add-Type -TypeDefinition $win32Code -ErrorAction SilentlyContinue

# Single-instance mutex
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, "Global\AntigravityClipboardFilePasteDaemon", [ref]$createdNew)
if (-not $createdNew) {
    exit 0
}

$appDataDir = Join-Path $env:USERPROFILE ".gemini\antigravity"
$cacheDir = Join-Path $appDataDir "clipboard_cache"
$stateFile = Join-Path $appDataDir "clipboard_state.json"
$configFile = Join-Path $appDataDir "clipboard_config.json"
$pidFile = Join-Path $appDataDir "clipboard_daemon.pid"

New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
Set-Content -Path $pidFile -Value $PID -Encoding UTF8

function Get-DaemonConfig {
    if (Test-Path $configFile) {
        try {
            $cfg = Get-Content $configFile -Raw -Encoding UTF8 | ConvertFrom-Json
            return @{
                enabled = if ($null -ne $cfg.enabled) { [bool]$cfg.enabled } else { $true }
                mode    = if ($cfg.mode) { [string]$cfg.mode } else { "pill" }
            }
        } catch {}
    }
    return @{ enabled = $true; mode = "pill" }
}

function Format-AntigravityPill([string]$fullPath) {
    $cleanPath = $fullPath.TrimEnd('\', '/')
    $isDir = [System.IO.Directory]::Exists($fullPath)
    $kind = if ($isDir) { "directory" } else { "file" }
    $name = [System.IO.Path]::GetFileName($cleanPath)
    if (-not $name) { $name = $cleanPath }
    $safeLabel = $name.Replace('[', '(').Replace(']', ')')

    $normalized = $cleanPath.Replace('\', '/')
    if ($normalized -match '^[A-Za-z]:') {
        $uriPath = "/" + $normalized
    } else {
        $uriPath = $normalized
    }
    # Encode characters that would break Antigravity's [label](file;uri) regex or URI parser
    # while keeping Unicode (Chinese) characters human-readable for pill displayName
    $escapedPath = $uriPath.Replace('%', '%25').Replace(' ', '%20').Replace('(', '%28').Replace(')', '%29').Replace('[', '%5B').Replace(']', '%5D').Replace(';', '%3B').Replace('#', '%23').Replace('?', '%3F')
    $uri = "file://$escapedPath"
    return "[$safeLabel]($kind;$uri)"
}

function Write-ClipboardState($obj) {
    try {
        $json = $obj | ConvertTo-Json -Depth 5 -Compress
        [System.IO.File]::WriteAllText($stateFile, $json, (New-Object System.Text.UTF8Encoding($false)))
    } catch {}
}

$lastSeq = [uint32]0

try {
    while ($true) {
        $seq = [Win32Clipboard]::GetClipboardSequenceNumber()
        if ($seq -ne $lastSeq -and $seq -ne 0) {
            Start-Sleep -Milliseconds 60
            $lastSeq = [Win32Clipboard]::GetClipboardSequenceNumber()
            $cfg = Get-DaemonConfig

            if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
                $dropList = [System.Windows.Forms.Clipboard]::GetFileDropList()
                if ($dropList -and $dropList.Count -gt 0) {
                    $fileEntries = @()
                    $pills = @()
                    $plainPaths = @()

                    foreach ($item in $dropList) {
                        $p = [string]$item
                        $isDir = [System.IO.Directory]::Exists($p)
                        $size = 0
                        $lastMod = ""
                        if (-not $isDir -and [System.IO.File]::Exists($p)) {
                            $fi = New-Object System.IO.FileInfo($p)
                            $size = $fi.Length
                            $lastMod = $fi.LastWriteTime.ToString("o")
                        }
                        $pill = Format-AntigravityPill $p
                        $pills += $pill
                        $plainPaths += $p
                        $fileEntries += @{
                            path         = $p
                            name         = [System.IO.Path]::GetFileName($p.TrimEnd('\', '/'))
                            isDirectory  = $isDir
                            size         = $size
                            lastModified = $lastMod
                            pill         = $pill
                        }
                    }

                    Write-ClipboardState @{
                        type      = "files"
                        updatedAt = (Get-Date).ToString("o")
                        sequence  = $lastSeq
                        files     = $fileEntries
                        pillText  = ($pills -join " ") + " "
                        pathText  = ($plainPaths -join " ")
                    }

                    # Check if this is a Cut (Ctrl+X) operation in Explorer (Preferred DropEffect == 2)
                    $isCutOperation = $false
                    $rawDo = [System.Windows.Forms.Clipboard]::GetDataObject()
                    if ($null -ne $rawDo -and $rawDo.GetDataPresent("Preferred DropEffect")) {
                        try {
                            $stream = $rawDo.GetData("Preferred DropEffect") -as [System.IO.MemoryStream]
                            if ($null -ne $stream -and $stream.Length -ge 4) {
                                $bytes = New-Object byte[] 4
                                $stream.Position = 0
                                [void]$stream.Read($bytes, 0, 4)
                                $effect = [System.BitConverter]::ToInt32($bytes, 0)
                                if ($effect -eq 2) {
                                    $isCutOperation = $true
                                }
                            }
                        } catch {}
                    }

                    # Inject text representation if enabled, not a Cut operation, and no text is currently set
                    if ($cfg.enabled -and (-not $isCutOperation) -and (-not [System.Windows.Forms.Clipboard]::ContainsText())) {
                        $newDo = New-Object System.Windows.Forms.DataObject
                        $newDo.SetFileDropList($dropList)

                        # Preserve Preferred DropEffect (Copy = 1)
                        $effectBytes = [byte[]](1, 0, 0, 0)
                        $effectStream = New-Object System.IO.MemoryStream(,$effectBytes)
                        $newDo.SetData("Preferred DropEffect", $effectStream)

                        $textToSet = if ($cfg.mode -eq "path") {
                            ($plainPaths -join " ")
                        } else {
                            ($pills -join " ") + " "
                        }
                        $newDo.SetText($textToSet)

                        [System.Windows.Forms.Clipboard]::SetDataObject($newDo, $true)
                        $lastSeq = [Win32Clipboard]::GetClipboardSequenceNumber()
                    }
                }
            }
            elseif ([System.Windows.Forms.Clipboard]::ContainsImage()) {
                $img = [System.Windows.Forms.Clipboard]::GetImage()
                if ($null -ne $img) {
                    $latestPng = Join-Path $cacheDir "clipboard_latest.png"
                    try {
                        $img.Save($latestPng, [System.Drawing.Imaging.ImageFormat]::Png)
                        $pill = Format-AntigravityPill $latestPng
                        Write-ClipboardState @{
                            type      = "image"
                            updatedAt = (Get-Date).ToString("o")
                            sequence  = $lastSeq
                            width     = $img.Width
                            height    = $img.Height
                            files     = @(
                                @{
                                    path         = $latestPng
                                    name         = "clipboard_latest.png"
                                    isDirectory  = $false
                                    size         = (New-Object System.IO.FileInfo($latestPng)).Length
                                    lastModified = (Get-Date).ToString("o")
                                    pill         = $pill
                                }
                            )
                            pillText  = "$pill "
                            pathText  = $latestPng
                        }
                    } catch {}
                    finally {
                        $img.Dispose()
                    }
                }
            }
        }
        Start-Sleep -Milliseconds 250
    }
}
finally {
    if ($null -ne $mutex) {
        $mutex.ReleaseMutex()
        $mutex.Dispose()
    }
}
