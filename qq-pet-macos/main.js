// macOS: 全局 EPIPE 防护 — 必须在最前面
const _origLog = console.log;
const _origErr = console.error;
const _origWarn = console.warn;
const safeFn = (fn) => (...args) => { try { fn(...args); } catch (e) { if (e?.code !== "EPIPE") throw e; } };
console.log = safeFn(_origLog);
console.error = safeFn(_origErr);
console.warn = safeFn(_origWarn);
process.stdout?.on?.("error", () => {});
process.stderr?.on?.("error", () => {});
process.on("uncaughtException", (err) => {
  if (err.code === "EPIPE" || err.message?.includes("EPIPE")) return;
});

const { app, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const cloudSync = require("./src/cloudSync");
const { createSetupWindow } = require("./src/setupWindow");
const { createSettingsWindow } = require("./src/settingsWindow");


const gotTheLock = app.requestSingleInstanceLock();

// 禁用测试后门
global.$test = false;

global.initData = {};

let useTool = null;
let tool = ["floatStyle"];

try {
  let e = process.argv;
  for (let t in tool) {
    let a = false;
    for (let o in e) {
      if (e[o].indexOf(tool[t]) !== -1) {
        initData.NODE_TOOL = tool[t];
        a = true;
        break;
      }
    }
    if (a) break;
  }
} catch (e) {}

if (process?.env?.NODE_TOOL) {
  initData.NODE_TOOL = process.env.NODE_TOOL;
}

if (initData?.NODE_TOOL && typeof initData?.NODE_TOOL === "string") {
  useTool = require("./src/windows/tool/" + initData.NODE_TOOL + "/main.js");
}

const createWindow = async () => {
  require("./src/ini/init.js");
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
  process.on("unhandledRejection", function (e, t) {});
  app.setAppUserModelId("pet");

  if (gotTheLock) {
    if (useTool) {
      useTool.cleate("only");
    } else {
      require("./src/ini/doMain.js");
      const { startDataWatcher } = require("./src/ini/dataWatcher.js");
      startDataWatcher();
    }
  } else {
    app.exit(true);
  }
};

// 注册 IPC 处理器
ipcMain.handle("get-sync-status", async () => {
  const config = cloudSync.readConfig();
  const userDataPath = cloudSync.getUserDataPath();
  const fs = require("fs");
  const saveFile = path.join(userDataPath, "config-macos.json");
  let petName = "未知";
  let petLevel = 1;
  if (fs.existsSync(saveFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(saveFile, "utf-8"));
      petName = parsed.pet?.info?.name || petName;
      petLevel = parsed.pet?.maxInfo?.level || petLevel;
    } catch (_) {}
  }
  return {
    lastSyncTime: config.cloudSync?.lastSyncTime || null,
    lastSyncDevice: config.cloudSync?.lastSyncDevice || null,
    enabled: !!config.cloudSync?.githubToken,
    petName,
    petLevel
  };
});

ipcMain.handle("open-settings", async () => {
  createSettingsWindow();
});

// 每 5 分钟自动调用 uploadSave()
setInterval(() => {
  const config = cloudSync.readConfig();
  if (config.cloudSync?.enabled && config.cloudSync?.githubToken) {
    console.log("执行定时云端同步...");
    cloudSync.uploadSave().catch((err) => {
      console.error("定时云同步失败:", err.message);
    });
  }
}, 5 * 60 * 1000);

// 拦截退出：先执行 uploadSave()，带 5 秒超时保护
let isQuitting = false;

app.on("before-quit", async (e) => {
  if (!isQuitting) {
    isQuitting = true;
    e.preventDefault();
    console.log("正在准备退出，自动同步云存档...");
    try {
      const uploadPromise = cloudSync.uploadSave();
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ timeout: true }), 5000)
      );
      await Promise.race([uploadPromise, timeoutPromise]);
    } catch (err) {
      console.error("退出同步失败:", err.message);
    }
    app.quit();
  }
});

// macOS: 不加载 PepFlash DLL（使用 Ruffle WASM 替代）
app.commandLine.appendSwitch("disable-site-isolation-trials");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.whenReady().then(() => {
  // 数据与配置目录及迁移设置：app ready 最早期重定向 userData 并迁移数据
  cloudSync.migrateOldData();
  const userDataPath = cloudSync.getUserDataPath();
  app.setPath("userData", userDataPath);

  const config = cloudSync.readConfig();
  const token = config.cloudSync?.githubToken;
  const enabled = config.cloudSync?.enabled !== false;

  if (token && enabled) {
    createWindow();
    cloudSync.initSync().catch((err) => {
      console.error("后台同步初始化失败:", err.message);
    });
  } else if (token && !enabled) {
    createWindow();
  } else {
    createSetupWindow((res) => {
      createWindow();
      if (res && res.action === "connect") {
        cloudSync.initSync().catch((err) => {
          console.error("后台同步初始化失败:", err.message);
        });
      }
    });
  }
});
