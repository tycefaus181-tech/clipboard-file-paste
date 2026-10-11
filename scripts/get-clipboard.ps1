# On-demand Windows Clipboard reader & enhancer for Antigravity
$ErrorActionPreference = "SilentlyContinue"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Format-AntigravityPill([string]$fullPath) {
    $cleanPath = $fullPath.TrimEnd('\', '/')
    $isDir = [System.IO.Directory]::Exists($fullPath)
    $kind = if ($isDir) { "directory" } else { "file" }
    $name = [System.IO.Path]::GetFileName($cleanPath)
    if (-not $name) { $name = $cleanPath }
    $safeLabel = $name.Replace('[', '(').Replace(']', ')')
    $normalized = $cleanPath.Replace('\', '/')
    $uriPath = if ($normalized -match '^[A-Za-z]:') { "/" + $normalized } else { $normalized }
    $escapedPath = $uriPath.Replace('%', '%25').Replace(' ', '%20').Replace('(', '%28').Replace(')', '%29').Replace('[', '%5B').Replace(']', '%5D').Replace(';', '%3B').Replace('#', '%23').Replace('?', '%3F')
    return "[$safeLabel]($kind;file://$escapedPath)"
}

$result = @{
    type      = "empty"
    updatedAt = (Get-Date).ToString("o")
    files     = @()
    pillText  = ""
    pathText  = ""
}

if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
    $dropList = [System.Windows.Forms.Clipboard]::GetFileDropList()
    if ($dropList -and $dropList.Count -gt 0) {
        $files = @()
        $pills = @()
        $paths = @()
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
            $paths += $p
            $files += @{
                path         = $p
                name         = [System.IO.Path]::GetFileName($p.TrimEnd('\', '/'))
                isDirectory  = $isDir
                size         = $size
                lastModified = $lastMod
                pill         = $pill
            }
        }
        $result = @{
            type      = "files"
            updatedAt = (Get-Date).ToString("o")
            files     = $files
            pillText  = ($pills -join " ") + " "
            pathText  = ($paths -join " ")
        }
        if (-not [System.Windows.Forms.Clipboard]::ContainsText()) {
            $newDo = New-Object System.Windows.Forms.DataObject
            $newDo.SetFileDropList($dropList)
            $effectBytes = [byte[]](1, 0, 0, 0)
            $effectStream = New-Object System.IO.MemoryStream(,$effectBytes)
            $newDo.SetData("Preferred DropEffect", $effectStream)
            $newDo.SetText(($pills -join " ") + " ")
            [System.Windows.Forms.Clipboard]::SetDataObject($newDo, $true)
        }
    }
}
elseif ([System.Windows.Forms.Clipboard]::ContainsImage()) {
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if ($null -ne $img) {
        $cacheDir = Join-Path $env:USERPROFILE ".gemini\antigravity\clipboard_cache"
        New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
        $latestPng = Join-Path $cacheDir "clipboard_latest.png"
        $img.Save($latestPng, [System.Drawing.Imaging.ImageFormat]::Png)
        $pill = Format-AntigravityPill $latestPng
        $result = @{
            type      = "image"
            updatedAt = (Get-Date).ToString("o")
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
        $img.Dispose()
    }
}
elseif ([System.Windows.Forms.Clipboard]::ContainsText()) {
    $txt = [System.Windows.Forms.Clipboard]::GetText().Trim().Trim('"')
    if ($txt -match '^[A-Za-z]:[\\/]' -and ([System.IO.File]::Exists($txt) -or [System.IO.Directory]::Exists($txt))) {
        $isDir = [System.IO.Directory]::Exists($txt)
        $size = if (-not $isDir) { (New-Object System.IO.FileInfo($txt)).Length } else { 0 }
        $pill = Format-AntigravityPill $txt
        $result = @{
            type      = "files"
            updatedAt = (Get-Date).ToString("o")
            files     = @(
                @{
                    path         = $txt
                    name         = [System.IO.Path]::GetFileName($txt.TrimEnd('\', '/'))
                    isDirectory  = $isDir
                    size         = $size
                    lastModified = ""
                    pill         = $pill
                }
            )
            pillText  = "$pill "
            pathText  = $txt
        }
    }
}

$stateFile = Join-Path $env:USERPROFILE ".gemini\antigravity\clipboard_state.json"
$json = $result | ConvertTo-Json -Depth 5 -Compress
[System.IO.File]::WriteAllText($stateFile, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output $json
