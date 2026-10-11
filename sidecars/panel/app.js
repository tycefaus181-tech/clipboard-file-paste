const sidecar = window.sidecar;
const $ = (id) => document.getElementById(id);

let currentState = { files: [], pillText: '', pathText: '' };

async function callApi(path, { method = 'GET', body } = {}) {
  const res = await sidecar.fetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status}`);
  return data;
}

let toastTimer;
function toast(msg, isError = false) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderState(data) {
  if (data.config) {
    $('chk-enabled').checked = data.config.enabled !== false;
    $('sel-mode').value = data.config.mode || 'pill';
  }
  currentState = data.state || { files: [] };
  const container = $('file-list');
  const files = currentState.files || [];
  if (files.length === 0) {
    container.innerHTML = '<p class="muted small">当前剪贴板中没有文件。去文件夹选中文件按 <kbd>Ctrl</kbd>+<kbd>C</kbd> 即可自动识别！</p>';
    return;
  }
  container.innerHTML = files.map((f) => `
    <div class="file-item">
      <div class="file-name">@${f.name} <span class="muted small">(${f.isDirectory ? '文件夹' : formatSize(f.size)})</span></div>
      <div class="file-path muted small">${f.path}</div>
    </div>
  `).join('');
}

async function pollClipboard() {
  try {
    const data = await callApi('/api/clipboard');
    renderState(data);
  } catch {}
}

async function forceRefresh() {
  try {
    const data = await callApi('/api/refresh', { method: 'POST', body: {} });
    renderState(data);
    toast('已同步系统剪贴板');
  } catch (err) {
    toast('读取失败: ' + err.message, true);
  }
}

async function sendCurrentFilesToChat() {
  const files = currentState.files || [];
  if (files.length === 0) {
    await forceRefresh();
  }
  if (!currentState.files || currentState.files.length === 0) {
    toast('剪贴板中暂无文件，请先在文件夹按 Ctrl+C 复制文件', true);
    return;
  }
  const extra = $('prompt-input').value.trim();
  const fileLines = currentState.files.map((f) => `- ${f.pill} (`${f.path}`)`).join('\n');
  const msg = (extra ? `${extra}\n\n` : '请读取并处理以下我粘贴的文件：\n') + fileLines;
  try {
    if (sidecar && sidecar.conversationId) {
      await sidecar.agent.sendMessage(msg);
      toast('已将文件发送到当前对话！');
    } else if (sidecar) {
      await sidecar.agent.startConversation(msg);
      toast('已携文件开启新对话！');
    }
  } catch (err) {
    toast('发送失败: ' + err.message, true);
  }
}

async function uploadBrowserFiles(fileList) {
  for (const file of Array.from(fileList)) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const res = await callApi('/api/upload', {
      method: 'POST',
      body: { name: file.name, base64 },
    });
    renderState({ state: res.state });
  }
  toast('文件已载入，正在发送到对话…');
  await sendCurrentFilesToChat();
}

function init() {
  $('btn-refresh').addEventListener('click', forceRefresh);
  $('btn-send').addEventListener('click', sendCurrentFilesToChat);
  $('btn-copy-pill').addEventListener('click', async () => {
    if (!currentState.pillText) {
      toast('暂无可复制的文件引用', true);
      return;
    }
    await navigator.clipboard.writeText(currentState.pillText);
    toast('已复制 @文件 标记，可在输入框直接 Ctrl+V');
  });

  const saveCfg = async () => {
    await callApi('/api/config', {
      method: 'POST',
      body: {
        enabled: $('chk-enabled').checked,
        mode: $('sel-mode').value,
      },
    });
    toast('设置已保存并立即生效');
  };
  $('chk-enabled').addEventListener('change', saveCfg);
  $('sel-mode').addEventListener('change', saveCfg);

  const dz = $('dropzone');
  const fi = $('file-input');
  dz.addEventListener('click', () => fi.click());
  fi.addEventListener('change', () => {
    if (fi.files?.length) uploadBrowserFiles(fi.files);
  });
  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    dz.classList.add('dragover');
  });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    if (e.dataTransfer?.files?.length) {
      uploadBrowserFiles(e.dataTransfer.files);
    }
  });

  window.addEventListener('paste', async (e) => {
    if (document.activeElement === $('prompt-input')) return;
    e.preventDefault();
    if (e.clipboardData?.files?.length) {
      await uploadBrowserFiles(e.clipboardData.files);
    } else {
      await forceRefresh();
      await sendCurrentFilesToChat();
    }
  });

  pollClipboard();
  setInterval(pollClipboard, 1500);
}

init();
