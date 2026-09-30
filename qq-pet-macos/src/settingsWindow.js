const { BrowserWindow, ipcMain } = require('electron');
const cloudSync = require('./cloudSync');

let settingsWindow = null;

function createSettingsWindow(onStatusChange) {
  if (settingsWindow) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 450,
    title: '⚙️ 云同步设置',
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
    <title>⚙️ 云同步设置</title>
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
        margin-bottom: 15px;
      }
      .status-card {
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        padding: 12px 15px;
        font-size: 13px;
        line-height: 1.8;
        margin-bottom: 15px;
      }
      .status-card .item {
        display: flex;
        justify-content: space-between;
      }
      .form-group {
        margin-bottom: 12px;
      }
      label {
        display: block;
        font-size: 13px;
        font-weight: bold;
        margin-bottom: 5px;
      }
      input[type="text"], input[type="password"], input[type="number"] {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 13px;
      }
      .inline-group {
        display: flex;
        align-items: center;
      }
      .inline-group input[type="number"] {
        width: 80px;
        margin: 0 8px;
      }
      .status-msg {
        font-size: 13px;
        min-height: 20px;
        margin-bottom: 10px;
        font-weight: bold;
      }
      .status-msg.error { color: #d32f2f; }
      .status-msg.success { color: #2e7d32; }
      .status-msg.info { color: #0288d1; }
      .btn-group {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: auto;
      }
      button {
        padding: 8px 16px;
        border-radius: 4px;
        border: none;
        font-size: 13px;
        cursor: pointer;
      }
      .btn-primary { background-color: #1976d2; color: white; }
      .btn-primary:hover { background-color: #1565c0; }
      .btn-secondary { background-color: #e0e0e0; color: #333; }
      .btn-secondary:hover { background-color: #d5d5d5; }
      button:disabled { opacity: 0.6; cursor: not-allowed; }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>⚙️ 云同步设置</h2>

      <div class="status-card">
        <div class="item"><span>当前状态：</span><strong id="syncStatus">☁️ 检查中...</strong></div>
        <div class="item"><span>上次同步：</span><span id="lastSyncTime">无</span></div>
        <div class="item"><span>云端设备：</span><span id="lastSyncDevice">无</span></div>
        <div class="item"><span>云端宠物：</span><span id="petInfo">暂无数据</span></div>
      </div>

      <div class="form-group">
        <label for="tokenInput">GitHub Token：</label>
        <input type="password" id="tokenInput" placeholder="ghp_xxxxxxxxxxxx" />
      </div>

      <div class="form-group inline-group">
        <label style="margin: 0;">同步间隔：</label>
        <input type="number" id="intervalInput" min="1" max="60" value="5" />
        <span style="font-size: 13px;">分钟</span>
      </div>

      <div id="statusMsg" class="status-msg"></div>

      <div class="btn-group">
        <button id="saveBtn" class="btn-primary">保存设置</button>
        <button id="cancelBtn" class="btn-secondary">取消</button>
      </div>
    </div>

    <script>
      const { ipcRenderer } = require('electron');

      const syncStatus = document.getElementById('syncStatus');
      const lastSyncTime = document.getElementById('lastSyncTime');
      const lastSyncDevice = document.getElementById('lastSyncDevice');
      const petInfo = document.getElementById('petInfo');
      const tokenInput = document.getElementById('tokenInput');
      const intervalInput = document.getElementById('intervalInput');
      const statusMsg = document.getElementById('statusMsg');
      const saveBtn = document.getElementById('saveBtn');
      const cancelBtn = document.getElementById('cancelBtn');

      function updateUI(data) {
        if (data.statusStr) syncStatus.innerText = data.statusStr;
        if (data.lastSyncTime) lastSyncTime.innerText = data.lastSyncTime;
        if (data.lastSyncDevice) lastSyncDevice.innerText = data.lastSyncDevice;
        if (data.petName) petInfo.innerText = \`\${data.petName}  等级：\${data.petLevel || 1}\`;
        if (data.githubToken !== undefined) tokenInput.value = data.githubToken;
        if (data.intervalMinutes) intervalInput.value = data.intervalMinutes;
      }

      ipcRenderer.send('settings-get-info');

      ipcRenderer.on('settings-info', (event, data) => {
        updateUI(data);
      });

      saveBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        const interval = parseInt(intervalInput.value, 10) || 5;

        statusMsg.className = 'status-msg info';
        statusMsg.innerText = '⏳ 正在保存设置...';

        ipcRenderer.send('settings-save', { token, interval });
      });

      ipcRenderer.on('settings-save-result', (event, res) => {
        if (res.success) {
          statusMsg.className = 'status-msg success';
          statusMsg.innerText = '✅ 设置保存成功！';
          setTimeout(() => {
            window.close();
          }, 800);
        } else {
          statusMsg.className = 'status-msg error';
          statusMsg.innerText = '❌ 保存失败：' + (res.error || 'Token 无效');
        }
      });

      cancelBtn.addEventListener('click', () => {
        window.close();
      });
    </script>
  </body>
  </html>
  `;

  settingsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

  const handleGetInfo = async (event) => {
    const config = cloudSync.readConfig();
    const token = config.cloudSync?.githubToken || '';
    const intervalMinutes = config.cloudSync?.intervalMinutes || 5;
    const lastSyncTimeStr = config.cloudSync?.lastSyncTime
      ? new Date(config.cloudSync.lastSyncTime).toLocaleString()
      : '无';
    const lastSyncDeviceStr = config.cloudSync?.lastSyncDevice || '无';

    let petName = '我';
    let petLevel = 1;
    try {
      const fs = require('fs');
      const path = require('path');
      const saveFile = path.join(cloudSync.getUserDataPath(), 'config-macos.json');
      if (fs.existsSync(saveFile)) {
        const raw = fs.readFileSync(saveFile, 'utf-8');
        const parsed = JSON.parse(raw);
        petName = parsed.pet?.info?.name || petName;
        petLevel = parsed.pet?.maxInfo?.level || petLevel;
      }
    } catch (_) {}

    let statusStr = '☁️ 已同步';
    if (!token) {
      statusStr = '📴 未配置 Token';
    }

    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('settings-info', {
        githubToken: token,
        intervalMinutes,
        lastSyncTime: lastSyncTimeStr,
        lastSyncDevice: lastSyncDeviceStr,
        petName,
        petLevel,
        statusStr
      });
    }
  };

  const handleSave = async (event, data) => {
    const { token, interval } = data;
    if (token) {
      const isValid = await cloudSync.validateToken(token);
      if (!isValid) {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.webContents.send('settings-save-result', {
            success: false,
            error: 'Token 验证失败，请输入有效的 GitHub Token'
          });
        }
        return;
      }
    }

    const config = cloudSync.readConfig();
    config.cloudSync = config.cloudSync || {};
    config.cloudSync.enabled = true;
    config.cloudSync.githubToken = token;
    config.cloudSync.intervalMinutes = interval;

    cloudSync.writeConfig(config);

    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('settings-save-result', { success: true });
    }

    if (typeof onStatusChange === 'function') {
      onStatusChange('saved');
    }
  };

  function cleanupIPCs() {
    ipcMain.removeListener('settings-get-info', handleGetInfo);
    ipcMain.removeListener('settings-save', handleSave);
  }

  ipcMain.on('settings-get-info', handleGetInfo);
  ipcMain.on('settings-save', handleSave);

  settingsWindow.on('closed', () => {
    cleanupIPCs();
    settingsWindow = null;
  });

  return settingsWindow;
}

module.exports = {
  createSettingsWindow
};
