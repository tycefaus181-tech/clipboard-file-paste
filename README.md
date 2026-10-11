# Clipboard File Paste for Google Antigravity (`clipboard-file-paste`)

<p align="center">
  <img src="./assets/logo.svg" width="84" height="84" alt="Clipboard File Paste Logo" />
</p>

**直接在 Google Antigravity 聊天输入框中按 `Ctrl + V` 粘贴资源管理器中 `Ctrl + C` 复制的任意文件或文件夹！**  
*Directly paste any file or folder copied in Windows File Explorer (`Ctrl + C`) into the Google Antigravity chat input box using `Ctrl + V` as native `@file` context pills.*

---

## ✨ 为什么需要这个插件？ (Why This Plugin?)

默认情况下，Google Antigravity 的聊天输入框仅支持通过 `Ctrl + V` 粘贴纯文本或内存位图截图（`image/*` / `video/*`）。当你在 Windows 资源管理器（File Explorer）中选中任意文件（如 `.pdf`、`.docx`、`.xlsx`、`.py`、`.zip` 或文件夹）按 `Ctrl + C` 时，Windows 剪贴板仅写入了 `CF_HDROP`（`FileDropList`），此时在聊天框按 `Ctrl + V` 没有任何反应。

本插件通过 **四层深度集成** 彻底解决这一痛点：

1. **聊天输入框原生 `Ctrl + V` 直粘 (`scripts/clipboard-daemon.ps1`)**
   - 后台轻量级守护进程基于 Win32 `GetClipboardSequenceNumber()` 监听剪贴板变化（空闲时 **0% CPU 占用**）。
   - 当你在资源管理器按 `Ctrl + C` 复制任意文件/文件夹时，守护进程在**完整保留原 `FileDropList` 与 `Preferred DropEffect`**（完全不影响在资源管理器正常粘贴文件）的同时，自动向剪贴板注入 Antigravity 原生上下文标记 `[文件名](file;file:///...)`。
   - 回到 Antigravity 聊天框直接按 **`Ctrl + V`**，输入框会立即将其解析并插入为原生 **`@文件名` 上下文胶囊（Context Pill）**！
2. **Agent Harness `PreInvocation` 自动感知钩子 (`hooks.json` + `scripts/pre-invocation.mjs`)**
   - 即使你复制了文件或截了图后忘记按 `Ctrl + V`，只要直接在聊天框打字提问（例如*“帮我看看我刚复制的这个文件”*），`PreInvocation` 钩子也会在模型调用前自动将剪贴板中的文件路径注入给 Agent。
3. **右侧可视化扩展面板 (`sidecars/panel/`)**
   - 基于 Antigravity Sidecar SDK 构建的右侧辅助面板（UI Extension），支持实时预览当前剪贴板中的文件/截图、拖拽投递文件、一键发送到当前对话，以及切换 `Ctrl + V` 粘贴格式（原生 `@文件` 胶囊 vs 纯本地路径）。
4. **内置规则与技能 (`rules/AGENTS.md` + `skills/clipboard-paste/SKILL.md`)**
   - 让 Agent 随时能够主动读取系统剪贴板中的文件或最新截图，不再向用户索要文件路径。

---

## 🚀 快速安装 (Quick Installation)

### 方式一：一键脚本安装（推荐）

克隆本仓库并运行安装脚本：

```powershell
git clone https://github.com/tycefaus181-tech/clipboard-file-paste.git "$env:USERPROFILE\.gemini\config\plugins\clipboard-file-paste"
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.gemini\config\plugins\clipboard-file-paste\install.ps1"
```

### 方式二：Node.js 安装

```bash
node install.mjs
```

安装完成后**无需重启**，即可立即在资源管理器按 `Ctrl + C` 复制文件、在 Antigravity 对话框按 `Ctrl + V` 粘贴！

---

## 📂 目录结构 (Directory Structure)

```text
clipboard-file-paste/
├── plugin.json                        # Antigravity 插件清单
├── hooks.json                         # PreInvocation Agent 生命周期钩子配置
├── install.ps1                        # Windows PowerShell 一键安装与启动脚本
├── install.mjs                        # 跨平台 Node.js 安装脚本
├── assets/
│   └── logo.svg                       # 插件图标
├── rules/
│   └── AGENTS.md                      # 自动加载的剪贴板文件感知规则
├── skills/
│   └── clipboard-paste/
│       └── SKILL.md                   # 剪贴板读取技能说明
├── scripts/
│   ├── clipboard-daemon.ps1           # 后台剪贴板监听与 @file 标记注入守护进程
│   ├── get-clipboard.ps1              # 按需读取系统剪贴板脚本
│   └── pre-invocation.mjs             # PreInvocation 钩子执行脚本
└── sidecars/
    └── panel/                         # 右侧可视化扩展面板 (Sidecar UI Extension)
        ├── sidecar.json
        ├── package.json
        ├── main.mjs
        ├── index.html
        ├── app.js
        └── styles.css
```

---

## 📄 开源协议 (License)

[MIT License](./LICENSE)
