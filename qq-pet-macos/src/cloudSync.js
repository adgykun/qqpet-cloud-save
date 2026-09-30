const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
let electron = null;
try {
  electron = require('electron');
} catch (_) {}

/**
 * 获取 Electron app 对象（如果可用）
 */
function getApp() {
  if (electron && electron.app) {
    return electron.app;
  }
  return null;
}

const cloudSync = {
  /**
   * 检查目录是否可写
   */
  isDirWritable(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      const testFile = path.join(dirPath, `.write_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
      fs.writeFileSync(testFile, 'test', 'utf-8');
      fs.unlinkSync(testFile);
      return true;
    } catch (_) {
      return false;
    }
  },

  /**
   * 获取安装目录 (process.env.PORTABLE_EXECUTABLE_DIR 或 process.execPath 所在目录)
   */
  getInstallDir() {
    return process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  },

  /**
   * 获取基础安装目录
   */
  getBaseDir() {
    return cloudSync.getInstallDir();
  },

  /**
   * 获取 userData 路径 (若安装目录可写则为 installDir/userdata，否则回退到 AppData / 用户目录)
   */
  getUserDataPath() {
    const installDir = cloudSync.getInstallDir();
    if (cloudSync.isDirWritable(installDir)) {
      return path.join(installDir, 'userdata');
    }

    // 保险丝回退路径（当安装目录不可写时）
    let fallbackDir = null;
    const app = getApp();
    if (app && typeof app.getPath === 'function') {
      try {
        fallbackDir = app.getPath('userData');
      } catch (_) {}
    }
    if (!fallbackDir) {
      fallbackDir = path.join(os.homedir(), '.qqpet_userdata');
    }

    // 记录回退日志
    try {
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      const logFile = path.join(fallbackDir, 'sync_log.txt');
      const line = `[${new Date().toISOString()}] [Fuse] Installation directory ${installDir} is not writable. Falling back to data directory: ${fallbackDir}\n`;
      fs.appendFileSync(logFile, line, 'utf-8');
    } catch (_) {}

    return fallbackDir;
  },

  /**
   * 获取配置文件路径 config.json (若安装目录可写为 installDir/config.json，否则放在 fallback 目录下)
   */
  getConfigPath() {
    const installDir = cloudSync.getInstallDir();
    if (cloudSync.isDirWritable(installDir)) {
      return path.join(installDir, 'config.json');
    }
    const userDataPath = cloudSync.getUserDataPath();
    return path.join(userDataPath, 'config.json');
  },

  /**
   * 记录同步日志到 sync_log.txt
   */
  logSync(msg) {
    const userDataPath = cloudSync.getUserDataPath();
    const logFile = path.join(userDataPath, 'sync_log.txt');
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try {
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      fs.appendFileSync(logFile, line, 'utf-8');
    } catch (_) {}
  },

  /**
   * 自动迁移兼容旧位置 (如 %APPDATA% 或旧目录) 的 config.json 及存档文件
   */
  migrateOldData() {
    const newConfigPath = cloudSync.getConfigPath();
    const newUserDataPath = cloudSync.getUserDataPath();
    const newSavePath = path.join(newUserDataPath, 'config-macos.json');

    if (!fs.existsSync(newUserDataPath)) {
      try {
        fs.mkdirSync(newUserDataPath, { recursive: true });
      } catch (_) {}
    }

    if (!fs.existsSync(newConfigPath)) {
      const configCandidates = [];
      const app = getApp();
      if (app && typeof app.getPath === 'function') {
        try {
          const appData = app.getPath('appData');
          configCandidates.push(path.join(appData, 'qqpet_cloudsave', 'config.json'));
          configCandidates.push(path.join(appData, 'pet', 'config.json'));
          configCandidates.push(path.join(appData, 'qq-pet', 'config.json'));
          configCandidates.push(path.join(appData, 'qq-pet-macos', 'config.json'));
          configCandidates.push(path.join(appData, 'QQ宠物', 'config.json'));
          configCandidates.push(path.join(appData, 'QQ宠物云存档版', 'config.json'));
        } catch (_) {}
      }
      const installDir = cloudSync.getInstallDir();
      configCandidates.push(path.join(installDir, 'userdata', 'config.json'));
      configCandidates.push(path.join(process.cwd(), 'config.json'));
      configCandidates.push(path.join(__dirname, '..', 'config.json'));
      configCandidates.push(path.join(__dirname, 'config.json'));

      for (const candidate of configCandidates) {
        if (fs.existsSync(candidate) && candidate !== newConfigPath) {
          try {
            fs.copyFileSync(candidate, newConfigPath);
            cloudSync.logSync(`[Migration] Migrated config.json from ${candidate}`);
            break;
          } catch (err) {
            console.error(`[Migration] Failed to migrate ${candidate}:`, err.message);
          }
        }
      }
    }

    if (!fs.existsSync(newSavePath)) {
      const saveCandidates = [];
      const app = getApp();
      if (app && typeof app.getPath === 'function') {
        try {
          const appData = app.getPath('appData');
          saveCandidates.push(path.join(appData, 'qqpet_cloudsave', 'config-macos.json'));
          saveCandidates.push(path.join(appData, 'pet', 'config-macos.json'));
          saveCandidates.push(path.join(appData, 'qq-pet', 'config-macos.json'));
          saveCandidates.push(path.join(appData, 'qq-pet-macos', 'config-macos.json'));
          saveCandidates.push(path.join(appData, 'QQ宠物', 'config-macos.json'));
          saveCandidates.push(path.join(appData, 'QQ宠物云存档版', 'config-macos.json'));
        } catch (_) {}
      }
      const installDir = cloudSync.getInstallDir();
      saveCandidates.push(path.join(installDir, 'config-macos.json'));
      saveCandidates.push(path.join(os.homedir(), '.qqpet_userdata', 'config-macos.json'));
      saveCandidates.push(path.join(process.cwd(), 'config-macos.json'));

      for (const candidate of saveCandidates) {
        if (fs.existsSync(candidate) && candidate !== newSavePath) {
          try {
            fs.copyFileSync(candidate, newSavePath);
            cloudSync.logSync(`[Migration] Migrated save file from ${candidate}`);
            break;
          } catch (err) {
            console.error(`[Migration] Failed to migrate ${candidate}:`, err.message);
          }
        }
      }
    }
  },

  /**
   * 读取本地 config.json 配置
   */
  readConfig() {
    const configPath = cloudSync.getConfigPath();
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('读取 config.json 失败:', err.message);
    }
    return {
      cloudSync: {
        enabled: true,
        githubToken: '',
        gistId: '',
        intervalMinutes: 5,
        lastSyncTime: '',
        lastSyncDevice: ''
      }
    };
  },

  /**
   * 写入本地 config.json 配置
   */
  writeConfig(config) {
    const configPath = cloudSync.getConfigPath();
    try {
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('写入 config.json 失败:', err.message);
      return false;
    }
  },

  /**
   * 获取或生成唯一的设备标识
   */
  getDeviceId() {
    const userDataPath = cloudSync.getUserDataPath();
    const deviceFile = path.join(userDataPath, 'device_id.txt');
    try {
      if (fs.existsSync(deviceFile)) {
        const id = fs.readFileSync(deviceFile, 'utf-8').trim();
        if (id) return id;
      }
    } catch (_) {}

    const uuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const deviceId = `${os.hostname()}-${uuid}`;

    try {
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      fs.writeFileSync(deviceFile, deviceId, 'utf-8');
    } catch (err) {
      console.error('保存 device_id.txt 失败:', err.message);
    }

    return deviceId;
  },

  /**
   * 验证 GitHub Token 是否有效
   */
  async validateToken(token) {
    if (!token) return false;
    try {
      const res = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'QQPet-CloudSync'
        },
        timeout: 10000
      });
      return res.status === 200;
    } catch (err) {
      return false;
    }
  },

  /**
   * 查找用户已有的 QQ 宠物 Gist 存档
   */
  async findMyGist(token) {
    if (!token) return null;
    try {
      const res = await axios.get('https://api.github.com/gists', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'QQPet-CloudSync'
        },
        timeout: 10000
      });
      if (Array.isArray(res.data)) {
        for (const gist of res.data) {
          if (gist.files && gist.files['qqpet_save.json']) {
            return gist.id;
          }
        }
      }
      return null;
    } catch (err) {
      console.error('findMyGist 失败:', err.message);
      return null;
    }
  },

  /**
   * 创建私密 Gist 存档
   */
  async createGist(data, token) {
    const contentStr = typeof data === 'string' ? data : JSON.stringify(data);
    const res = await axios.post(
      'https://api.github.com/gists',
      {
        description: 'QQ宠物 - 自动同步 - 请勿删除',
        public: false,
        files: {
          'qqpet_save.json': {
            content: contentStr
          }
        }
      },
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'QQPet-CloudSync'
        },
        timeout: 15000
      }
    );
    return res.data.id;
  },

  /**
   * 更新已有的 Gist 存档
   */
  async updateGist(gistId, data, token) {
    const contentStr = typeof data === 'string' ? data : JSON.stringify(data);
    const res = await axios.patch(
      `https://api.github.com/gists/${gistId}`,
      {
        description: 'QQ宠物 - 自动同步 - 请勿删除',
        files: {
          'qqpet_save.json': {
            content: contentStr
          }
        }
      },
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'QQPet-CloudSync'
        },
        timeout: 15000
      }
    );
    return res.data;
  },

  /**
   * 从 GitHub 读取 Gist 存档
   */
  async readGist(gistId, token) {
    const res = await axios.get(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'QQPet-CloudSync'
      },
      timeout: 15000
    });
    const fileObj = res.data?.files?.['qqpet_save.json'];
    if (!fileObj || !fileObj.content) {
      throw new Error('Gist 中未找到 qqpet_save.json 文件');
    }
    return JSON.parse(fileObj.content);
  },

  /**
   * 上传本地存档到云端
   */
  async uploadSave(options = {}) {
    const userDataPath = cloudSync.getUserDataPath();
    const pendingFlagPath = path.join(userDataPath, 'pending_sync.flag');
    const saveFilePath = path.join(userDataPath, 'config-macos.json');

    try {
      if (!fs.existsSync(saveFilePath)) {
        return { success: false, reason: 'save_file_not_found' };
      }

      const rawSave = fs.readFileSync(saveFilePath, 'utf-8');
      const base64Data = Buffer.from(rawSave, 'utf-8').toString('base64');

      let petName = '未知宠物';
      let petLevel = 1;
      try {
        const parsedSave = JSON.parse(rawSave);
        if (parsedSave.pet && parsedSave.pet.info && parsedSave.pet.info.name) {
          petName = parsedSave.pet.info.name;
        }
        if (parsedSave.pet && parsedSave.pet.maxInfo && parsedSave.pet.maxInfo.level) {
          petLevel = parsedSave.pet.maxInfo.level;
        }
      } catch (_) {}

      const deviceId = cloudSync.getDeviceId();
      const payload = {
        data: base64Data,
        timestamp: Date.now(),
        deviceId: deviceId,
        petName: petName,
        petLevel: petLevel,
        version: '1.0.0'
      };

      const config = cloudSync.readConfig();
      const token = options.token || config.cloudSync?.githubToken;
      if (!token) {
        return { success: false, reason: 'no_token' };
      }

      let gistId = options.gistId || config.cloudSync?.gistId;
      if (!gistId) {
        gistId = await cloudSync.findMyGist(token);
        if (gistId) {
          await cloudSync.updateGist(gistId, payload, token);
        } else {
          gistId = await cloudSync.createGist(payload, token);
        }
        if (options.remember !== false) {
          config.cloudSync = config.cloudSync || {};
          config.cloudSync.gistId = gistId;
        }
      } else {
        await cloudSync.updateGist(gistId, payload, token);
      }

      if (options.remember !== false) {
        config.cloudSync = config.cloudSync || {};
        config.cloudSync.lastSyncTime = new Date().toISOString();
        config.cloudSync.lastSyncDevice = deviceId;
        cloudSync.writeConfig(config);
      }

      if (fs.existsSync(pendingFlagPath)) {
        try {
          fs.unlinkSync(pendingFlagPath);
        } catch (_) {}
      }

      return { success: true, gistId, timestamp: payload.timestamp };
    } catch (err) {
      console.error('uploadSave 失败:', err.message);
      try {
        fs.writeFileSync(pendingFlagPath, Date.now().toString(), 'utf-8');
      } catch (_) {}
      return { success: false, error: err.message };
    }
  },

  /**
   * 从云端下载并恢复存档
   */
  async downloadSave(options = {}) {
    const config = cloudSync.readConfig();
    const token = options.token || config.cloudSync?.githubToken;
    if (!token) {
      return { downloaded: false, reason: 'no_token' };
    }

    let gistId = options.gistId || config.cloudSync?.gistId;
    if (!gistId) {
      gistId = await cloudSync.findMyGist(token);
      if (!gistId) {
        return { downloaded: false, reason: 'no_gist_found' };
      }
      if (options.remember !== false) {
        config.cloudSync = config.cloudSync || {};
        config.cloudSync.gistId = gistId;
        cloudSync.writeConfig(config);
      }
    }

    try {
      const cloudSave = await cloudSync.readGist(gistId, token);
      if (!cloudSave || !cloudSave.data) {
        return { downloaded: false, reason: 'invalid_cloud_data' };
      }

      const decodedSaveStr = Buffer.from(cloudSave.data, 'base64').toString('utf-8');
      const userDataPath = cloudSync.getUserDataPath();
      const saveFilePath = path.join(userDataPath, 'config-macos.json');

      const cloudTimestamp = cloudSave.timestamp || 0;
      let localMtime = 0;
      if (fs.existsSync(saveFilePath)) {
        localMtime = fs.statSync(saveFilePath).mtimeMs;
      }

      // 时间戳比较
      if (localMtime > 0 && cloudTimestamp < localMtime) {
        return { downloaded: false, reason: 'local_newer' };
      }

      if (localMtime > 0 && Math.floor(cloudTimestamp / 1000) === Math.floor(localMtime / 1000)) {
        return { downloaded: false, reason: 'same_timestamp' };
      }

      // 来自其他设备的判断
      const currentDeviceId = cloudSync.getDeviceId();
      if (cloudSave.deviceId && cloudSave.deviceId !== currentDeviceId && fs.existsSync(saveFilePath)) {
        let userConfirm = true;
        if (typeof options.confirmOverwrite === 'function') {
          userConfirm = await options.confirmOverwrite(cloudSave);
        } else if (electron && electron.dialog) {
          const timeStr = cloudSave.timestamp ? new Date(cloudSave.timestamp).toLocaleString() : '未知时间';
          const detailMsg = `检测到来自其他设备"${cloudSave.deviceId}"的存档\n宠物：${cloudSave.petName || '未知'}  等级：${cloudSave.petLevel || 1}  保存时间：${timeStr}\n\n是否用云端存档覆盖本地存档？`;
          const responseIndex = electron.dialog.showMessageBoxSync({
            type: 'question',
            buttons: ['覆盖本地', '保留本地'],
            defaultId: 0,
            cancelId: 1,
            title: '云存档同步确认',
            message: detailMsg
          });
          userConfirm = (responseIndex === 0);
        }

        if (!userConfirm) {
          return { downloaded: false, reason: 'user_cancelled' };
        }
      }

      // 备份本地存档到 backup/
      if (fs.existsSync(saveFilePath)) {
        const backupDir = path.join(userDataPath, 'backup');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        const backupPath = path.join(backupDir, `config-macos.json.bak_${Date.now()}`);
        fs.copyFileSync(saveFilePath, backupPath);
      }

      // 覆盖本地存档
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      fs.writeFileSync(saveFilePath, decodedSaveStr, 'utf-8');

      // 更新配置
      if (options.remember !== false) {
        config.cloudSync = config.cloudSync || {};
        config.cloudSync.lastSyncTime = new Date(cloudTimestamp).toISOString();
        config.cloudSync.lastSyncDevice = cloudSave.deviceId || currentDeviceId;
        cloudSync.writeConfig(config);
      }

      return {
        downloaded: true,
        message: '☁️ 已从云端恢复存档',
        petName: cloudSave.petName,
        petLevel: cloudSave.petLevel
      };
    } catch (err) {
      console.error('downloadSave 失败:', err.message);
      return { downloaded: false, error: err.message };
    }
  },

  /**
   * 应用启动时初始化同步
   */
  async initSync(options = {}) {
    const config = cloudSync.readConfig();
    const token = options.token || config.cloudSync?.githubToken;

    if (!token) {
      return { success: false, needSetup: true };
    }

    const userDataPath = cloudSync.getUserDataPath();
    const pendingFlagPath = path.join(userDataPath, 'pending_sync.flag');

    try {
      if (fs.existsSync(pendingFlagPath)) {
        console.log('检测到 pending_sync.flag，自动重试上传...');
        const uploadRes = await cloudSync.uploadSave(options);
        if (uploadRes.success) {
          return { success: true, action: 'upload_retry' };
        }
      }

      const downloadRes = await cloudSync.downloadSave(options);
      return { success: true, action: 'download', downloadRes };
    } catch (err) {
      console.error('initSync 捕获网络/同步异常:', err.message);
      return { success: false, error: err.message };
    }
  }
};

module.exports = cloudSync;
