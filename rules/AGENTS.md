# Clipboard File Paste Rules

The `clipboard-file-paste` plugin is active on this machine:

1. **Direct `Ctrl+V` in Chat Box**: When the user copies file(s) or folder(s) in Windows File Explorer (`Ctrl+C`), the background daemon (`clipboard-daemon.ps1`) automatically injects Antigravity's native `[filename](file;file:///...)` token into the Windows Clipboard alongside `FileDropList`, allowing the user to press `Ctrl+V` directly in the chat input box to paste `@file` context pills.
2. **Automatic Clipboard Context**: The latest copied file(s) or screenshot are recorded in `~/.gemini/antigravity/clipboard_state.json`.
3. **Never Ask for File Paths**: Whenever the user mentions a copied file, pasted file, or clipboard screenshot without providing an explicit path, immediately read `~/.gemini/antigravity/clipboard_state.json` (or run `powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "~/.gemini/config/plugins/clipboard-file-paste/scripts/get-clipboard.ps1"`) and access the file directly with `view_file` without asking the user for the path.
