---
name: clipboard-paste
description: Read files, folders, or screenshots copied to the Windows system clipboard (Ctrl+C in File Explorer) and manage the direct Ctrl+V chat box file paste bridge.
---

# Clipboard File Paste Skill

Use this skill whenever the user refers to a file or screenshot they copied (`Ctrl+C`) or pasted (`Ctrl+V`) from their clipboard.

## Quick Usage

1. **Read the cached clipboard state**:
   View `~/.gemini/antigravity/clipboard_state.json` using `view_file`.
2. **Or query the live Windows clipboard directly**:
   Run:
   ```powershell
   powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "C:/Users/cnvnn/.gemini/config/plugins/clipboard-file-paste/scripts/get-clipboard.ps1"
   ```
3. **Open the files**:
   Use `view_file` on the `path` field(s) returned in `files[]`.
