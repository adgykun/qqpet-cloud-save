const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const cloudSync = require('./cloudSync');

let setupWindow = null;

function createSetupWindow(onComplete) {
  if (setupWindow) {
    setupWindow.focus();
    return setupWindow;
  }

  const iconPath = path.join(__dirname, '../resources/icon.png');
  setupWindow = new BrowserWindow({
    width: 500,
    height: 420,
    title: 'QQ 宠物云存档版 - 首次配置',
    icon: iconPath,
    resizable: false,
    center: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>QQ 宠物云存档版 - 首次配置</title>
    <style>
      body {
        font-family: "Segoe UI", Microsoft YaHei, sans-serif;
        background-color: #f5f6f8;
        color: #333;
        margin: 0;
        padding: 20px;
        user-select: none;
      }
      .container {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      h2 {
        margin-top: 0;
        font-size: 18px;
        color: #111;
      }
      .info-box {
        background-color: #eef3fe;
        border: 1px solid #c7d9f9;
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 15px;
      }
      .info-box strong {
        color: #1a56db;
      }
      .form-group {
        margin-bottom: 15px;
      }
      label {
        display: block;
        font-size: 13px;
        font-weight: bold;
        margin-bottom: 6px;
      }
      input[type="text"], input[type="password"] {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 13px;
      }
      .checkbox-group {
        display: flex;
        align-items: center;
        font-size: 13px;
        margin-bottom: 15px;
      }
      .checkbox-group input {
        margin-right: 6px;
      }
      .status-msg {
        font-size: 13px;
        min-height: 20px;
        margin-bottom: 15px;
        font-weight: bold;
      }
      .status-msg.error {
        color: #d32f2f;
      }
      .status-msg.success {
        color: #2e7d32;
      }
      .status-msg.info {
        color: #0288d1;
      }
      .btn-group {
        display: flex;
        justify-content: space-between;
        margin-top: auto;
      }
      button {
        padding: 8px 16px;
        border-radius: 4px;
        border: none;
        font-size: 13px;
        cursor: pointer;
      }
      .btn-primary {
        background-color: #1976d2;
        color: white;
      }
      .btn-primary:hover {
        background-color: #1565c0;
      }
      .btn-secondary {
        background-color: #e0e0e0;
        color: #333;
      }
      .btn-secondary:hover {
        background-color: #d5d5d5;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>QQ 宠物云存档版 - 首次配置</h2>

      <p style="font-size: 13px; margin-top: 0;">
        欢迎回来！请输入你的 GitHub Token 来恢复你的宠物存档。
      </p>

      <div class="info-box">
        <strong>什么是 GitHub Token？</strong><br/>
        → 它是你的"云端钥匙"，用于访问你的存档。<br/>
        → 在 github.com/settings/tokens 创建。<br/>
        → 只需要勾选 <code>gist</code> 权限。
      </div>

      <div class="form-group">
        <label for="tokenInput">请输入你的 Token：</label>
        <input type="password" id="tokenInput" placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
      </div>

      <div class="checkbox-group">
        <input type="checkbox" id="rememberCheck" checked />
        <label for="rememberCheck" style="font-weight: normal; margin: 0;">在此电脑上记住配置（推荐）</label>
      </div>

      <div id="statusMsg" class="status-msg"></div>

      <div class="btn-group">
        <button id="connectBtn" class="btn-primary">连接并恢复存档</button>
        <button id="skipBtn" class="btn-secondary">跳过（纯本地模式）</button>
      </div>
    </div>

    <script>
      const { ipcRenderer } = require('electron');

      const tokenInput = document.getElementById('tokenInput');
      const rememberCheck = document.getElementById('rememberCheck');
      const statusMsg = document.getElementById('statusMsg');
      const connectBtn = document.getElementById('connectBtn');
      const skipBtn = document.getElementById('skipBtn');

      connectBtn.addEventListener('click', async () => {
        const token = tokenInput.value.trim();
        if (!token) {
          statusMsg.className = 'status-msg error';
          statusMsg.innerText = '❌ 请输入 GitHub Token';
          return;
        }

        connectBtn.disabled = true;
        skipBtn.disabled = true;
        statusMsg.className = 'status-msg info';
        statusMsg.innerText = '⏳ 正在验证 Token...';

        ipcRenderer.send('setup-connect', {
          token: token,
          remember: rememberCheck.checked
        });
      });

      skipBtn.addEventListener('click', () => {
        ipcRenderer.send('setup-skip');
      });

      ipcRenderer.on('setup-status', (event, res) => {
        connectBtn.disabled = false;
        skipBtn.disabled = false;
        if (res.type === 'error') {
          statusMsg.className = 'status-msg error';
          statusMsg.innerText = res.message;
        } else if (res.type === 'info') {
          statusMsg.className = 'status-msg info';
          statusMsg.innerText = res.message;
        } else if (res.type === 'success') {
          statusMsg.className = 'status-msg success';
          statusMsg.innerText = res.message;
        }
      });
    </script>
  </body>
  </html>
  `;

  setupWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

  const handleConnect = async (event, data) => {
    const { token, remember } = data;
    const isValid = await cloudSync.validateToken(token);
    if (!isValid) {
      if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.webContents.send('setup-status', {
          type: 'error',
          message: '❌ Token 无效，请检查后重试'
        });
      }
      return;
    }

    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.webContents.send('setup-status', {
        type: 'info',
        message: '🔍 正在查找云端存档...'
      });
    }

    const gistId = await cloudSync.findMyGist(token);
    let config = cloudSync.readConfig();
    config.cloudSync = config.cloudSync || {};
    config.cloudSync.enabled = true;
    config.cloudSync.githubToken = token;

    if (gistId) {
      config.cloudSync.gistId = gistId;
      if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.webContents.send('setup-status', {
          type: 'success',
          message: '✅ 找到你的宠物存档！正在恢复...'
        });
      }
    } else {
      if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.webContents.send('setup-status', {
          type: 'info',
          message: '📝 未找到已有存档，将创建新的云端存档'
        });
      }
    }

    if (remember) {
      cloudSync.writeConfig(config);
    }

    // 执行恢复下载或初始上传
    if (gistId) {
      await cloudSync.downloadSave({ token, gistId, remember });
    } else {
      await cloudSync.uploadSave({ token, gistId, remember });
    }

    setTimeout(() => {
      cleanupIPCs();
      if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.close();
      }
      setupWindow = null;
      if (typeof onComplete === 'function') {
        onComplete({ action: 'connect', token, gistId });
      }
    }, 1000);
  };

  const handleSkip = () => {
    cleanupIPCs();
    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.close();
    }
    setupWindow = null;
    if (typeof onComplete === 'function') {
      onComplete({ action: 'skip' });
    }
  };

  function cleanupIPCs() {
    ipcMain.removeListener('setup-connect', handleConnect);
    ipcMain.removeListener('setup-skip', handleSkip);
  }

  ipcMain.on('setup-connect', handleConnect);
  ipcMain.on('setup-skip', handleSkip);

  setupWindow.on('closed', () => {
    cleanupIPCs();
    setupWindow = null;
  });

  return setupWindow;
}

module.exports = {
  createSetupWindow
};
