# QQ 宠物管家 (WorkBuddy)

QQ 宠物（怀旧服 v1.2.4）的逆向分析、桌面移植与云端存档同步项目（Windows），附带 OpenClaw Skill 实现宠物自动管理。
（本项目基于qqpet_automation开发，增加了云端实时存档功能）

> **核心理念：GitHub 是唯一的"真相"，本地电脑只是"缓存"。**
> 用户不需要从旧电脑带走任何数据文件，只需要在任意新电脑上下载应用并输入 GitHub Token，程序就能自动找到云端 Gist 存档并恢复宠物。

<img width="540" height="824" alt="image" src="https://github.com/user-attachments/assets/6597c635-fb8a-45cc-b0cb-8a49ca5b1314" />

## 项目概述

本项目完成了以下核心工作：

1. **云端存档同步** — 基于 GitHub Gist 实现多设备跨平台无感云同步，具备时间戳对比、冲突确认、断网自动重试与版本备份机制。
2. **逆向分析** — 完整分析了 QQ 宠物的通信架构（Express + WebSocket + RSA 上报）。
3. **桌面移植** — 提取 Electron 源码，移除遥测/指纹采集，用 Ruffle WASM 替代 Flash，适配 macOS 和 Windows。
4. **自动化管理** — Python CLI 直接读写 electron-store 数据文件，实现宠物状态监控与养护。
5. **AI 对话接入** — 桌宠对话从硬编码字典升级为 DeepSeek LLM 动态生成，感知上下文做出针对性反应。

<img width="320" height="334" alt="image" src="https://github.com/user-attachments/assets/457cf203-b00f-4108-a6f8-cf44d75fe315" />

## 快速开始

### 1. 启动宠物与云端恢复

从 [Releases](https://github.com/adgykun/qqpet-cloud-save/releases) 下载 Windows 平台的 Setup 安装包（`QQ宠物-Setup-x64.exe`）：

#### 安装与启动步骤：
1. 下载 Setup 安装包并双击进行安装（**建议选择非系统保护目录，如 D 盘**）。
2. 从桌面快捷方式启动游戏。
3. 首次运行时弹出的配置窗口中输入你的 **GitHub Personal Access Token** 并保持勾选"在此电脑上记住配置"。
4. 点击 **「连接并恢复存档」**，程序会自动在云端搜索并下载恢复你的宠物！此后启动将直接进入游戏，不再弹窗。

### 2. 如何获取 GitHub Token

GitHub Token 是访问你个人云端存档的"授权密钥"，获取非常简单：

1. 登录 GitHub 账号，访问 Token 设置页面：[github.com/settings/tokens](https://github.com/settings/tokens)
2. 点击 **"Generate new token"** (建议选择 `Tokens (classic)`)。
3. Note 填写 `QQPet Cloud Sync`，Expiration 选择 `No expiration`（永不过期）。
4. 在权限列表中**只需勾选 `gist`** 选项（提供私密 Gist 读写权限）。
5. 点击底部 **"Generate token"**，复制生成的 `ghp_xxxxxxxxxxxx` 字符串保存。

### 3. 使用场景

- **换新电脑**：在新电脑上下载应用，输入 Token，程序自动找到并拉取之前的云端 Gist 存档，瞬间恢复宠物。
- **多台电脑（办公/居家）**：应用每次启动自动下载云端最新存档，每次退出或每 5 分钟自动上传最新状态，无缝衔接。
- **断网防护**：断网时可正常游玩，程序会将未同步状态标记为 `pending_sync.flag`，联网后自动补传。
- **旧电脑找回**：在旧电脑上再次打开程序，会自动拉取最新存档并更新本地。

---

## 云端存档与配置文件

### 数据与配置文件

数据与配置目录位于安装目录同级：
- `config.json`：存放云同步配置（位于安装目录 `installDir/config.json`）。
- `userdata/`：存放本地存档（`config-macos.json`）、自动备份（`backup/`）、日志（`sync_log.txt`）以及未同步标记（`pending_sync.flag`）。
- 若安装目录不可写（如安装在 Program Files），自动触发保险丝回退至 `%APPDATA%`。

结构说明：

```json
{
  "cloudSync": {
    "enabled": true,
    "githubToken": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "gistId": "abc123def456789ghijk",
    "intervalMinutes": 5,
    "lastSyncTime": "2026-07-15T14:30:22Z",
    "lastSyncDevice": "DESKTOP-ABC123"
  }
}
```

> **安全提示**：`config.json` 包含你的个人 Token，已加入 `.gitignore`，请勿将配置文件提交或公开发布。

---

## 管理工具 CLI (Python)

```bash
# 环境安装
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 查看状态
.venv/bin/python -m src.qq_pet.cli status

# 养护命令
.venv/bin/python -m src.qq_pet.cli feed      # 喂食
.venv/bin/python -m src.qq_pet.cli bath      # 洗澡
.venv/bin/python -m src.qq_pet.cli auto      # 一键养护
```

---

## 常见问题 (FAQ)

**Q: 我需要记住 Gist ID 吗？**
A: 不需要！程序内置了 `findMyGist` 自动寻找功能，换电脑后只需要输入同一个 GitHub Token，程序会自动扫描并识别出包含 `qqpet_save.json` 的 Gist。

**Q: 如果云端存档和本地存档发生冲突怎么办？**
A: 程序会对比保存时间戳。如果检测到云端存档来自于其他设备且云端更新，程序会弹窗提示确认是否覆盖本地。覆盖前会将本地存档自动备份至 `backup/` 文件夹。

**Q: Token 会泄露吗？**
A: 不会。Token 仅保存在本地 `config.json` 文件中，所有网络通信均直接加密传输至 GitHub 官方 API 接口 (`https://api.github.com/gists`)，不经过任何第三方服务器。

---

## 已知限制

1. 需要能够正常访问 GitHub Gist API（若处在特殊网络环境，请确保网络通畅）。
2. GitHub 个人 Token 必须赋予 `gist` 权限，否则无法写入私密 Gist。

---

## 许可与免责声明

本项目是一个 **个人逆向研究、桌面移植与怀旧存档** 项目，**与腾讯控股有限公司无任何关联，亦未获得其授权**。

### 知识产权
- `QQ宠物` 及其相关标识、角色形象、美术资源归属于 **腾讯及其关联主体**。本项目对前述内容不主张任何权利。
- 本项目原创部分（云同步模块、代码修改、构建脚本与文档）按 **MIT 许可证** 授权。

完整声明详见 [NOTICE.md](./NOTICE.md) 文件。
