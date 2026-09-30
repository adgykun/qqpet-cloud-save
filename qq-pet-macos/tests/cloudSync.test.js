const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

jest.mock('axios');

const cloudSync = require('../src/cloudSync');

describe('CloudSync Module Tests', () => {
  let tmpUserDataDir;
  let tmpConfigPath;

  beforeEach(() => {
    jest.clearAllMocks();

    tmpUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qqpet_test_user_'));
    tmpConfigPath = path.join(tmpUserDataDir, 'config.json');

    jest.spyOn(cloudSync, 'getUserDataPath').mockReturnValue(tmpUserDataDir);
    jest.spyOn(cloudSync, 'getConfigPath').mockReturnValue(tmpConfigPath);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      fs.rmSync(tmpUserDataDir, { recursive: true, force: true });
    } catch (_) {}
  });

  describe('Base Dir & Path Helpers & Writability Fuse', () => {
    test('getBaseDir should respect process.env.PORTABLE_EXECUTABLE_DIR if set and writable', () => {
      const originalEnv = process.env.PORTABLE_EXECUTABLE_DIR;
      const tmpPortable = fs.mkdtempSync(path.join(os.tmpdir(), 'qqpet_portable_dir_'));
      process.env.PORTABLE_EXECUTABLE_DIR = tmpPortable;

      const baseDir = cloudSync.getBaseDir();
      expect(baseDir).toBe(tmpPortable);

      if (originalEnv !== undefined) {
        process.env.PORTABLE_EXECUTABLE_DIR = originalEnv;
      } else {
        delete process.env.PORTABLE_EXECUTABLE_DIR;
      }
      try {
        fs.rmSync(tmpPortable, { recursive: true, force: true });
      } catch (_) {}
    });

    test('getBaseDir should fallback to dirname of process.execPath when env is unset', () => {
      const originalEnv = process.env.PORTABLE_EXECUTABLE_DIR;
      delete process.env.PORTABLE_EXECUTABLE_DIR;

      const baseDir = cloudSync.getBaseDir();
      expect(baseDir).toBe(path.dirname(process.execPath));

      if (originalEnv !== undefined) {
        process.env.PORTABLE_EXECUTABLE_DIR = originalEnv;
      }
    });

    test('should trigger fuse and fallback to AppData when install dir is not writable', () => {
      cloudSync.getUserDataPath.mockRestore();
      cloudSync.getConfigPath.mockRestore();

      const unwritableDir = '/unwritable_test_dir_path_12345';
      jest.spyOn(cloudSync, 'getInstallDir').mockReturnValue(unwritableDir);
      jest.spyOn(cloudSync, 'isDirWritable').mockImplementation((dirPath) => {
        if (dirPath === unwritableDir) return false;
        return true;
      });

      const fallbackUserData = cloudSync.getUserDataPath();
      expect(fallbackUserData).not.toBe(path.join(unwritableDir, 'userdata'));
      expect(fallbackUserData).toBeTruthy();

      const logFile = path.join(fallbackUserData, 'sync_log.txt');
      expect(fs.existsSync(logFile)).toBe(true);
      const logContent = fs.readFileSync(logFile, 'utf-8');
      expect(logContent).toContain('[Fuse]');
    });
  });

  describe('migrateOldData', () => {
    test('should migrate legacy config.json and config-macos.json to new locations', () => {
      cloudSync.getUserDataPath.mockRestore();
      cloudSync.getConfigPath.mockRestore();

      const mockBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qqpet_install_base_'));
      const oldLocationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qqpet_old_loc_'));

      jest.spyOn(cloudSync, 'getInstallDir').mockReturnValue(mockBaseDir);

      const oldConfig = path.join(oldLocationDir, 'config.json');
      const oldSave = path.join(oldLocationDir, 'config-macos.json');

      fs.writeFileSync(oldConfig, JSON.stringify({ cloudSync: { githubToken: 'old_migrated_token' } }));
      fs.writeFileSync(oldSave, JSON.stringify({ pet: { info: { name: '旧版企鹅' } } }));

      const originalCwd = process.cwd;
      process.cwd = () => oldLocationDir;

      cloudSync.migrateOldData();

      process.cwd = originalCwd;

      const newConfigPath = path.join(mockBaseDir, 'config.json');
      const newSavePath = path.join(mockBaseDir, 'userdata', 'config-macos.json');

      expect(fs.existsSync(newConfigPath)).toBe(true);
      expect(fs.existsSync(newSavePath)).toBe(true);

      const migratedConfig = JSON.parse(fs.readFileSync(newConfigPath, 'utf-8'));
      expect(migratedConfig.cloudSync.githubToken).toBe('old_migrated_token');

      try {
        fs.rmSync(mockBaseDir, { recursive: true, force: true });
        fs.rmSync(oldLocationDir, { recursive: true, force: true });
      } catch (_) {}
    });
  });

  describe('getDeviceId', () => {
    test('should generate a device ID and persist it to device_id.txt', () => {
      const deviceId1 = cloudSync.getDeviceId();
      expect(deviceId1).toBeTruthy();
      expect(typeof deviceId1).toBe('string');

      const deviceFile = path.join(tmpUserDataDir, 'device_id.txt');
      expect(fs.existsSync(deviceFile)).toBe(true);

      const deviceId2 = cloudSync.getDeviceId();
      expect(deviceId2).toBe(deviceId1);
    });
  });

  describe('findMyGist', () => {
    test('should return gist id if qqpet_save.json exists', async () => {
      axios.get.mockResolvedValueOnce({
        data: [
          { id: 'gist1', files: { 'other.txt': {} } },
          { id: 'gist2', files: { 'qqpet_save.json': {} } }
        ]
      });

      const gistId = await cloudSync.findMyGist('valid_token');
      expect(gistId).toBe('gist2');
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/gists',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'token valid_token'
          })
        })
      );
    });

    test('should return null if qqpet_save.json is not found', async () => {
      axios.get.mockResolvedValueOnce({
        data: [
          { id: 'gist1', files: { 'other.txt': {} } }
        ]
      });

      const gistId = await cloudSync.findMyGist('valid_token');
      expect(gistId).toBeNull();
    });

    test('should return null and not throw on network error', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network Error'));

      const gistId = await cloudSync.findMyGist('valid_token');
      expect(gistId).toBeNull();
    });
  });

  describe('uploadSave', () => {
    test('should return save_file_not_found if local save file does not exist', async () => {
      const result = await cloudSync.uploadSave();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('save_file_not_found');
    });

    test('should return no_token if githubToken is missing in config', async () => {
      const saveFile = path.join(tmpUserDataDir, 'config-macos.json');
      fs.writeFileSync(saveFile, JSON.stringify({ pet: { info: { name: '小企鹅' } } }));

      cloudSync.writeConfig({ cloudSync: { githubToken: '' } });

      const result = await cloudSync.uploadSave();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_token');
    });

    test('should create gist on initial upload when gistId is not present', async () => {
      const saveFile = path.join(tmpUserDataDir, 'config-macos.json');
      fs.writeFileSync(saveFile, JSON.stringify({ pet: { info: { name: 'QQ小企鹅' }, maxInfo: { level: 5 } } }));

      cloudSync.writeConfig({
        cloudSync: {
          enabled: true,
          githubToken: 'ghp_test_token',
          gistId: ''
        }
      });

      // findMyGist returns null
      axios.get.mockResolvedValueOnce({ data: [] });
      // createGist returns created id
      axios.post.mockResolvedValueOnce({ data: { id: 'created_gist_123' } });

      const result = await cloudSync.uploadSave();
      expect(result.success).toBe(true);
      expect(result.gistId).toBe('created_gist_123');

      const updatedConfig = cloudSync.readConfig();
      expect(updatedConfig.cloudSync.gistId).toBe('created_gist_123');
      expect(updatedConfig.cloudSync.lastSyncTime).toBeTruthy();
    });

    test('should update gist on subsequent upload when gistId exists', async () => {
      const saveFile = path.join(tmpUserDataDir, 'config-macos.json');
      fs.writeFileSync(saveFile, JSON.stringify({ pet: { info: { name: 'QQ小企鹅' } } }));

      cloudSync.writeConfig({
        cloudSync: {
          enabled: true,
          githubToken: 'ghp_test_token',
          gistId: 'existing_gist_456'
        }
      });

      axios.patch.mockResolvedValueOnce({ data: { id: 'existing_gist_456' } });

      const result = await cloudSync.uploadSave();
      expect(result.success).toBe(true);
      expect(axios.patch).toHaveBeenCalledWith(
        'https://api.github.com/gists/existing_gist_456',
        expect.anything(),
        expect.anything()
      );
    });

    test('should create pending_sync.flag when network request fails', async () => {
      const saveFile = path.join(tmpUserDataDir, 'config-macos.json');
      fs.writeFileSync(saveFile, JSON.stringify({ pet: { info: { name: 'QQ小企鹅' } } }));

      cloudSync.writeConfig({
        cloudSync: {
          enabled: true,
          githubToken: 'ghp_test_token',
          gistId: 'existing_gist_456'
        }
      });

      axios.patch.mockRejectedValueOnce(new Error('Network Disconnected'));

      const result = await cloudSync.uploadSave();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Disconnected');

      const pendingFlag = path.join(tmpUserDataDir, 'pending_sync.flag');
      expect(fs.existsSync(pendingFlag)).toBe(true);
    });
  });

  describe('downloadSave', () => {
    test('should overwrite local save and backup existing save when cloud is newer', async () => {
      const saveFile = path.join(tmpUserDataDir, 'config-macos.json');
      const oldContent = JSON.stringify({ pet: { info: { name: '老宠物' } } });
      fs.writeFileSync(saveFile, oldContent);

      const oldMtime = Date.now() - 10000;
      fs.utimesSync(saveFile, oldMtime / 1000, oldMtime / 1000);

      cloudSync.writeConfig({
        cloudSync: {
          enabled: true,
          githubToken: 'ghp_test_token',
          gistId: 'gist_123'
        }
      });

      const newCloudPetData = JSON.stringify({ pet: { info: { name: '新云端宠物' } } });
      const cloudPayload = {
        data: Buffer.from(newCloudPetData).toString('base64'),
        timestamp: Date.now(),
        deviceId: cloudSync.getDeviceId(),
        petName: '新云端宠物',
        petLevel: 10
      };

      axios.get.mockResolvedValueOnce({
        data: {
          files: {
            'qqpet_save.json': {
              content: JSON.stringify(cloudPayload)
            }
          }
        }
      });

      const result = await cloudSync.downloadSave();
      expect(result.downloaded).toBe(true);

      const updatedLocalContent = fs.readFileSync(saveFile, 'utf-8');
      expect(updatedLocalContent).toBe(newCloudPetData);

      const backupDir = path.join(tmpUserDataDir, 'backup');
      expect(fs.existsSync(backupDir)).toBe(true);
      const backupFiles = fs.readdirSync(backupDir);
      expect(backupFiles.length).toBeGreaterThan(0);
    });

    test('should skip download when local save is newer', async () => {
      const saveFile = path.join(tmpUserDataDir, 'config-macos.json');
      const localContent = JSON.stringify({ pet: { info: { name: '最新本地宠物' } } });
      fs.writeFileSync(saveFile, localContent);

      cloudSync.writeConfig({
        cloudSync: {
          enabled: true,
          githubToken: 'ghp_test_token',
          gistId: 'gist_123'
        }
      });

      const cloudPayload = {
        data: Buffer.from(JSON.stringify({ pet: { info: { name: '旧云端宠物' } } })).toString('base64'),
        timestamp: Date.now() - 50000,
        deviceId: cloudSync.getDeviceId()
      };

      axios.get.mockResolvedValueOnce({
        data: {
          files: {
            'qqpet_save.json': {
              content: JSON.stringify(cloudPayload)
            }
          }
        }
      });

      const result = await cloudSync.downloadSave();
      expect(result.downloaded).toBe(false);
      expect(result.reason).toBe('local_newer');
    });

    test('should prompt for user confirmation when cloud save is from another device', async () => {
      const saveFile = path.join(tmpUserDataDir, 'config-macos.json');
      fs.writeFileSync(saveFile, JSON.stringify({ pet: { info: { name: '本地企鹅' } } }));
      const oldTime = Date.now() - 10000;
      fs.utimesSync(saveFile, oldTime / 1000, oldTime / 1000);

      cloudSync.writeConfig({
        cloudSync: {
          enabled: true,
          githubToken: 'ghp_test_token',
          gistId: 'gist_123'
        }
      });

      const cloudPayload = {
        data: Buffer.from(JSON.stringify({ pet: { info: { name: '异地企鹅' } } })).toString('base64'),
        timestamp: Date.now(),
        deviceId: 'OTHER-DEVICE-XYZ',
        petName: '异地企鹅',
        petLevel: 20
      };

      axios.get.mockResolvedValueOnce({
        data: {
          files: {
            'qqpet_save.json': {
              content: JSON.stringify(cloudPayload)
            }
          }
        }
      });

      const mockConfirm = jest.fn().mockResolvedValue(false);
      const result = await cloudSync.downloadSave({ confirmOverwrite: mockConfirm });

      expect(mockConfirm).toHaveBeenCalled();
      expect(result.downloaded).toBe(false);
      expect(result.reason).toBe('user_cancelled');
    });

    test('should handle corrupted cloud data gracefully', async () => {
      cloudSync.writeConfig({
        cloudSync: {
          enabled: true,
          githubToken: 'ghp_test_token',
          gistId: 'gist_corrupted'
        }
      });

      axios.get.mockResolvedValueOnce({
        data: {
          files: {}
        }
      });

      const result = await cloudSync.downloadSave();
      expect(result.downloaded).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('initSync', () => {
    test('should return needSetup: true if no token is configured', async () => {
      cloudSync.writeConfig({ cloudSync: { githubToken: '' } });

      const result = await cloudSync.initSync();
      expect(result.needSetup).toBe(true);
    });

    test('should retry upload if pending_sync.flag exists', async () => {
      const saveFile = path.join(tmpUserDataDir, 'config-macos.json');
      fs.writeFileSync(saveFile, JSON.stringify({ pet: { info: { name: '重试企鹅' } } }));

      const pendingFlag = path.join(tmpUserDataDir, 'pending_sync.flag');
      fs.writeFileSync(pendingFlag, '123456');

      cloudSync.writeConfig({
        cloudSync: {
          enabled: true,
          githubToken: 'ghp_test_token',
          gistId: 'gist_123'
        }
      });

      axios.patch.mockResolvedValueOnce({ data: { id: 'gist_123' } });

      const result = await cloudSync.initSync();
      expect(result.action).toBe('upload_retry');
      expect(fs.existsSync(pendingFlag)).toBe(false);
    });
  });

  describe('validateToken & Setup window logic', () => {
    test('should return true if GitHub API responds 200', async () => {
      axios.get.mockResolvedValueOnce({ status: 200 });
      const isValid = await cloudSync.validateToken('valid_token');
      expect(isValid).toBe(true);
    });

    test('should return false if GitHub API responds with error', async () => {
      axios.get.mockRejectedValueOnce(new Error('401 Unauthorized'));
      const isValid = await cloudSync.validateToken('invalid_token');
      expect(isValid).toBe(false);
    });

    test('should correctly write setup config when remember option is selected', () => {
      const token = 'ghp_remember_token_123';
      const gistId = 'gist_abc_456';

      const config = {
        cloudSync: {
          enabled: true,
          githubToken: token,
          gistId: gistId,
          intervalMinutes: 5
        }
      };

      cloudSync.writeConfig(config);

      const saved = cloudSync.readConfig();
      expect(saved.cloudSync.githubToken).toBe(token);
      expect(saved.cloudSync.gistId).toBe(gistId);
    });
  });
});
